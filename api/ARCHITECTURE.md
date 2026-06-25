# Flux — Architecture

Documentación técnica del sistema: cómo está diseñado, cómo se despliega, y qué decisiones de infraestructura se tomaron.

---

## System design

### Superficies

Flux expone dos APIs completamente separadas desde el mismo proceso:

```
┌──────────────────────────────────────────────────────┐
│                    flux-api (NestJS)                  │
│                                                      │
│  Dashboard API                SDK API                │
│  ─────────────                ────────               │
│  JWT RS256 auth               API Key auth           │
│  CRUD de recursos             GET /sdk/flags         │
│  Audit, billing, users        GET /sdk/flags/:key    │
│  Gestión de flags/envs        SSE /sdk/stream        │
│                                                      │
│  Consumido por:               Consumido por:         │
│  web/ (Angular dashboard)     SDK del cliente        │
└──────────────────────────────────────────────────────┘
```

El Dashboard API es la gestión. El SDK API es la entrega — optimizada para latencia mínima y throughput máximo.

### Multi-tenancy

Modelo: **shared database, shared schema**. Todos los tenants viven en la misma base de datos con aislamiento lógico por `tenant_id`.

```
tenants
  └── users          (tenant_id FK)
  └── projects       (tenant_id FK → cascade)
       └── environments   (project_id FK → cascade)
            └── sdk_api_keys  (environment_id FK → cascade)
            └── flag_values   (environment_id FK → cascade)
       └── flags          (project_id FK → cascade)
  └── subscriptions  (tenant_id FK → cascade)
  └── usage_records  (tenant_id FK → cascade)
  └── audit_logs     (tenant_id FK → set null)
```

El `TenantGuard` verifica ownership en cada request. Funciona con `@TenantResource({ param, via? })` que le indica al guard cómo resolver el `tenant_id` de la entidad accedida:

- `{ param: 'tenantId' }` — directo del path
- `{ param: 'projectId', via: 'project' }` — resuelve project → tenant via DB
- `{ param: 'id', via: 'environment' }` — resuelve environment → project → tenant

Roles internos (`super_admin`, `ops`) saltan la verificación.

### Permisos

Los permisos son fijos en código, no en DB. Cada rol tiene un set predefinido de permissions que se incluyen en el JWT al hacer login:

```
JWT payload: { sub, name, email, tenantId, role, permissions[] }
```

El `PermissionsGuard` verifica que el usuario tenga todos los permisos requeridos por el endpoint. No hay consulta a DB — todo vive en el token.

### Delivery — el hot path

El endpoint `/sdk/flags` es el más consumido. Diseñado para responder en microsegundos:

```
Request → SdkApiKeyGuard (cache L1/L2) → FlagCacheService (Map en memoria) → Response
```

Capas de cache:

1. **API Key Cache L1**: `rawKey → CachedApiKey`. Después del primer bcrypt, la key se valida en O(1).
2. **API Key Cache L2**: `prefix → CachedApiKeyInternal[]`. Solo se consulta en L1 miss.
3. **Flag Cache**: `environmentId → Map<flagKey, { enabled, value, type }>`. Se carga lazy desde DB, se invalida por evento cuando un flag cambia.
4. **ETag**: hash SHA1 del estado de los flags. El cliente envía `If-None-Match` → si coincide, responde 304 sin body.

Invalidación: cuando `FlagsService` muta un flag, emite `FLAG_CHANGED_EVENT` via `EventEmitter2`. `FlagCacheService` escucha y elimina la entrada del ambiente. El próximo request recarga desde DB.

### SDK — modelo on-demand

La SDK no hace polling por defecto. Carga flags una vez al inicializar y los sirve desde cache local. El developer decide cuándo refrescar:

```
SDK.init()     → 1 HTTP request al servidor
SDK.getFlag()  → lectura local, 0 HTTP
SDK.refresh()  → 1 HTTP request (condicional, 304 si nada cambió)
```

Opcionalmente se puede activar `autoRefresh` para background refresh, pero no es el default.

### Billing

Tres planes con lógica diferenciada:

- **Starter / Studio**: precio fijo, sin medidores de evaluaciones. El `UsageCounterService` cuenta evaluaciones pero el `BillingService` ignora el overage para estos planes.
- **Scale**: precio base + overage por evaluaciones y storage sobre el límite.

Los planes se definen en código (`billing.seed.ts`) con upsert al arrancar. Cambios de precios/límites se versionan en git.

---

## Componentes de infraestructura

### Requeridos

