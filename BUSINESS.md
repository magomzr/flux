# Flux — Modelo de negocio y posicionamiento comercial

Este documento es una guía práctica sobre cómo vender Flux, cómo estructurarlo en contratos, y cuál es la ventaja real de ofrecerlo desde una empresa de desarrollo a medida.

---

## Qué es Flux en términos de negocio

Flux no es mantenimiento de código. Es infraestructura de producto.

La analogía correcta no es "te mantengo el software" — es "te proveo una herramienta que hace parte de tu stack operativo", como Stripe para pagos o Twilio para mensajería. El cliente no te paga por horas de trabajo. Te paga porque el servicio está disponible y le entrega valor continuo.

Esa distinción cambia completamente la conversación comercial y justifica un cobro recurrente independiente del contrato de desarrollo.

---

## El mercado de desarrollo a medida — cómo funciona realmente

Los contratos típicos de empresas de desarrollo son "hazme esto y entrégame el código". El cliente se queda con el software y la relación termina ahí, o continúa con un contrato de mantenimiento separado que hay que negociar explícitamente.

El mantenimiento post-entrega sí se cobra, pero como contrato aparte. Las modalidades más comunes:

- **Soporte correctivo** — si algo se rompe, lo arreglamos. Precio fijo mensual o por hora.
- **Soporte evolutivo** — nuevas funcionalidades, ajustes, mejoras. Por horas o sprints.
- **Hosting gestionado** — la empresa de desarrollo despliega y mantiene la infraestructura. Menos común pero existe, especialmente en empresas que no quieren tener equipo de DevOps propio.

Flux encaja en una cuarta categoría que pocas empresas de desarrollo ofrecen: **servicios de plataforma**. No es mantenimiento reactivo ni desarrollo activo — es una herramienta que el cliente usa de forma autónoma y que tú mantienes operativa.

---

## Los tres escenarios de cliente

### Escenario 1 — Tu propio SaaS

Tú construiste un producto propio y lo ofreces al público. Flux es tu capa de configuración interna: activas funcionalidades por segmento de usuarios, haces rollouts graduales, desactivas cosas en producción sin un deploy de emergencia.

Costo: lo absorbes tú. Es parte de tu stack operativo.
Valor: control total sobre tu producto sin depender de un ciclo de deploy.

### Escenario 2 — Clientes de desarrollo a medida

Una empresa te contrata para construir su software. Al entregar, les ofreces Flux como servicio adicional.

El cliente obtiene:
- Control directo sobre funcionalidades de su producto sin necesitar al equipo de desarrollo para cada cambio
- Capacidad de hacer rollouts graduales y revertir en segundos si algo falla
- Un dashboard propio para gestionar su configuración

Tú obtienes:
- Ingreso recurrente mensual independiente del proyecto
- Una razón para mantener la relación con el cliente después de la entrega
- Visibilidad sobre cómo el cliente usa su propio producto

### Escenario 3 — Empresas externas sin relación de desarrollo

Empresas que no son tus clientes de desarrollo pero quieren feature flags. Aquí Flux compite directamente con LaunchDarkly, Unleash, y similares, con la ventaja de ser más simple y más económico.

---

## Cómo posicionarlo en un contrato

No lo metas en el contrato de desarrollo como un ítem más. Sepáralo desde el inicio como una línea de servicio independiente.

**Ejemplo de propuesta:**

> "El desarrollo del software tiene un costo de $X. Adicionalmente, ofrecemos Flux — nuestra plataforma de feature flags — por $49/mes. Flux les permite activar y desactivar funcionalidades en producción sin necesidad de un nuevo deploy, hacer rollouts graduales a un porcentaje de usuarios, y revertir cambios en segundos si algo falla. Esto reduce el riesgo operativo y les da control directo sobre su producto sin depender del equipo de desarrollo para cada ajuste."

Eso es una propuesta de valor clara, no un costo de mantenimiento difuso. El cliente entiende exactamente qué está pagando y por qué.

**Lo que no debes hacer:**

- No lo presentes como "mantenimiento" — eso suena a costo, no a valor
- No lo incluyas gratis en el contrato de desarrollo — eso establece la expectativa de que es parte del servicio base
- No lo vendas como algo técnico — véndelo como control operativo para el negocio

---

## Los planes y a quién van dirigidos

| Plan | Precio | Para quién |
|---|---|---|
| **Starter** | $0 | Tu uso interno. Absorbes el costo como parte de tu operación. |
| **Studio** | $49/mes | Clientes de desarrollo a medida. Precio fijo, sin medidores, sin sorpresas. |
| **Scale** | $99/mes + overage | Empresas externas que contratan Flux directamente como SaaS. |

**Por qué Studio no tiene medidores de evaluaciones:**

El cliente de desarrollo a medida no eligió Flux — tú se lo ofreciste como parte del servicio. Cobrarle overage por usar bien el producto crea fricción y conversaciones incómodas. El precio fijo de $49 es predecible para el cliente y rentable para ti: tu costo de infraestructura por cliente en este tier es ~$5-8/mes, lo que te deja un margen de 85%+.

**Por qué Scale sí tiene medidores:**

Una empresa externa que integra Flux en su propio producto puede generar volúmenes de uso muy variables. Los medidores protegen tu margen cuando el uso escala significativamente.

---

## La ventaja real de tu posición

Una empresa de desarrollo que ofrece su propio SaaS de feature flags tiene algo que ningún freelance ni la mayoría de empresas de desarrollo pueden ofrecer:

