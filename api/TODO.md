# flux-backend — TODO

## ✅ Hecho

### Arquitectura y decisiones
- [x] Arquitectura general (monolito modular → microservicios)
- [x] Dos superficies: Dashboard API y SDK API
- [x] Modelo multi-tenant con una sola DB
- [x] Estrategia de extracción del módulo `delivery` a Go en el futuro
- [x] Roles y permisos definidos en código (`roles.config.ts`)
- [x] Schema de DB completo en Drizzle (`schema.ts`)
- [x] Estrategia de planes definida (ver abajo)

### Modelo de negocio — planes

Flux sirve tres escenarios distintos con lógicas de precio diferentes:

| Plan | Escenario | Precio | Overage |
|---|---|---|---|
| **Starter** | Uso interno / proyectos propios | $0 | No |
| **Studio** | Clientes de desarrollo a medida | $49/mo fijo | No — precio fijo, sin medidores |
| **Scale** | Empresas externas que contratan Flux directamente | $99/mo base | Sí — evaluaciones y storage |

- **Starter**: 1 proyecto, 3 ambientes, 50 flags, sin SSE, polling 60s.
- **Studio**: proyectos ilimitados, 10 ambientes, 500 flags, SSE incluido, polling 10s. Sin medidores de evaluaciones — el costo de delivery se absorbe en el margen del contrato de desarrollo.
- **Scale**: todo ilimitado, SSE, polling 5s. Con medidores de evaluaciones y storage para clientes que no tienen otra relación comercial con Flux.

### Infraestructura
- [x] Postgres 17 corriendo en Podman
- [x] Drizzle configurado con scripts `db:generate`, `db:migrate`, `db:studio`
- [x] Migration inicial aplicada
- [x] `.env` configurado con llaves RS256 y DATABASE_URL

### Módulos
- [x] `auth` — login, refresh, logout, RS256, revocación de refresh tokens por familia
- [x] `users` — validación de credenciales, resolución de permisos desde código
- [x] `tenants` — CRUD completo, deactivate (soft), removePermanently (hard), audit
- [x] `projects` — CRUD, relación con tenant, TenantGuard, audit
- [x] `environments` — CRUD, color, isDefault, TenantGuard, audit
- [x] `sdk-api-keys` — generación, hash bcrypt, revocación, invalidación de cache
- [x] `flags` — CRUD, tipos (boolean/string/number/json), valores por ambiente, audit
- [x] `flag-values` — enabled, value, publishedAt/publishedBy, audit
- [x] `billing` — planes, suscripciones, uso mensual, forecast de costo, calculadora
- [x] `delivery` — cache en memoria L1/L2, ETag, REST polling, SSE, usage counter
- [x] `audit` — log inmutable, consulta por tenant/entidad/usuario

### Guards y decorators
- [x] `JwtAuthGuard` — verificación de JWT RS256
- [x] `PermissionsGuard` — verificación de permisos desde el JWT
- [x] `TenantGuard` + `@TenantResource` — ownership check centralizado
- [x] `SdkApiKeyGuard` — autenticación por API key de ambiente
- [x] `@RequirePerms`, `@CurrentUser`, `@Public` decorators

### Performance
- [x] Cache de flags en memoria con invalidación por eventos (EventEmitter2)
- [x] Cache de API keys L1 (rawKey verificada) + L2 (por prefix)
- [x] ETag + conditional GET (304) para polling eficiente
- [x] Usage counter con batching en memoria (flush cada 30s)
- [x] k6 load test: p95=7ms bajo spike de 200 VUs, 25k req/s

---

## 🔲 Pendiente

### MVP — prioritario
- [x] DTO y validación para login con `class-validator`
- [x] Endpoint `POST /auth/logout` — verificar end-to-end
- [x] Swagger/OpenAPI para Dashboard API (`/docs`)
- [x] `.env.example` actualizado con todas las variables actuales
- [ ] Seed script reproducible para `super_admin` (en lugar de INSERT manual)
- [ ] Dockerfile + docker-compose/podman-compose para desarrollo local
- [x] `POST /tenants` — al crear un tenant, crear automáticamente un usuario `tenant_admin` con email y password definidos por el `super_admin` en el mismo request. Devolver las credenciales en la respuesta (solo una vez).
- [x] `GET/POST/PATCH/DELETE /tenants/:tenantId/users` — CRUD de usuarios por tenant

### Post-MVP
- [ ] `assets` — upload, storage en R2/S3, URLs firmadas
- [ ] Redis para invalidación de cache entre múltiples instancias
- [ ] Cleanup periódico de refresh tokens expirados (cron job)
- [ ] **Unit tests del API** — cobertura completa de todos los módulos:
  - `auth` — login, refresh, logout, revocación de familia, changePassword
  - `users` — CRUD, validación de credenciales, permisos por rol
  - `tenants` — CRUD, creación con admin automático
  - `projects` — CRUD, ownership check via TenantGuard
  - `environments` — CRUD, lógica de isDefault
  - `flags` — CRUD, creación automática de flag_values, invalidación de cache
  - `billing` — planes, suscripciones, forecast, overage solo en Scale
  - `delivery` — cache L1/L2, ETag, invalidación por eventos
  - `audit` — escritura inmutable, consulta por filtros
  - Guards: `TenantGuard`, `PermissionsGuard`, `SdkApiKeyGuard`
- [ ] Tests del módulo `auth` (login, refresh, revocación)
- [ ] Tests del módulo `tenants`
- [ ] Actualizar README con estado actual del proyecto
