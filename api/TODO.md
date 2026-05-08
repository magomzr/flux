# flux-backend — TODO

## ✅ Hecho

### Arquitectura y decisiones
- [x] Definir arquitectura general (monolito modular → microservicios)
- [x] Definir dos superficies: Dashboard API y SDK API
- [x] Modelo multi-tenant con una sola DB (opción A)
- [x] Estrategia de extracción del módulo `delivery` a Go en el futuro
- [x] Roles y permisos definidos en código (`permissions.constants.ts`)
- [x] Schema de DB completo en Drizzle (`schema.ts`)
- [x] Estructura de módulos definida

### Infraestructura
- [x] Postgres 17 corriendo en Podman
- [x] `drizzle.config.ts` configurado
- [x] Scripts `db:generate`, `db:migrate`, `db:studio` en `package.json`
- [x] Migration inicial aplicada
- [x] `.env` configurado con llaves RS256, DATABASE_URL

### Módulos
- [x] `auth` — login, refresh, logout, RS256, revocación de refresh tokens por familia
- [x] `users` — validación de credenciales, resolución de permisos desde código
- [x] `tenants` — CRUD completo, deactivate (soft), removePermanently (hard)

---

## 🔲 Pendiente

### Módulos por construir
- [x] `projects` — CRUD, relación con tenant
- [x] `environments` — CRUD, relación con project, color, isDefault
- [ ] `sdk-api-keys` — generación, hash, rotación de keys por ambiente
- [ ] `flags` — CRUD, tipos (boolean/string/number/json), valores por ambiente
- [ ] `flag-values` — estado por ambiente, rollout percentage, publishedAt/publishedBy
- [ ] `assets` — upload, storage en R2/S3, URLs firmadas, relación con tenant
- [ ] `billing` — planes, suscripciones, registro de uso, calculadora de costos
- [ ] `delivery` — cache en memoria, evaluación de flags, REST polling, SSE
- [ ] `audit` — log inmutable de acciones del dashboard

### Auth / usuarios
- [ ] Endpoint `POST /auth/logout` probado end-to-end
- [ ] Cleanup periódico de refresh tokens expirados (cron job)
- [x] Seed inicial: usuario `super_admin` insertado manualmente en DB (mario@flux.com)
- [ ] DTO y validación para login (`class-validator`)

### SDK API (dentro de `delivery`)
- [ ] `GET /sdk/flags` — evaluación de todos los flags para un contexto
- [ ] `GET /sdk/flags/:key` — evaluación de un flag específico
- [ ] `SSE /sdk/stream` — notificaciones en tiempo real (plan standard+)
- [ ] `SdkApiKeyGuard` — autenticación por API key de ambiente
- [ ] `PlanGuard` — verificación de plan antes de permitir SSE
- [ ] Cache en memoria por tenant/proyecto/ambiente con invalidación por eventos

### Guards y decorators
- [ ] `JwtAuthGuard` — verificación de JWT RS256
- [ ] `PermissionsGuard` — verificación de permisos desde el JWT
- [ ] `RequirePerms` decorator
- [ ] `TenantContext` decorator — extrae tenantId del JWT
- [ ] `CurrentUser` decorator — extrae usuario del JWT
- [ ] `Public` decorator — marca endpoints sin auth (ya existe, verificar)

### Infraestructura pendiente
- [ ] Redis para cache y pub/sub de invalidación de flags
- [ ] Configurar Cloudflare R2 o S3 para assets
- [ ] Dockerfile y docker-compose para desarrollo
- [ ] `.gitignore` revisado (llaves, .env, node_modules)
- [ ] Variables de entorno documentadas en `.env.example`

### Calidad y documentación
- [ ] Actualizar README con avances
- [ ] Tests del módulo `auth` (login, refresh, revocación)
- [ ] Tests del módulo `tenants`
- [ ] Configurar Swagger/OpenAPI para Dashboard API
