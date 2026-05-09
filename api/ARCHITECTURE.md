# Flux — Architecture & Deployment on AWS

Este documento es una guía honesta y práctica sobre cómo desplegar Flux en AWS, cuánto cuesta, qué tiene sentido y qué no, y cómo evoluciona la arquitectura a medida que crece el negocio.

---

## La pregunta honesta primero

> ¿Vale la pena montar todo esto en AWS para 2-4 clientes?

**Respuesta corta: no todavía.**

Para 2-4 tenants con uso moderado, un VPS de $20-40/mes en Railway, Render o Fly.io es suficiente, más barato, y requiere cero gestión de infraestructura. AWS tiene sentido cuando necesitas control fino, compliance, o escala real.

Dicho eso, este documento asume que quieres AWS porque estás construyendo para el futuro y quieres entender el mapa completo desde ya.

---

## Arquitectura objetivo

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Route 53 (DNS)                                             │
│  flux.tudominio.com → ALB                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  ACM (SSL/TLS certificate — gratis)                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  ALB — Application Load Balancer                            │
│  Reglas de routing:                                         │
│    /sdk/*  → Target Group: flux-delivery (Go, futuro)       │
│    /*      → Target Group: flux-api (NestJS)                │
└─────────────────────────────────────────────────────────────┘
    │                    │
    ▼                    ▼
┌──────────────┐  ┌──────────────────────────────────────────┐
│ ECS Fargate  │  │ ECS Fargate                              │
│ flux-api     │  │ flux-delivery (futuro — Go)              │
│ NestJS       │  │ SDK API: /sdk/flags, /sdk/stream         │
│ 0.25vCPU     │  │ 0.25vCPU / 512MB                        │
│ 512MB        │  └──────────────────────────────────────────┘
└──────────────┘
    │
    ├──────────────────────────────────────────────┐
    ▼                                              ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│ RDS PostgreSQL           │  │ ElastiCache Redis              │
│ db.t4g.micro             │  │ cache.t4g.micro                │
│ Single-AZ (dev/staging)  │  │ (post-MVP — invalidación       │
│ Multi-AZ (producción)    │  │  de cache entre instancias)    │
└──────────────────────────┘  └────────────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│ S3 + CloudFront          │
│ Assets estáticos         │
│ (módulo assets — futuro) │
└──────────────────────────┘
```

---

## Servicios usados y por qué

### ECS Fargate — el API

Fargate corre los contenedores sin gestionar servidores. Pagas por vCPU y memoria mientras el contenedor está corriendo.

**Por qué Fargate y no EC2:**
- Sin gestión de instancias, parches, AMIs
- Escala a cero si quieres (aunque para producción conviene tener al menos 1 tarea siempre activa)
- Ideal para cargas predecibles y moderadas como Flux

**Por qué no Lambda:**
- Flux tiene conexiones SSE persistentes — Lambda tiene timeout de 15 minutos y no soporta conexiones largas bien
- El cache en memoria de flags no sobrevive entre invocaciones de Lambda
- Cold starts afectarían la latencia del SDK endpoint

### RDS PostgreSQL — la base de datos

Base de datos gestionada. Backups automáticos, failover, parches de seguridad.

**Por qué no Aurora Serverless:**
- Aurora Serverless v2 tiene un mínimo de 0.5 ACUs (~$43/mes) incluso sin tráfico
- Para Flux con 2-4 tenants, un `db.t4g.micro` es más que suficiente y más barato
- Migrar a Aurora cuando el volumen lo justifique es straightforward

### ElastiCache Redis — cache distribuido

**Cuándo lo necesitas:** cuando tengas más de una instancia de `flux-api` corriendo. El cache de flags vive en memoria de cada instancia — si tienes dos instancias y publicas un flag, solo una invalida su cache. Redis resuelve eso con pub/sub.

**Cuándo NO lo necesitas:** con una sola instancia de Fargate (que es suficiente para empezar), Redis es overhead innecesario. El cache en memoria funciona perfectamente.

### ALB — Application Load Balancer

Necesario para HTTPS y para el routing futuro entre `flux-api` y `flux-delivery` (Go). También maneja health checks y distribución de tráfico entre instancias.

### Route 53 + ACM

DNS gestionado y certificados SSL gratuitos. ACM renueva automáticamente.

### S3 + CloudFront

Para el módulo de assets (futuro). Los archivos que los tenants suben se guardan en S3 y se sirven via CloudFront con URLs firmadas.

---

## Costos reales (us-east-1, Mayo 2025)

### Escenario 1 — MVP / arranque (1 instancia, sin Redis)

| Servicio | Configuración | Costo/mes |
|---|---|---|
| ECS Fargate | 1 tarea × 0.25 vCPU × 0.5 GB, 24/7 | ~$9 |
| RDS PostgreSQL | db.t4g.micro, Single-AZ, 20 GB gp3 | ~$15 |
| ALB | 1 ALB, tráfico bajo (<1 LCU) | ~$18 |
| Route 53 | 1 hosted zone + queries | ~$1 |
| ACM | Certificado SSL | $0 |
| ECR | Almacenamiento de imágenes Docker | ~$1 |
| **Total** | | **~$44/mes** |

Con 2 clientes en plan Studio ($49/mes cada uno) = $98/mes de ingresos. Margen positivo desde el primer cliente.

### Escenario 2 — Crecimiento (2 instancias + Redis)

| Servicio | Configuración | Costo/mes |
|---|---|---|
| ECS Fargate | 2 tareas × 0.5 vCPU × 1 GB | ~$35 |
| RDS PostgreSQL | db.t4g.small, Multi-AZ, 50 GB | ~$60 |
| ElastiCache Redis | cache.t4g.micro | ~$12 |
| ALB | tráfico moderado | ~$20 |
| Route 53 | | ~$1 |
| CloudWatch Logs | | ~$5 |
| **Total** | | **~$133/mes** |

Con 3 clientes Studio + 1 Scale = $147 + $99 = $246/mes. Margen positivo.

### Escenario 3 — Escala (múltiples instancias + delivery Go)

| Servicio | Configuración | Costo/mes |
|---|---|---|
| ECS Fargate (api) | 2 tareas × 1 vCPU × 2 GB | ~$120 |
| ECS Fargate (delivery Go) | 3 tareas × 0.5 vCPU × 1 GB | ~$80 |
| RDS PostgreSQL | db.t4g.medium, Multi-AZ | ~$120 |
| ElastiCache Redis | cache.t4g.small | ~$25 |
| ALB | tráfico alto | ~$30 |
| CloudFront + S3 | assets | ~$15 |
| CloudWatch | logs + métricas | ~$15 |
| **Total** | | **~$405/mes** |

En este punto necesitas ~9 clientes Scale para cubrir infra. Con 10+ clientes es un negocio viable.

---

## El tema del cache y si tiene sentido cobrar

Esta es la pregunta más interesante del documento.

**El cache de Flux tiene dos capas:**

1. **Cache en el servidor** (FlagCacheService): flags en memoria, invalidación por eventos. Costo: 0 extra, ya está en la RAM del contenedor.

2. **Cache en el cliente** (SDK): la SDK mantiene los flags localmente y solo hace polling cada N segundos (según el plan). Esto reduce drásticamente las evaluaciones reales que llegan al servidor.

**¿Tiene sentido cobrar por evaluaciones entonces?**

Sí, pero con matices:

- Una "evaluación" en Flux no es necesariamente un request HTTP. La SDK evalúa flags localmente miles de veces por segundo sin tocar el servidor. Lo que cuenta para billing es el **polling** — cuántas veces la SDK refresca su cache desde el servidor.
- Con polling cada 60s (Starter), un cliente con 1000 usuarios activos genera ~1440 requests/día al servidor. Con polling cada 5s (Scale), son ~17,280 requests/día.
- El costo real de esos requests para ti es casi cero — el endpoint es O(1) desde cache en memoria, p95 de 7ms, 25k req/s de capacidad.

**La conclusión honesta:** cobrar por evaluaciones en Flux es más una señal de valor que un reflejo del costo real de infraestructura. El costo marginal de una evaluación adicional es prácticamente cero. Lo que sí tiene costo real es:
- **SSE**: conexiones persistentes consumen memoria y file descriptors en el servidor
- **Storage de assets**: S3 y CloudFront tienen costo directo
- **Número de proyectos/ambientes**: más datos en DB, más cache en memoria

Por eso el modelo Starter/Studio sin medidores de evaluaciones es honesto — el costo real no está ahí.

---

## Ventajas de esta arquitectura

- **Separación limpia de superficies**: el ALB puede enrutar `/sdk/*` a un servicio Go independiente sin tocar los clientes. El contrato público no cambia.
- **Escala horizontal simple**: agregar instancias de Fargate es un cambio de número en el task definition. El cache se sincroniza via Redis.
- **Sin vendor lock-in en la lógica**: NestJS y Go corren en cualquier contenedor. Si mañana quieres migrar a GCP o a un VPS, el código no cambia.
- **Costos predecibles**: Fargate + RDS tienen precios fijos por hora. No hay sorpresas de factura por picos de tráfico moderados.

## Desventajas y riesgos

- **ALB es caro para tráfico bajo**: $18/mes fijos aunque no haya un solo request. Para el escenario de 2-4 clientes, un NLB o directamente exponer el contenedor via IP pública (con Nginx) es más barato.
- **RDS Multi-AZ duplica el costo**: necesario para producción real, pero para empezar Single-AZ con backups automáticos es suficiente.
- **Fargate es más caro que EC2 a escala**: a partir de ~10 instancias constantes, EC2 con Reserved Instances es significativamente más barato. Pero para empezar, Fargate elimina toda la gestión operativa.
- **SSE y Fargate**: las conexiones SSE son persistentes. Si tienes 500 clientes conectados via SSE y el contenedor se reinicia (deploy, crash), todos reconectan al mismo tiempo. Necesitas graceful shutdown y un timeout de reconexión en la SDK.

---

## Ruta de evolución

```
Hoy (MVP)
  └── 1 Fargate task (NestJS, todo)
  └── RDS t4g.micro Single-AZ
  └── Sin Redis (cache en memoria, 1 instancia)
  └── ALB o directamente via IP
  └── Costo: ~$44/mes

Fase 2 (5-10 clientes)
  └── 2 Fargate tasks (NestJS)
  └── RDS t4g.small Multi-AZ
  └── ElastiCache t4g.micro (Redis pub/sub)
  └── ALB con health checks
  └── Costo: ~$133/mes

Fase 3 (20+ clientes, delivery Go)
  └── flux-api: 2 tasks NestJS (Dashboard API)
  └── flux-delivery: 3 tasks Go (SDK API)
  └── RDS t4g.medium Multi-AZ
  └── ElastiCache t4g.small
  └── CloudFront + S3 (assets)
  └── Costo: ~$405/mes

Fase 4 (escala real)
  └── Auto Scaling en ECS
  └── Aurora PostgreSQL (read replicas)
  └── ElastiCache cluster mode
  └── WAF + Shield (DDoS)
  └── Costo: variable, pero ingresos justifican
```

---

## Recomendación para arrancar

**No uses AWS todavía.** Las opciones más inteligentes para el estado actual de Flux:

### Opción A — Railway (recomendada para arrancar)

Railway cobra por uso real. El plan Hobby cuesta $5/mes y ese valor se aplica directamente al consumo de recursos.

```
Flux en Railway:
  ├── flux-api (NestJS)     ~$5-8/mes  (0.5 vCPU, 512MB)
  ├── PostgreSQL            ~$5-7/mes  (shared, 1GB)
  └── Redis (opcional)      ~$3/mes
  ─────────────────────────────────────
  Total:                    ~$13-18/mes
```

**Ventajas:** deploy desde GitHub en minutos, variables de entorno en UI, logs en tiempo real, sin gestión de infraestructura.
**Desventaja:** si el negocio crece mucho, el costo por recurso es más alto que AWS. Pero ese es un buen problema.

### Opción B — Render

Más predecible en precio. Servicios con precio fijo mensual.

```
Flux en Render:
  ├── flux-api (Starter)    $7/mes
  ├── PostgreSQL (Starter)  $7/mes  (1GB storage)
  └── Redis (Key Value)     $3/mes
  ─────────────────────────────────────
  Total:                    ~$17/mes
```

**Ventaja:** precios fijos, sin sorpresas.
**Desventaja:** el tier Starter hace spin-down después de inactividad (el servicio "duerme"). Para producción necesitas el tier $25/mes que no duerme.

### Opción C — Fly.io

Más control, multi-región cuando lo necesites, Postgres gestionado.

```
Flux en Fly.io:
  ├── flux-api (shared-cpu-1x, 256MB)  ~$3-5/mes
  ├── Managed Postgres (Starter)       ~$29/mes
  └── Redis (Upstash via Fly)          ~$0-5/mes
  ─────────────────────────────────────
  Total:                               ~$32-39/mes
```

**Ventaja:** el mejor camino hacia multi-región cuando el delivery Go necesite estar cerca del cliente.
**Desventaja:** Postgres gestionado es caro en el tier inicial.

### Opción D — Hetzner VPS (máximo ahorro, más trabajo)

Un VPS CX22 en Hetzner cuesta ~€3.79/mes (~$4). Tú gestionas Docker, Nginx, backups y actualizaciones.

```
Flux en Hetzner CX22:
  ├── VPS (2 vCPU, 4GB RAM)   ~$4/mes
  ├── Postgres (en el VPS)    $0 extra
  ├── Redis (en el VPS)       $0 extra
  └── Backups automáticos     ~$1/mes
  ─────────────────────────────────────
  Total:                      ~$5/mes
```

**Ventaja:** el más barato con diferencia. Para 2-4 clientes, un CX22 tiene recursos de sobra.
**Desventaja:** tú eres el ops. Actualizaciones, SSL, monitoreo, backups — todo manual o con scripts propios. No recomendado si no quieres dedicar tiempo a infraestructura.

### Cloudflare — qué sirve y qué no

**Cloudflare Pages:** excelente para el frontend Angular. Deploy gratis, CDN global, SSL automático. Úsalo.

**Cloudflare Workers:** **no sirve para el API NestJS**. Workers es serverless con límites de CPU por request, sin estado persistente entre invocaciones, y sin soporte real para conexiones SSE largas. NestJS no corre bien ahí.

**Cloudflare Workers (futuro delivery Go):** cuando extraigas el módulo de delivery a Go, Workers sí es una opción interesante para el endpoint `/sdk/flags` — es stateless, latencia ultra-baja, edge global. Pero eso es fase 3.

### Decisión recomendada

```
Ahora (MVP, 0-4 clientes):
  API + DB → Railway (~$15-20/mes)
  Frontend → Cloudflare Pages ($0)
  Total: ~$15-20/mes

Fase 2 (5-15 clientes):
  API + DB → Fly.io (~$35-50/mes)
  Frontend → Cloudflare Pages ($0)
  Total: ~$35-50/mes

Fase 3 (15+ clientes, delivery Go):
  API → Fly.io o AWS ECS
  Delivery Go → Cloudflare Workers o Fly.io edge
  DB → Fly.io Postgres o RDS
  Total: variable según escala
```

Migra a AWS cuando un cliente te exija compliance específico (SOC2, HIPAA) o cuando el costo de Railway/Fly.io supere lo que AWS te daría con Reserved Instances. La arquitectura de Flux está diseñada para que esa migración sea transparente.

---

## Variables de entorno adicionales para producción

```env
# AWS
AWS_REGION=us-east-1

# Redis (Escenario 2+)
REDIS_URL=redis://flux-redis.xxxxx.cache.amazonaws.com:6379

# Assets (Escenario 3+)
S3_BUCKET=flux-assets-prod
S3_REGION=us-east-1
CLOUDFRONT_DOMAIN=assets.flux.tudominio.com

# Observabilidad
LOG_LEVEL=info
```

---

*Precios referenciados de AWS us-east-1, Mayo 2025. Sujetos a cambio. Verificar en [aws.amazon.com/pricing](https://aws.amazon.com/pricing) antes de presupuestar.*
