# Feature Flags — Best Practices

El feature flagging consiste en permitirle al sistema escoger entre múltiples caminos de ejecución,
generalmente basado en una configuración de flags y teniendo en cuenta algún contexto (como el usuario
que hace una petición). No quita trabajo de implementación: el desarrollador igual escribe el código
de la feature y el condicional. Lo que cambia es que el interruptor queda en manos de quien opera el
negocio, desacoplado de un deploy.

---

## No. 1: Mantener la consistencia de flags

Cuando se prueba con un subset de usuarios (por ejemplo, 10%), estos deben ver siempre lo que habilita
dicha flag sin importar cuántas veces refresquen, y se mantiene así a medida que se amplía el subset
(de 10% a 80%, por ejemplo).

Esto se implementa con **sticky assignment**: hashing determinístico del `userId` + `flagKey`, no con
aleatoriedad pura. De lo contrario, cada evaluación puede dar un resultado distinto para el mismo usuario.

```typescript
// MAL: random, cada evaluación puede dar resultado distinto
const enabled = Math.random() < 0.1;

// BIEN: hash del userId, siempre el mismo resultado para el mismo usuario
const hash = murmurhash(userId + flagKey) % 100;
const enabled = hash < rolloutPercentage;
```

---

## No. 2: Facilitar la transición de "anónimo" a "conectado"

En algunos casos es importante mantener la consistencia de flags cuando un usuario que ya vio cierto
comportamiento como anónimo se loguea. Por ejemplo, en un e-commerce donde se habilita una nueva
funcionalidad de búsqueda para el 20% de usuarios: si el usuario la vio como anónimo, debe seguir
viéndola después de loguearse.

La solución estándar es usar un `visitorId` como cookie y, al momento del login, asociarlo al `userId`:

```
Usuario anónimo llega
    → se genera visitorId como cookie
    → flags se evalúan con ese visitorId
    → usuario se loguea
    → backend asocia visitorId → userId
    → flags siguen siendo consistentes
```

Esta es una feature avanzada. Si todos los usuarios están autenticados antes de ver features importantes,
este caso no aplica todavía.

---

## No. 3: Tomar las decisiones con base en flags del lado del servidor

Las decisiones de negocio basadas en flags deben tomarse en el servidor, no en el cliente. Esto no
significa que todo deba ser SSR, sino que hay distintos niveles de exposición según el caso:

```
SSR: el servidor renderiza HTML con la decisión ya aplicada
     → el cliente nunca sabe qué flags existen
     → máxima seguridad, mínima exposición

CSR con evaluación en backend propio: el frontend hace un request al backend
     → el backend evalúa la flag y devuelve la respuesta ya condicionada
     → el cliente ve el resultado pero no la flag en sí

CSR con SDK de frontend: el frontend llama directamente al servicio de flags
     → el cliente sabe qué flags existen y cuáles están activas
     → menor seguridad pero aceptable para features de UX
```

**¿Cómo evitar que alguien haga override de las flags desde el frontend?**

No se puede evitar completamente en el cliente. Cualquier cosa que corra en el browser es manipulable.
La respuesta correcta es: el frontend controla la UI, el backend controla el negocio. Si alguien
manipula una flag en el frontend y logra ver un botón que no debería, cuando haga click el backend
rechaza la operación porque evalúa la flag de forma independiente.

```typescript
// Backend evalúa independientemente del frontend
async processOrder(order: Order) {
  const enabled = await this.flags.isEnabled('checkout_feature');
  if (!enabled) throw new ForbiddenException('Feature unavailable');
  return this.doCheckout(order);
}
```

La exposición de "uso flags" es un riesgo menor. Lo que importa es que la lógica de negocio no sea
bypasseable desde el cliente.

---

## No. 4: Cambios incrementales y compatibles con versiones anteriores en la base de datos

Las feature flags son útiles para sincronizar migraciones de base de datos sin downtime. El patrón
se llama **expand/contract**:

```
Fase 1 (flag apagada):           código escribe en columna vieja
Fase 2 (flag encendida al 10%):  código escribe en ambas columnas
Fase 3 (flag encendida al 100%): código escribe en ambas, lee de la nueva
Fase 4 (flag retirada):          se elimina la columna vieja
```

Cada fase es un deploy independiente. La flag controla cuándo avanzas. Si algo falla, apagas la flag
y vuelves a la fase anterior sin necesidad de revertir el schema.

---

## No. 5: Implementar flags cerca de la lógica de negocio

Se debe implementar la flag en el bounded context adecuado, manteniendo los conceptos y
responsabilidades de forma pura. Si una decisión basada en flag afecta múltiples capas, lo correcto
es **tomar la decisión una sola vez y comunicarla**, no propagar la flag por toda la cadena.

```typescript
// MAL: la flag penetra en la lógica de dominio
async createOrder(userId: string) {
  if (this.flags.isEnabled('new_pricing_engine')) {
    const price = await this.newPricingService.calculate(userId);
  } else {
    const price = await this.legacyPricingService.calculate(userId);
  }
}

// BIEN: la decisión se toma una vez en el borde del sistema
async createOrder(userId: string) {
  const useNewPricing = this.flags.isEnabled('new_pricing_engine');
  const price = await this.pricingService.calculate(userId, { useNewPricing });
  // pricingService no sabe nada de flags
}
```

Esto mantiene las flags en el borde del sistema y evita que contaminen la lógica de dominio pura.

---

## No. 6: Asignar flags por equipo

Aunque se comparta una funcionalidad, si esta se reparte por contexto en varios equipos, lo correcto
es que cada uno gestione su propia flag. Puede que estos equipos estén desacoplados y hacerlo así
evita la colaboración cruzada innecesaria, aunque no sea la opción más obvia.