**1. Conocimiento profundo del producto**
Construiste Flux. Sabes exactamente cómo funciona, cuáles son sus límites, y cómo integrarlo con cualquier stack. Eso es soporte de primer nivel que ningún proveedor externo puede igualar.

**2. Integración nativa con el desarrollo**
Cuando construyes el software del cliente, puedes integrar Flux desde el día uno — no como un add-on que alguien tiene que configurar después, sino como parte de la arquitectura. Los flags están donde deben estar desde el inicio.

**3. Relación de largo plazo**
Un cliente que usa Flux mensualmente tiene una razón para mantener la relación contigo después de que el proyecto termina. No es solo soporte reactivo — es una dependencia de valor que genera ingreso recurrente predecible.

**4. Diferenciación en la propuesta**
La mayoría de empresas de desarrollo compiten en precio y velocidad. Tú puedes competir en ecosistema: "no solo te construimos el software, te damos las herramientas para operarlo". Eso es una propuesta diferente y más difícil de replicar.

**5. Datos de uso**
Con Flux, tienes visibilidad sobre cómo el cliente usa su propio producto — qué flags están activos, qué ambientes están en uso, cuántas evaluaciones se hacen. Eso te da contexto para proponer mejoras y nuevas funcionalidades con argumentos concretos.

**6. Credibilidad por uso propio**
Flux no es un producto que construiste para vender — es una herramienta que usas tú mismo en tus propios proyectos y desarrollos. Eso es algo que puedes decirle al cliente con total honestidad, y marca una diferencia enorme en la percepción de confianza. No estás vendiendo algo que no conoces. Estás compartiendo algo que ya probaste en producción real.

Ese origen importa en la conversación comercial:

> "Flux es la herramienta que usamos internamente para gestionar los deployments de nuestros propios productos. Cuando vimos que resolvía un problema real, decidimos ofrecerla también a nuestros clientes."

Eso no suena a venta — suena a recomendación. Y las recomendaciones cierran contratos.

---

## Cómo escalar el negocio

El modelo tiene tres palancas de crecimiento:

**Más clientes de desarrollo** → más tenants en Studio → ingreso recurrente que crece con cada proyecto entregado.

**Clientes externos (Scale)** → no requieren relación de desarrollo previa. Se adquieren por marketing directo, referidos, o presencia en comunidades de desarrollo.

**Upsell dentro de clientes existentes** → un cliente que empieza en Studio y crece puede necesitar más proyectos, más ambientes, o funcionalidades del tier Scale. La transición es natural y no requiere una nueva venta.

---

## Números reales para arrancar

| Concepto | Valor |
|---|---|
| Costo de infraestructura (Railway, 1 instancia) | ~$10/mes |
| Primer cliente Studio | $49/mes |
| Margen con 1 cliente | ~$39/mes (80%) |
| Break-even | Desde el primer cliente |
| Con 2 clientes Studio | ~$88/mes de margen neto |
| Con 5 clientes Studio | ~$235/mes de margen neto |
| Con 2 Studio + 1 Scale | ~$177/mes de margen neto |

Estos números asumen que no subes la infraestructura. Con 5-8 clientes probablemente necesitas escalar a ~$25-35/mes de infra, pero el margen sigue siendo amplio.

---

## Lo que Flux no es (y no debes prometer)

- **No es un reemplazo de un sistema de configuración complejo** — para configuraciones muy granulares o targeting avanzado por atributos de usuario, herramientas como LaunchDarkly tienen más features. Flux es deliberadamente simple.
- **No tiene SLA formal todavía** — si un cliente enterprise te pide un SLA de 99.9% con penalidades, necesitas infraestructura más robusta (Multi-AZ, monitoreo, runbooks) antes de comprometerte.
- **No incluye soporte 24/7 por defecto** — define claramente qué incluye el plan: disponibilidad del servicio, no soporte de emergencia a las 3am.

---

## Estrategia de producto — el orden correcto

Flux siguió la estrategia más sólida para construir un producto de software: úsalo tú primero.

**Etapa 1 — Flux para uso interno**
Lo usas en tus propios proyectos y desarrollos. Sufres tus propios problemas, encuentras los edge cases reales, lo mejoras. No estás adivinando qué necesita el mercado — ya sabes qué necesitas tú.

**Etapa 2 — Flux para clientes Studio**
Cuando ya confías en él porque lo probaste en producción propia, lo ofreces a tus clientes de desarrollo como parte del servicio. El riesgo es mínimo porque el producto ya está validado. El cliente recibe algo maduro, no un experimento.

**Etapa 3 — Flux para el mercado externo (Scale)**
Cuando el producto está probado en múltiples contextos reales, lo abres al mercado externo con confianza. Aquí compites con LaunchDarkly, Unleash y similares, con la ventaja de ser más simple, más económico, y con soporte de alguien que realmente conoce el producto.

Cada etapa financia y valida la siguiente. No hay riesgo de venderle algo a un cliente que no funciona, porque ya lo probaste contigo mismo. Y cuando llegues a la etapa 3, tienes casos de uso reales para mostrar — no demos fabricados.

**El siguiente producto sigue el mismo patrón.**
Cuando identifiques el siguiente problema que tienes tú mismo en tus desarrollos — notificaciones, analytics, autenticación — lo construyes primero para ti, lo maduras, y luego lo llevas al cliente. Con el tiempo, eso se convierte en un ecosistema de herramientas que ninguna empresa de desarrollo de la competencia puede replicar fácilmente.

---

*Este documento es interno. Actualizar cuando cambien los planes, precios de infraestructura, o la estrategia comercial.*
