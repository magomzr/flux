# Flux

Feature flag management platform for software development teams. Built to give developers and their clients direct control over what's live in production — without a deploy.

---

## What is Flux

Flux is a multi-tenant SaaS that lets you manage feature flags across projects, environments, and teams. You activate or deactivate features from a dashboard, and your applications pick up the changes in real time via a lightweight SDK.

It was built first as an internal tool — used in production on our own projects — and then offered to clients as part of our software development service. That origin matters: every decision in Flux was made to solve a real problem, not to build features for a pitch deck.

---

## Monorepo structure

```
flux/
├── api/          NestJS backend — Dashboard API + SDK delivery
├── web/          Angular frontend — dashboard UI
├── performance/  k6 load tests for the SDK endpoints
├── BUSINESS.md   Commercial strategy, pricing model, positioning
└── ARCHITECTURE.md  Infrastructure, deployment options, cost breakdown
```

The SDK (`@flux/js`, `@flux/angular`) lives in separate repositories — it's a public npm package with its own release cycle.

---

## Stack

| Layer        | Technology                       |
| ------------ | -------------------------------- |
| Backend      | NestJS + TypeScript              |
| Database     | PostgreSQL (Drizzle ORM)         |
| Auth         | JWT RS256 + bcrypt               |
| Frontend     | Angular 21 (standalone, signals) |
| Styles       | Tailwind CSS v4                  |
| Load testing | k6                               |

---

## Current state

**Done:**

- Multi-tenant architecture with ownership enforcement
- Auth — login, refresh tokens, JWT RS256, family revocation
- Full CRUD: tenants, projects, environments, flags, flag values
- SDK API — in-memory cache (L1/L2), ETag, conditional GET, SSE
- SDK API keys — generation, bcrypt hash, revocation
- Billing — usage tracking, cost forecast
- Audit log — immutable, queryable by entity and action
- Dashboard UI — projects, flags, environments, SDK keys, billing, audit
- Light/dark mode with CSS variables
- k6 load test: p95 = 7ms under 200 VU spike, 25k req/s

**In progress / next:**

- Podman compose for local development
- User management per tenant (CRUD from dashboard)
- Auto-create `tenant_admin` when creating a tenant
- SDK packages (`@flux/js`, `@flux/angular`)

---

## Infrastructure

Flux runs as a single NestJS container with PostgreSQL. No Redis required until you need multiple instances. The SDK delivery module is designed to be extracted to a separate Go service when volume justifies it — the public contract doesn't change.

**Recommended deployment for early stage:** Railway (~$10-15/mo for API + Postgres).
**Frontend:** Cloudflare Pages (free, global CDN).

Cost breakdown by scenario and migration path to AWS: [ARCHITECTURE.md](./api/ARCHITECTURE.md)

---

## Performance

SDK endpoint benchmark (single NestJS instance, in-memory cache):

```
Scenario: 200 VU spike + 50 VU sustained load
p50:  1.72ms
p95:  7.26ms
p99:  7.51ms (spike)
Throughput: 25,345 req/s
Error rate: 0.00%
Cache hit (304): 100%
```

---

## Local development

Requirements: Node.js 22+, pnpm 11+, PostgreSQL 17, Podman (or Docker).

```bash
# Backend
cd api
cp .env.example .env   # fill in DATABASE_URL and JWT keys
pnpm install
pnpm db:migrate
pnpm seed:admin        # creates super_admin (first time only)
pnpm start:dev
```

### `pnpm seed:admin`

Creates the initial `super_admin` user. Run once per new database.

```bash
# Uses ADMIN_EMAIL and ADMIN_PASSWORD from .env:
pnpm seed:admin

# Or pass explicitly:
ADMIN_EMAIL=mario@flux.com ADMIN_PASSWORD=secret123 pnpm seed:admin
```

**Protections:**

- If a `super_admin` already exists → does nothing, logs "already exists"
- Never updates an existing user — insert only
- Password comes from env vars, never hardcoded in source
- Fails if email is already taken by another user

**When to run:**

- First time setting up a new database
- After migrating to a new database URL
- After resetting a development environment
- Never needed when creating tenants (that's automatic via the dashboard)

```bash
# Frontend
cd web
pnpm install
pnpm start
```

Podman compose file coming soon — will spin up Postgres and the API together.

---

## Docs

- [API README](./api/README.md) — backend architecture, modules, roles, schema
- [Web README](./web/README.md) — Angular conventions, component patterns, theming
- [Business strategy](./BUSINESS.md) — pricing, positioning, contract language
- [Architecture & costs](./api/ARCHITECTURE.md) — AWS vs alternatives, cost breakdown, evolution path