En la práctica, esto se traduce en que cada proyecto o bounded context tiene sus propias flags y sus
propios responsables, con permisos que controlan quién puede activar qué.

---

## No. 7: Considerar la testeabilidad

Se debe testear con e2e para casos donde la flag esté tanto apagada como encendida. El patrón correcto
es inyectar el cliente de flags como dependencia para poder mockearlo en tests, sin depender del
servicio real de flags:

```typescript
// Inyección de dependencia permite mockear en tests
const mockFlux = {
  isEnabled: (key: string) => key === "new_checkout_flow", // siempre true para esa flag
};

const service = new CheckoutService(mockFlux);

// test con flag encendida
expect(await service.processOrder(order)).toEqual(newFlowResult);

// test con flag apagada
mockFlux.isEnabled = () => false;
expect(await service.processOrder(order)).toEqual(legacyFlowResult);
```

Nunca hardcodear el cliente de flags dentro del servicio. Siempre inyectarlo.

---

## No. 8: Tener un plan para trabajar con flags en escala

A medida que el sistema crece, la gestión de flags se complica. Puntos clave:

### Nombrar bien las flags

Una convención útil es agrupar por `section.feature.layer`. Esto permite filtrar y agrupar visualmente
en el dashboard sin mezclar múltiples decisiones en un solo objeto:

```
admin_panel.new_invite_flow.backend
admin_panel.new_invite_flow.frontend
checkout.new_pricing.backend
checkout.new_pricing.frontend
```

Cada una sigue siendo una flag independiente en la base de datos, con su propio estado, audit log y
control de permisos. La notación con puntos es solo una convención de nombres.

**¿Por qué no un JSON anidado como `{admin_panel: {new_invite_flow: {backend: true}}}`?**

Porque mezcla múltiples decisiones en un solo objeto. Si necesitas activar solo `backend: true` sin
tocar `frontend`, tienes que actualizar el objeto completo. Pierdes granularidad en el audit log,
control de permisos por flag individual, y la capacidad de hacer rollout porcentual independiente
por cada decisión.

### Flags temporales y plan de retiro

Las flags de lanzamiento de un release deben tener fecha de expiración. Una vez que la feature es
permanente, la flag se vuelve deuda técnica. El ciclo de vida de una flag es:

```
active    → la flag está en uso, controlando comportamiento
completed → la feature se lanzó exitosamente, el código ya no tiene el condicional
archived  → la flag existe en el historial pero ya no está en uso
expired   → pasó su fecha de expiración sin ser retirada (flag zombie)
```

### Flags zombie

Son flags que ya cumplieron su propósito pero siguen en el código y en el sistema. Representan deuda
técnica porque el desarrollador que llega nuevo no sabe si puede eliminar el condicional o no.
Marcarlas como `completed` y planificar la eliminación del condicional en el código es parte del
trabajo.

### Trackear responsables

A medida que pasa el tiempo las asignaciones cambian. Una flag que creó un desarrollador para un
lanzamiento puede pasar a ser responsabilidad de ventas o producto. Cada flag debe tener un campo
`owner` que se actualiza cuando cambia la responsabilidad.

### Metadata como key-value pairs

Las flags pueden llevar metadata adicional como pares clave-valor: links a tickets, notas de contexto,
referencias a experimentos. Esto facilita el trabajo en escala cuando hay decenas o cientos de flags.

### Controlar quién activa

Las flags modifican comportamiento en producción y deben tratarse como despliegues productivos. El
permiso `publish:flag` separado de `write:flag` refleja exactamente esto: cualquiera puede editar
una flag, pero solo ciertos roles pueden activarla en producción.

---

## No. 9: Construir un feedback loop

Las flags permiten cambiar el sistema de forma controlada y observar sus impactos. Si una nueva feature
causa crecimiento en conversion rates un 20%, se mantiene el cambio. Si aumenta la latencia
considerablemente, se apaga lo antes posible.

El ciclo es: hacer el cambio → observar los efectos → usar esas observaciones para decidir el próximo
cambio.

Para esto las flags deben integrarse con la capa de analytics y monitoring:

```
Flag activada al 10%
    → métricas de conversión suben 15%
    → latencia p99 se mantiene estable
    → decisión: ampliar al 50%

Flag activada al 50%
    → latencia p99 sube 40ms
    → decisión: apagar, investigar el problema de performance
```

Incluso pueden servir para evaluar consumo de recursos, memoria y procesamiento por feature, lo que
ayuda a tomar decisiones de infraestructura basadas en datos reales.

---

## Resumen de lo que aplica a Flux

| Práctica                             | Estado en Flux          | Próximo paso                  |
| ------------------------------------ | ----------------------- | ----------------------------- |
| Sticky assignment (No. 1)            | Pendiente               | Hash de userId en evaluación  |
| Transición anónimo→conectado (No. 2) | Roadmap                 | visitorId → userId            |
| Server-side enforcement (No. 3)      | Implementado            | Documentar como best practice |
| Expand/contract DB (No. 4)           | Disponible              | Documentar como caso de uso   |
| Flags en bounded context (No. 5)     | Decisión del consumidor | Guía en docs del SDK          |
| Flags por equipo (No. 6)             | Cubierto por roles      | —                             |
| Testeabilidad (No. 7)                | Pendiente               | Ejemplos en docs del SDK      |
| Nombrado con puntos (No. 8)          | Convención              | Documentar en Flux            |
| `expiresAt` y estados (No. 8)        | Pendiente               | Agregar al schema             |
| Campo `owner` (No. 8)                | Pendiente               | Agregar al schema             |
| Feedback loop (No. 9)                | Roadmap                 | Integración con analytics     |
