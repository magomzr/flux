# flux-backend

Backend de gestión y entrega de feature flags multi-tenant. Construido con NestJS + TypeScript + PostgreSQL + Drizzle ORM. Diseñado como monolito modular con separación clara entre la superficie de administración (Dashboard API) y la superficie de consumo (SDK API), de forma que el módulo de delivery pueda extraerse a un servicio Go independiente en el futuro sin cambios en los contratos públicos.

---

## Contexto del producto

Flux es un producto SaaS propio para ofrecer a clientes de software a medida. Permite gestionar feature flags, condiciones de activación por ambiente, assets estáticos, y facturación por uso. Los clientes integran Flux en sus aplicaciones a través de una SDK que consume la SDK API.

El modelo de negocio contempla:

- Capa gratuita con límites de flags, evaluaciones y sin acceso a SSE.
- Planes de pago con polling más frecuente, SSE en tiempo real, y más recursos.
- Facturación por uso (evaluaciones sobre el límite, storage de assets, conexiones SSE).
- Calculadora de costos interactiva para que el cliente estime su gasto antes de contratar.

---

## Stack

| Capa              | Tecnología                        |
| ----------------- | --------------------------------- |
| Runtime           | Node.js                           |
| Framework         | NestJS                            |
| Lenguaje          | TypeScript                        |
| Base de datos     | PostgreSQL                        |
| ORM               | Drizzle ORM                       |
| Autenticación     | JWT (RS256) + Argon2id (o bcrypt) |
| Cache / Pub-Sub   | Redis                             |
| Storage de assets | Cloudflare R2 (o S3)              |
| Monitoreo         | Prometheus + Grafana              |

---

## Arquitectura general

El sistema expone dos superficies completamente distintas:

### Dashboard API

Consumida por el frontend Angular (flux-frontend). Autenticada con JWT de sesión. Cubre toda la gestión del sistema: tenants, proyectos, ambientes, flags, assets, billing y audit.

### SDK API

Consumida por la SDK que corre en las aplicaciones de los clientes. Autenticada con API key por ambiente. Optimizada para latencia baja. Trabaja 100% desde un cache en memoria, sin tocar la DB en cada evaluación. Expone:

- `GET /sdk/flags` — evaluación de todos los flags para un contexto dado.
- `GET /sdk/flags/:key` — evaluación de un flag específico.
- `SSE /sdk/stream` — notificaciones en tiempo real de cambios de flags (plan standard+).

Cuando el volumen lo justifique, el módulo `delivery` se extrae a un servicio Go independiente. La transición es transparente para los clientes porque el contrato de la SDK API no cambia. La comunicación interna pasa de EventEmitter a Redis Pub/Sub.

```
Hoy:
  flux-frontend  →  flux-backend (NestJS, todo)

Futuro:
  flux-frontend       →  flux-backend (NestJS, Dashboard API)
  SDK del cliente     →  flux-delivery (Go, SDK API)
  flux-backend        →  Redis  →  flux-delivery (invalidación de cache)
```

---

## Estructura del proyecto

```
flux-backend/
├── src/
│   ├── common/
│   │   ├── decorators/        # @TenantContext, @CurrentUser, @RequirePerms
│   │   ├── guards/            # JwtAuthGuard, PermissionsGuard, SdkApiKeyGuard, PlanGuard
│   │   └── interceptors/      # AuditInterceptor, LoggingInterceptor
│   │
│   ├── db/
│   │   ├── index.ts           # instancia de Drizzle + token DB para inyección
│   │   └── schema.ts          # todas las tablas Drizzle
│   │
│   ├── modules/
│   │   ├── auth/              # login, refresh tokens, emisión de JWT
│   │   ├── users/             # CRUD de usuarios, validación de credenciales, resolución de permisos
│   │   ├── tenants/           # gestión de empresas cliente
│   │   ├── projects/          # proyectos dentro de un tenant
│   │   ├── environments/      # ambientes por proyecto (production, staging, development)
│   │   ├── flags/             # CRUD de flags, tipos, valores por ambiente, reglas de activación
│   │   ├── assets/            # upload y gestión de archivos estáticos en R2/S3
│   │   ├── delivery/          # cache en memoria, evaluación de flags, REST polling, SSE
│   │   ├── billing/           # planes, suscripciones, registro de uso, calculadora de costos
│   │   └── audit/             # log inmutable de acciones en el dashboard
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── drizzle/
│   └── migrations/
├── test/
├── .env.example
└── README.md
```

---

## Módulos

### `auth`

Maneja el ciclo de vida de sesiones del dashboard. Login con email/password, emisión de JWT (RS256), refresh tokens con revocación por familia. No gestiona sesiones de la SDK (eso es por API key).

### `users`

Entidad central del dashboard. Un usuario pertenece a un tenant y tiene un rol. Los usuarios internos (super_admin, ops) tienen `tenantId` null. La resolución de permisos se hace en código a partir del rol, sin consultar la DB.

### `tenants`

Representa a cada empresa cliente. Todo el sistema (proyectos, flags, billing) vive bajo un tenant. Incluye gestión de estado activo/inactivo y slug para identificación url-friendly.

### `projects`

Un tenant puede tener múltiples proyectos (app móvil, web, backend interno). Cada proyecto tiene sus propios ambientes y flags. Permite aislar contextos dentro del mismo tenant.

### `environments`

Cada proyecto tiene ambientes: `production`, `staging`, `development`. Los valores y el estado de activación de cada flag son por ambiente, no globales. Cada ambiente tiene su propia SDK API key.

### `flags`

