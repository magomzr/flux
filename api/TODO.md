# flux-backend — TODO

## ✅ Completado

### Core

- [x] Arquitectura monolito modular (Dashboard API + SDK API)
- [x] Multi-tenant con ownership check centralizado (`TenantGuard`)
- [x] Auth: JWT RS256, refresh tokens con revocación por familia, change password
- [x] Módulos: tenants, projects, environments, flags, flag-values, sdk-keys, billing, delivery, audit, users
- [x] Billing: planes (Starter/Studio/Scale), suscripciones, usage forecast, seed con upsert
- [x] Delivery: cache en memoria L1/L2, ETag, conditional GET, SSE, usage counter
- [x] Audit: log inmutable con userEmail, consulta por filtros, JSON metadata
- [x] Users: CRUD por tenant, reset password, auto-create admin al crear tenant
- [x] Guards: JWT, Permissions, Tenant ownership, SDK API Key
- [x] Swagger/OpenAPI en `/docs`
- [x] GitHub Actions workflow para tests
- [x] Unit tests: 105 tests, 10 suites, todos los módulos cubiertos
- [x] k6 load test: p95=7ms, 25k req/s bajo spike de 200 VUs
- [x] Modelo on-demand (sin polling por defecto) — documentado en README
- [x] Seed de `super_admin` — `pnpm seed:admin`, lee credenciales de env vars, idempotente

### Decisiones de diseño

- [x] Planes definidos en código con upsert al arrancar (no UI de gestión)
- [x] `pollIntervalSeconds` eliminado — SDK usa on-demand + refresh manual
- [x] Overage solo aplica al plan Scale (Starter/Studio son flat rate)
- [x] Audit log guarda `userEmail` como snapshot inmutable

---

## 🔲 Pendiente

### Próximo — alto valor, bajo esfuerzo

- [ ] **`expiresAt` en flags** — fecha límite para retirar la flag del código. Evita flags zombie.
- [ ] **`owner` en flags** — email del responsable actual. Clarifica quién debe actuar.
- [ ] **Convención de nombrado con `.`** — actualizar regex del DTO de `key` para aceptar puntos (`checkout.new_flow.frontend`). Documentar en README del SDK.
- [ ] **Ejemplos de testing en SDK docs** — patrón de mock con `inject(FluxClient)` para tests unitarios y e2e.
- [ ] **Podman compose** — levantar Postgres + API con un solo comando.

### Próximo — alto valor, más esfuerzo

- [ ] **Sticky assignment en SDK** — hash determinístico de `userId + flagKey` para rollout porcentual consistente. Reactivar `rolloutPct` en el DTO del frontend.
- [ ] **Flag lifecycle states** — `active`, `completed`, `archived`, `expired`. Permite gestionar el ciclo de vida de una flag desde el dashboard.
- [ ] **Metadata key-value en flags** — links a tickets, notas de contexto, referencias a experimentos. Campo flexible tipo `Record<string, string>`.
- [ ] **Cleanup periódico de refresh tokens** — cron job para eliminar tokens expirados.

### Roadmap

- [ ] **`assets`** — upload, storage en R2/S3, URLs firmadas
- [ ] **Redis** — invalidación de cache entre múltiples instancias (necesario con 2+ instancias)
- [ ] **Transición anónimo→conectado** — `visitorId` como cookie, asociación al `userId` en login
- [ ] **Integración con analytics** — feedback loop: flag activa → impacto en métricas → decisión informada
- [ ] **SDK `@flux/angular`** — wrapper con signals reactivos, `toSignal()` del cache

---

## Referencia

- [RESEARCH.md](../RESEARCH.md) — best practices de feature flagging
- [BUSINESS.md](../BUSINESS.md) — modelo comercial y posicionamiento
- [ARCHITECTURE.md](./ARCHITECTURE.md) — infraestructura, costos, deployment