| Componente                   | Propósito                       | Notas                                   |
| ---------------------------- | ------------------------------- | --------------------------------------- |
| **Contenedor de aplicación** | Corre el proceso NestJS         | 0.5-1 vCPU, 512MB-1GB RAM               |
| **PostgreSQL**               | Persistencia de todos los datos | Single instance suficiente para empezar |
| **SSL/TLS termination**      | HTTPS para ambas APIs           | Certificado gestionado o Let's Encrypt  |
| **DNS**                      | Resolución de dominio           | `api.flux.tudominio.com`                |
| **CDN / static hosting**     | Sirve el frontend Angular       | Build estático, cacheable               |

### Opcionales (por escala)

| Componente         | Cuándo                  | Propósito                                                |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| **Load balancer**  | 2+ instancias de la API | Distribución de tráfico, health checks                   |
| **Redis**          | 2+ instancias           | Sincronización de invalidación de cache entre instancias |
| **Object storage** | Módulo de assets        | Archivos subidos por tenants (imágenes, configs)         |
| **Monitoring**     | Producción              | Métricas, alertas, logs centralizados                    |

---

## Deployment

### Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:password@host:5432/flux

# JWT (RS256)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"

# App
PORT=3000
NODE_ENV=production
```

### Build y ejecución

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
node dist/main.js
```

Al arrancar:

1. Conecta a PostgreSQL
2. Ejecuta el seed de planes (upsert)
3. Expone la API en el puerto configurado
4. El flag cache se carga lazy al primer request SDK

### Health check

```
GET /health → 200 OK
```

Usar para readiness probes del orquestador.

---

## Ruta de evolución

```
Fase 1 (actual):
  1 instancia (NestJS, todo en un proceso)
  PostgreSQL (single instance)
  Cache en memoria del proceso
  Frontend en CDN

Fase 2 (5-15 clientes):
  2 instancias con load balancer
  PostgreSQL con backups automáticos
  Redis para invalidación de cache cruzada
  Monitoring básico

Fase 3 (15+ clientes):
  flux-api: N instancias (Dashboard API)
  flux-delivery: servicio Go separado (SDK API)
  PostgreSQL con read replicas
  Redis cluster
  Object storage para assets
  WAF / rate limiting
```

La transición de Fase 1 a 2 no requiere cambios de código — solo agregar Redis y una segunda instancia. La transición a Fase 3 requiere extraer el módulo `delivery` a Go, pero el contrato público (`/sdk/flags`) no cambia.

---

## Costos estimados por proveedor

### Railway (recomendado para Fase 1)

```
API (0.5 vCPU, 512MB)     ~$5-8/mes
PostgreSQL (1GB storage)   ~$5-7/mes
────────────────────────────────────
Total:                     ~$10-15/mes
```

### Render

```
API (Starter plan)         $7/mes
PostgreSQL (Starter)       $7/mes
────────────────────────────────────
Total:                     ~$14/mes (nota: Starter hace spin-down)
API (Standard, no sleep)   $25/mes → total ~$32/mes
```

### Fly.io

```
API (shared-cpu-1x)        ~$3-5/mes
Managed Postgres (Starter) ~$29/mes
────────────────────────────────────
Total:                     ~$32-34/mes
```

### Hetzner VPS (self-managed)

```
CX22 (2 vCPU, 4GB RAM)    ~$4/mes
PostgreSQL en el VPS       $0 extra
Backups automáticos        ~$1/mes
────────────────────────────────────
Total:                     ~$5/mes (tú gestionas Docker, SSL, backups)
```

### Frontend

Cloudflare Pages — gratis, CDN global, deploy desde git. Recomendado independientemente del proveedor del backend.

---

## Decisiones técnicas documentadas

| Decisión                        | Razón                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Shared DB multi-tenant          | Simplicidad operativa, un solo backup, un solo schema. Suficiente hasta cientos de tenants. |
| Permisos en JWT, no en DB       | Evaluación O(1) sin I/O. Los roles son fijos y conocidos.                                   |
| Cache en memoria, no Redis      | Con 1 instancia, Redis agrega latencia sin beneficio. Map es más rápido.                    |
| EventEmitter2 para invalidación | Desacopla FlagsService de FlagCacheService sin infraestructura extra.                       |
| ETag en delivery                | Reduce transferencia de datos al mínimo. 304 sin body cuando nada cambió.                   |
| bcrypt L1 cache por rawKey      | bcrypt solo ocurre una vez por key en el lifetime del servidor.                             |
| Audit log con SET NULL en FK    | Inmutable — no se pierde historial si se borra un tenant o usuario.                         |
| Plans en código con upsert      | Versionados en git, sin UI de gestión, cambios trazables.                                   |
| On-demand SDK (sin polling)     | Menos carga en servidor, más control para el developer.                                     |