Core del producto. Gestiona la definición de flags (key, nombre, tipo: boolean / string / number / json), sus valores por ambiente, el porcentaje de rollout, y el historial de publicaciones. La acción de publicar en producción requiere el permiso `publish:flag`, separado del permiso de escritura general.

### `assets`

Gestión de archivos estáticos que el cliente sube y puede referenciar desde sus flags (por ejemplo, una flag que controla qué banner mostrar). Maneja upload, almacenamiento en R2/S3, y URLs públicas o firmadas.

### `delivery`

El módulo más importante técnicamente y el candidato a convertirse en servicio Go. Mantiene todos los flags del sistema en un cache en memoria organizado por tenant/proyecto/ambiente. Cada evaluación de flag es una lectura de ese cache, sin I/O. Se actualiza cuando recibe eventos internos de cambio de flag. Expone la SDK API.

### `billing`

Controla los planes disponibles, las suscripciones activas por tenant, y el registro de consumo mensual (evaluaciones, conexiones SSE, storage). Expone la calculadora de costos. Es consultado por `delivery` y por `flags` para verificar límites del plan antes de permitir operaciones.

### `audit`

Log inmutable de todas las acciones realizadas en el dashboard. Registra quién hizo qué, sobre qué entidad, cuándo, y desde qué IP. Solo escribe, nunca modifica. Esencial para clientes que necesitan trazabilidad.

---

## Schema de base de datos

```
tenants                  empresa cliente, raíz de todo
users                    usuarios del dashboard, rol directo como texto
refresh_tokens           tokens de refresh con revocación por familia
projects                 proyectos dentro de un tenant
environments             ambientes por proyecto
sdk_api_keys             API keys por ambiente para autenticar la SDK
flags                    definición de flags por proyecto
flag_values              valor y estado de cada flag por ambiente
assets                   archivos subidos por el tenant
plans                    catálogo de planes (free, standard, pro)
tenant_subscriptions     plan activo de cada tenant
usage_records            consumo mensual por tenant
audit_logs               log inmutable de acciones
```

---

## Roles y permisos

Los roles son fijos en código. No son configurables por el tenant. La fuente de verdad es `src\common\config\roles.config.ts`.

### Roles disponibles

| Rol            | Descripción                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `super_admin`  | Acceso total. Usuario interno de Flux.                                      |
| `ops`          | Lectura global para monitoreo interno. Sin escritura.                       |
| `tenant_admin` | Acceso total dentro de su tenant, incluyendo billing.                       |
| `developer`    | Gestión completa de flags incluyendo publicación a producción. Sin billing. |
| `editor`       | Puede crear y editar flags pero no publicarlos a producción.                |
| `viewer`       | Solo lectura. Para stakeholders.                                            |

### Permisos

```typescript
// Flags
'read:flag'; // ver flags y sus valores
'write:flag'; // crear y editar flags
'publish:flag'; // activar/desactivar en producción

// Projects
'read:project';
'write:project';

// Environments
'read:environment';
'write:environment';

// Assets
'read:asset';
'write:asset';

// Billing
'read:billing';
'write:billing';

// Tenants (solo roles internos)
'read:tenant';
'insert:tenants';
'update:tenant';
'delete:tenant';

// Audit
'read:audit';
```

`*_write` cubre tanto insert como update. `publish:flag` está separado de `write:flag` porque activar un flag en producción es una acción de mayor riesgo que editarlo.

---

## SDK API

La SDK API es la superficie que consume la SDK publicada para los clientes. Autenticada con API key por ambiente (header `X-Api-Key`). No requiere JWT.

```
GET  /sdk/flags
     Query: userId, [atributos de targeting opcionales]
     Devuelve todos los flags evaluados para el contexto dado.
     Respuesta desde cache en memoria. Sin I/O a DB.

GET  /sdk/flags/:key
     Evaluación de un flag específico.

SSE  /sdk/stream
     Conexión persistente. Notifica cuando cambia cualquier flag del ambiente.
     Solo disponible en plan standard+.
```

### SDK disponibles (roadmap)

- `@flux/node` — Node.js / TypeScript
- `@flux/browser` — Browser / Angular

La SDK mantiene un cache local de flags, hace polling en background o se suscribe al stream SSE, y evalúa flags localmente con el contexto del usuario. El HTTP es transparente para quien usa la SDK.

---

## Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/flux

# JWT
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# App
PORT=3000
NODE_ENV=development
```

---

## Decisiones técnicas relevantes

**Monolito modular sobre microservicios desde el inicio.** Los módulos se comunican por eventos internos (EventEmitter2), no por llamadas directas entre servicios. Esto permite extraer módulos como servicios independientes cambiando solo el transporte, sin tocar la lógica de negocio.

**Roles en código, no en DB.** Los roles y sus permisos son fijos y conocidos en tiempo de compilación. Mantenerlos en tablas relacionales duplicaría la lógica sin agregar valor. Un check constraint en la columna `role` de `users` garantiza integridad en DB.

**Delivery como módulo aislado.** Todo el código de evaluación de flags y manejo de conexiones SSE vive en `modules/delivery` sin dependencias directas hacia otros módulos. Es el candidato natural a convertirse en un servicio Go cuando el volumen lo justifique. El contrato público (SDK API) no cambiaría.

**`publish:flag` separado de `write:flag`.** Activar un flag en producción es una acción de mayor riesgo que editarlo. La separación permite que un `editor` prepare cambios y un `developer` o `tenant_admin` los publique, similar al patrón PR → merge.

**bcrypt para hashing de passwords.** Consistente con el proyecto RBAC de referencia. Argon2id está disponible como alternativa si se requiere alineación con otros servicios del ecosistema.
