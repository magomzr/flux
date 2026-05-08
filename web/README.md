# flux-frontend

Dashboard web para gestión de feature flags. Construido con Angular 21 + Tailwind CSS v4. Diseño minimalista orientado a la acción — activar un flag debe tomar dos clics, no cinco pantallas.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Angular 21 |
| Build | Vite (`@angular/build`) |
| Estilos | Tailwind CSS v4 |
| Estado | Signals + `computed` + `effect` |
| HTTP | `HttpClient` con interceptors |
| Routing | Angular Router con lazy loading |
| Testing | Vitest |

---

## Principios de desarrollo

### Angular moderno — sin excepciones

- **Standalone components** en todo. Sin `NgModule`.
- **Signals** para estado local y derivado. Sin `BehaviorSubject` para estado de UI.
- **`inject()`** en lugar de constructor injection donde sea posible.
- **`input()` / `output()`** signal-based en lugar de `@Input()` / `@Output()`.
- **`@if` / `@for` / `@switch`** (control flow blocks) en lugar de `*ngIf` / `*ngFor`.
- **`toSignal()`** para convertir Observables a Signals en componentes.
- Lazy loading en todas las rutas con `loadComponent`.

### Lo que NO usamos

- `NgModule` — no existe en este proyecto.
- `BehaviorSubject` / `Subject` para estado de UI — usar signals.
- `*ngIf`, `*ngFor`, `*ngSwitch` — usar `@if`, `@for`, `@switch`.
- `@Input()` / `@Output()` decorators — usar `input()` / `output()`.
- `ChangeDetectorRef` — signals maneja la detección automáticamente.
- `async` pipe para estado local — usar `toSignal()`.

### Estructura de archivos

```
src/app/
├── core/
│   ├── auth/           # AuthService, guard, interceptor
│   ├── api/            # Servicios HTTP por dominio
│   └── models/         # Interfaces y tipos
├── shared/
│   └── ui/             # Componentes reutilizables (Button, Badge, Table, etc.)
└── features/
    ├── login/
    ├── tenants/         # Solo super_admin / ops
    ├── projects/
    ├── environments/
    ├── flags/           # Core del producto
    ├── billing/
    ├── audit/
    └── sdk-keys/
```

### Convenciones de nombrado

- Archivos: `kebab-case.ts` — `flag-list.ts`, `auth.service.ts`
- Clases/Componentes: `PascalCase` — `FlagList`, `AuthService`
- Signals: nombre sin prefijo — `flags = signal([])`, no `flags$` ni `flagsSignal`
- Servicios: siempre `providedIn: 'root'` salvo casos específicos

### Estilos

- Tailwind v4 utility-first. Sin CSS custom salvo casos excepcionales.
- Sin frameworks de componentes externos — construimos los nuestros.
- Paleta: neutros (zinc/slate) como base, un color de acento (indigo o similar).
- Diseño minimalista tipo Vercel/Linear — denso en información, limpio en presentación.

---

## Autenticación

- JWT guardado en `localStorage` (primera iteración).
- Refresh token en `localStorage` — rotación automática via interceptor.
- `AuthGuard` protege todas las rutas excepto `/login`.
- El JWT incluye `role` y `permissions` — el guard y los componentes los leen directamente sin llamadas extra a la API.

---

## Modelo de acceso por rol

| Rol | Acceso |
|---|---|
| `super_admin` | Gestión de tenants, planes, billing global. No accede al dashboard de ningún tenant. |
| `ops` | Lectura global para monitoreo. Solo lectura. |
| `tenant_admin` | Acceso completo dentro de su tenant. |
| `developer` | Flags, proyectos, ambientes, assets. Sin billing. |
| `editor` | Crear y editar flags. No puede publicar a producción. |
| `viewer` | Solo lectura. |

---

## Comandos

```bash
pnpm start          # dev server en localhost:4200
pnpm build          # build de producción
pnpm test           # tests con vitest
```
