# Plan de Validacion Completa por Roles — Rescatto v1.0

> **Objetivo:** Verificar que CADA rol tiene acceso UNICAMENTE a lo que le corresponde.
> Cero bugs, cero fugas de permisos, cero pantallas rotas.

---

## Arquitectura de Roles

```
UserRole (types.ts:33-41)
├── SUPER_ADMIN   — Dueno de Rescatto, acceso total
├── ADMIN         — Administrador plataforma
├── CITY_ADMIN    — Admin regional por ciudad
├── VENUE_OWNER   — Dueno de restaurante/negocio
├── KITCHEN_STAFF — Personal de cocina (vista limitada)
├── DRIVER        — Domiciliario
└── CUSTOMER      — Usuario final (+ variante GUEST anonimo)
```

---

## Archivos Clave a Leer

| Archivo | Que contiene |
|---------|-------------|
| `types.ts` (lineas 33-41, 498-584) | Enum UserRole + ROLE_PERMISSIONS map |
| `context/AuthContext.tsx` (lineas 292-310) | hasRole() — logica de verificacion |
| `components/ProtectedRoute.tsx` | Guard de rutas: allowedRoles, disallowGuests, guestRedirect |
| `App.tsx` (lineas 96-514) | RootRedirect, CustomerOnlyLayout, ProfileRedirect, TODAS las rutas |
| `components/Sidebar.tsx` | Menu lateral business/admin (dinamico por rol) |
| `components/customer/layout/DesktopSidebar.tsx` | Sidebar customer (guest vs registrado) |
| `components/admin/SuperAdminRoute.tsx` | Guard adicional para /backoffice/* |
| `components/PermissionGate.tsx` | Gate granular por Permission enum |
| `hooks/usePermissions.ts` | Hook hasPermission/hasAnyPermission/hasAllPermissions |
| `firestore.rules` | Reglas server-side por rol |
| `functions/index.js` + `functions/src/services/` | Validaciones en Cloud Functions |
| `pages/Dashboard.tsx` (lineas 134-172) | Render condicional KITCHEN_STAFF vs otros |

---

## FASE 1: Tests de Enrutamiento y Acceso por Rol

### 1.1 — RootRedirect (App.tsx:96-134)

Verificar que al navegar a `/`, cada rol es redirigido correctamente:

| Rol | Redirige a | Archivo referencia |
|-----|-----------|-------------------|
| SUPER_ADMIN | `/backoffice/dashboard` | App.tsx:120 |
| ADMIN | `/backoffice/dashboard` | App.tsx:120 |
| CITY_ADMIN | `/regional-dashboard` | App.tsx:124 |
| VENUE_OWNER | `/dashboard` | App.tsx:128 |
| KITCHEN_STAFF | `/dashboard` | App.tsx:128 |
| DRIVER | `/driver` | App.tsx:126 |
| CUSTOMER | `/app` | App.tsx:131 |
| GUEST (anonimo) | `/app` | App.tsx:131 |
| No autenticado | `/login` | ProtectedRoute.tsx:24 |
| No verificado | `/verify-email` | ProtectedRoute.tsx:39 |

**Test:** Renderizar `<RootRedirect />` con cada mock de rol y verificar `<Navigate to="..." />`.

### 1.2 — ProfileRedirect (App.tsx:256-275)

Verificar que `/profile` redirige segun rol:

| Rol | Redirige a |
|-----|-----------|
| CUSTOMER | `/app/profile` |
| DRIVER | `/driver/profile` |
| SUPER_ADMIN / ADMIN | `/admin/profile` |
| CITY_ADMIN | `/regional-dashboard/profile` |
| VENUE_OWNER / KITCHEN_STAFF | `/dashboard/profile` |

### 1.3 — CustomerOnlyLayout (App.tsx:234-253)

Verificar que rutas `/app/*` bloquean roles no-CUSTOMER:

| Rol | Resultado esperado |
|-----|-------------------|
| CUSTOMER | Renderiza normalmente |
| GUEST | Renderiza normalmente |
| VENUE_OWNER | Redirige a `/dashboard` |
| DRIVER | Redirige a `/driver` |
| SUPER_ADMIN | Redirige a `/backoffice/dashboard` |
| ADMIN | Redirige a `/backoffice/dashboard` |
| KITCHEN_STAFF | Redirige a `/dashboard` |

---

## FASE 2: Matriz Completa de Acceso a Rutas

### 2.1 — Rutas Business

Para cada ruta, verificar acceso permitido y denegado:

| Ruta | Roles PERMITIDOS | Roles DENEGADOS (redirigen a `/`) |
|------|-----------------|----------------------------------|
| `/dashboard` | VENUE_OWNER, SUPER_ADMIN, KITCHEN_STAFF | ADMIN, CITY_ADMIN, DRIVER, CUSTOMER |
| `/products` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/orders` | VENUE_OWNER, KITCHEN_STAFF, SUPER_ADMIN | ADMIN, CITY_ADMIN, DRIVER, CUSTOMER |
| `/order-management` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/analytics` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/settings` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/tech-docs` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/finance` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/flash-deals` | VENUE_OWNER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/dashboard/profile` | VENUE_OWNER, SUPER_ADMIN, KITCHEN_STAFF | ADMIN, CITY_ADMIN, DRIVER, CUSTOMER |

**Test por cada fila:** Mockear useAuth con cada rol, renderizar `<ProtectedRoute allowedRoles={[...]}><Page /></ProtectedRoute>`, verificar que roles permitidos ven contenido y roles denegados ven redirect a `/`.

### 2.2 — Rutas Admin Legacy

| Ruta | Roles PERMITIDOS | Roles DENEGADOS |
|------|-----------------|----------------|
| `/admin` | SUPER_ADMIN | ADMIN, CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/admin/users` | SUPER_ADMIN, ADMIN | CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/admin/venues` | SUPER_ADMIN, ADMIN | CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/admin/categories` | SUPER_ADMIN, ADMIN | CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/admin/audit-logs` | SUPER_ADMIN | Todos los demas |
| `/admin/finance` | SUPER_ADMIN | Todos los demas |
| `/admin/commissions` | SUPER_ADMIN | Todos los demas |
| `/admin/deliveries` | SUPER_ADMIN | Todos los demas |
| `/admin/sales` | SUPER_ADMIN | Todos los demas |
| `/admin/settings` | SUPER_ADMIN | Todos los demas |
| `/admin/subscriptions` | SUPER_ADMIN, ADMIN | CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| `/admin/payment-settings` | SUPER_ADMIN | Todos los demas |
| `/admin/profile` | SUPER_ADMIN, ADMIN | CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |

### 2.3 — Rutas Backoffice V2

| Ruta | Roles PERMITIDOS | Guard |
|------|-----------------|-------|
| `/backoffice/*` (todas) | SUPER_ADMIN, ADMIN | SuperAdminRoute (components/admin/SuperAdminRoute.tsx) |

**Sub-rutas:** dashboard, users, venues, audit, finance, commissions, subscriptions, payment-settings, settings.

**Test:** Verificar que SuperAdminRoute permite SUPER_ADMIN y ADMIN, y bloquea todos los demas.

### 2.4 — Rutas Driver

| Ruta | Roles PERMITIDOS | Roles DENEGADOS |
|------|-----------------|----------------|
| `/driver` | DRIVER, SUPER_ADMIN | ADMIN, CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, CUSTOMER |
| `/driver/profile` | DRIVER, SUPER_ADMIN | ADMIN, CITY_ADMIN, VENUE_OWNER, KITCHEN_STAFF, CUSTOMER |

### 2.5 — Rutas Customer

| Ruta | Roles PERMITIDOS | Guest? | disallowGuests? |
|------|-----------------|--------|----------------|
| `/app` (Home) | CUSTOMER, GUEST | Si | No |
| `/app/venue/:id` | CUSTOMER, GUEST | Si | No |
| `/app/explore` | CUSTOMER, GUEST | Si | No |
| `/app/product/:id` | CUSTOMER, GUEST | Si | No |
| `/app/cart` | CUSTOMER, GUEST | Si | No |
| `/app/checkout` | CUSTOMER, GUEST | Si | No |
| `/app/orders` | CUSTOMER | **No** | **Si** → redirige a `/app/profile` |
| `/app/profile` | CUSTOMER | Si | No |
| `/app/favorites` | CUSTOMER | **No** | **Si** → redirige a `/app/profile` |
| `/app/impact` | CUSTOMER | **No** | **Si** → redirige a `/app/profile` |

### 2.6 — Ruta Chat

| Ruta | Roles PERMITIDOS | Roles DENEGADOS |
|------|-----------------|----------------|
| `/chat` | CUSTOMER, VENUE_OWNER, DRIVER, SUPER_ADMIN | ADMIN, CITY_ADMIN, KITCHEN_STAFF |

### 2.7 — Ruta Regional

| Ruta | Roles PERMITIDOS | Roles DENEGADOS |
|------|-----------------|----------------|
| `/regional-dashboard` | CITY_ADMIN, SUPER_ADMIN | ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |

---

## FASE 3: Sidebar y Menu por Rol

### 3.1 — Sidebar Business/Admin (components/Sidebar.tsx)

Verificar que CADA seccion del menu se muestra/oculta correctamente:

#### VENUE_OWNER con venueId/venueIds:
- [x] Dashboard (link a `/dashboard`)
- [x] Pedidos (KDS) — seccion Operaciones
- [x] Productos — seccion Gestion
- [x] Gestion de Pedidos — seccion Gestion
- [x] Analiticas — seccion Gestion
- [x] Flash Deals — seccion Gestion
- [x] Finanzas — seccion Gestion (solo VENUE_OWNER)
- [x] Configuracion — seccion Sistema
- [ ] NO debe ver: Users, Categories, Venues, Audit, Sales, Deliveries, Subscriptions, Payment Settings, Settings globales

#### KITCHEN_STAFF:
- [x] Pedidos (KDS) — seccion Operaciones
- [ ] NO debe ver: Dashboard link, Productos, Gestion Pedidos, Analiticas, Flash Deals, Finanzas, nada Admin

#### DRIVER:
- [x] Entregas (link a `/driver`) — seccion Operaciones
- [ ] NO debe ver: Dashboard, Productos, Gestion, Admin, nada mas

#### SUPER_ADMIN:
- [x] Dashboard
- [x] Pedidos (KDS)
- [x] Productos, Gestion Pedidos, Analiticas, Flash Deals (si tiene venueIds)
- [x] TODA la seccion Admin: Users, Categories, Venues
- [x] TODA la seccion Solo Super: Audit, Finance Global, Commissions, Sales, Deliveries, Subscriptions, Payment Settings, Settings, Docs
- [x] Configuracion

#### ADMIN:
- [x] Seccion Admin: Users, Categories, Venues
- [ ] NO debe ver: seccion Solo Super (Audit, Finance Global, Commissions, etc.)

**Test:** Renderizar `<Sidebar />` con cada rol mockeado y verificar presencia/ausencia de links por `href` o texto.

### 3.2 — Sidebar Customer (components/customer/layout/DesktopSidebar.tsx)

| Elemento | CUSTOMER registrado | GUEST anonimo |
|----------|-------------------|---------------|
| Home | Visible | Visible |
| Explore | Visible | Visible |
| Orders | Visible | Visible (pero ruta lo redirige) |
| Impact | Visible (link a `/app/impact`) | Redirige a `/app/profile` |
| Favorites | Visible | Visible (pero ruta lo redirige) |
| Logout button | Visible | **Oculto** (linea 86: `!user?.isGuest`) |

---

## FASE 4: Dashboard — Render Condicional por Rol

### 4.1 — Dashboard.tsx (pages/Dashboard.tsx)

| Elemento UI | VENUE_OWNER | KITCHEN_STAFF | SUPER_ADMIN |
|-------------|-------------|---------------|-------------|
| Saludo con nombre | Si | Si | Si |
| Cards de metricas (ingresos, pedidos, CO2) | Si | **No** (linea 134) | Si |
| Card "Tu Impacto de Hoy" personalizada | No | **Si** (linea 162) | No |
| Grafica de ingresos (AreaChart) | Si | **No** (linea 172) | Si |
| Acciones rapidas | Si | **No** (linea 172) | Si |
| AI Predictions | Si | No | Si |
| Venue selector (multi-venue) | Si (si tiene >1) | No | Si (si tiene venueIds) |

**Test:** Renderizar `<Dashboard />` con cada rol y verificar presencia/ausencia de elementos clave.

### 4.2 — DriverDashboard (pages/driver/DriverDashboard.tsx)

| Verificacion | Esperado |
|-------------|----------|
| DRIVER ve stats (pedidos completados, ganancia, distancia) | Si |
| DRIVER ve lista de pedidos disponibles | Si |
| DRIVER ve mapa/tracking | Si |
| Carga datos solo si `user.role === DRIVER` (linea 76) | Si |
| SUPER_ADMIN puede acceder via ruta | Si (permitido por ProtectedRoute) |

---

## FASE 5: Guest (Usuario Anonimo) — Restricciones

### 5.1 — Rutas bloqueadas para Guest

El flag `disallowGuests=true` en ProtectedRoute bloquea al guest y redirige a `guestRedirect`:

| Ruta | disallowGuests | guestRedirect | Resultado |
|------|---------------|---------------|-----------|
| `/app/orders` | true | `/app/profile` | Guest ve profile, no orders |
| `/app/favorites` | true | `/app/profile` | Guest ve profile, no favorites |
| `/app/impact` | true | `/app/profile` | Guest ve profile, no impact |

### 5.2 — Audit logging para Guest

Cuando un guest intenta acceder a ruta bloqueada:
- `auditService.logEvent()` debe ser llamado con:
  - `action: UNAUTHORIZED_ACCESS`
  - `details.reason: 'GUEST_FORBIDDEN'`
  - `details.path: window.location.pathname`

**Test:** Verificar que `auditService.logEvent` fue llamado con los parametros correctos.

### 5.3 — UI diferente para Guest

- Sidebar customer: boton logout **oculto** para guest (DesktopSidebar.tsx:86)
- Home: muestra `t('welcome')` en vez de `t('hello', { name })` (no tiene fullName)
- Home: NO muestra gamification pill (streak/multiplier)

---

## FASE 6: PermissionGate y Permisos Granulares

### 6.1 — ROLE_PERMISSIONS (types.ts:498-584)

Verificar que el mapeo es correcto para cada rol:

```
SUPER_ADMIN: TODOS los permisos
ADMIN: VIEW/CREATE/EDIT/DELETE usuarios, venues, productos, ordenes; VIEW analytics global; MANAGE settings
CITY_ADMIN: VIEW usuarios, venues, productos, ordenes locales; VIEW analytics
VENUE_OWNER: EDIT_OWN_VENUE, VIEW/CREATE/EDIT/DELETE productos propios, VIEW/MANAGE ordenes propias, VIEW analytics, EXPORT reports
KITCHEN_STAFF: VIEW productos, VIEW/MANAGE ordenes (de su venue)
DRIVER: VIEW/ACCEPT deliveries
CUSTOMER: VIEW productos, CREATE ordenes (las suyas)
```

**Test:** Para cada rol, instanciar `usePermissions()` y verificar `hasPermission(X)` devuelve true/false segun la tabla.

### 6.2 — PermissionGate component (components/PermissionGate.tsx)

| Prop | Comportamiento |
|------|---------------|
| `requires={Permission.X}` | Renderiza children solo si usuario tiene permiso X |
| `requiresAny={[A, B]}` | Renderiza si tiene A O B |
| `requiresAll={[A, B]}` | Renderiza si tiene A Y B |
| `fallback={<Comp />}` | Muestra fallback si no tiene permiso |
| Sin permiso + sin fallback | No renderiza nada |

**Test:** Renderizar `<PermissionGate>` con diferentes combinaciones de permisos y roles.

---

## FASE 7: Verificacion de Cuenta (isAccountVerified)

### 7.1 — Logica de verificacion (AuthContext.tsx:323-329)

| Caso | isAccountVerified |
|------|-------------------|
| SUPER_ADMIN | Siempre `true` (bypass) |
| Email @test.com | Siempre `true` (bypass desarrollo) |
| Guest (anonimo) | Siempre `true` (no requiere verificacion) |
| CUSTOMER con email verificado + isVerified en Firestore | `true` |
| CUSTOMER con email no verificado | `false` → redirige a `/verify-email` |
| CUSTOMER con email verificado pero !isVerified en Firestore | `false` → redirige a `/verify-email` |

**Test:** Mockear diferentes estados de verificacion y confirmar redireccion a `/verify-email`.

---

## FASE 8: Firestore Rules — Permisos Server-Side

> Estos tests requieren el emulador de Firestore (`firebase emulators:start`).

### 8.1 — Coleccion `users`

| Operacion | SUPER_ADMIN | ADMIN | Owner | Otro | No auth |
|-----------|-------------|-------|-------|------|---------|
| read | Si | Si | Si (propio) | No | No |
| create | - | - | Si (propio) | No | No |
| update | Si | Si | Si (propio) | No | No |
| delete | Si | No | No | No | No |

### 8.2 — Coleccion `venues`

| Operacion | SUPER_ADMIN | ADMIN | VENUE_OWNER (suyo) | VENUE_OWNER (otro) | Autenticado | No auth |
|-----------|-------------|-------|-------------------|-------------------|-------------|---------|
| read | Si | Si | Si | Si | Si | No |
| create | Si | Si | No | No | No | No |
| update | Si | Si | Si | No | No | No |
| delete | Si | Si | No | No | No | No |

### 8.3 — Coleccion `products`

| Operacion | SUPER_ADMIN | ADMIN | VENUE_OWNER (suyo) | VENUE_OWNER (otro) | Auth | No auth |
|-----------|-------------|-------|-------------------|-------------------|------|---------|
| read | Si | Si | Si | Si | Si | No |
| create | Si | Si | Si | No | No | No |
| update | Si | Si | Si | No | No | No |
| delete | Si | Si | Si | No | No | No |

### 8.4 — Coleccion `orders`

| Operacion | SUPER_ADMIN | VENUE (suyo) | KITCHEN (suyo) | DRIVER (asignado) | CUSTOMER (suyo) | Otro |
|-----------|-------------|-------------|---------------|------------------|----------------|------|
| read | Si | Si | Si | Si (pool + asignados) | Si (propias) | No |
| create | No (solo CF) | No | No | No | No | No |
| update | Si | Si (transiciones validas) | Si (transiciones) | Si (transiciones) | Si (cancel/confirm) | No |
| delete | No | No | No | No | No | No |

### 8.5 — Coleccion `flash_deals`

| Operacion | SUPER_ADMIN | ADMIN | VENUE_OWNER (suyo) | Auth | No auth |
|-----------|-------------|-------|-------------------|------|---------|
| read | Si | Si | Si | Si | No |
| create | Si | Si | Si | No | No |
| update | Si | Si | Si | No | No |
| delete | Si | Si | No | No | No |

### 8.6 — Colecciones restringidas

| Coleccion | Regla |
|-----------|-------|
| `wallets` | write: false (solo Cloud Functions) |
| `wallet_transactions` | write: false (solo Cloud Functions) |
| `rate_limits` | all: false |
| `webhook_dedup` | all: false |
| `audit_logs` | read: admin; create: auth; update/delete: false |
| `settings` | read: admin; write: super_admin |
| `roles` | read: admin; write: super_admin |

---

## FASE 9: Cloud Functions — Validaciones Backend

### 9.1 — createOrder (functions/src/services/orderService.js)

- Solo usuarios autenticados
- Rate limit: 10 ordenes / usuario / 10 min
- transactionId unicidad validada
- estimatedCo2 capped a 10kg
- deliveryFee clamped 0-25000

### 9.2 — migrateVenueIdToVenueIds (functions/src/services/adminService.js)

- Solo SUPER_ADMIN puede ejecutar

### 9.3 — generateWompiSignature

- Rate limit: 20/IP/min
- Requiere autenticacion

### 9.4 — redeemPoints

- Rate limit: 3/usuario/hora
- Requiere autenticacion

---

## FASE 10: Audit Logging

Verificar que `auditService.logEvent()` se llama correctamente en:

| Evento | Donde se loguea | Datos esperados |
|--------|----------------|-----------------|
| Guest accede a ruta bloqueada | ProtectedRoute.tsx:29-35 | action: UNAUTHORIZED_ACCESS, reason: GUEST_FORBIDDEN, path |
| Rol insuficiente | ProtectedRoute.tsx:45-50 | action: UNAUTHORIZED_ACCESS, reason: INSUFFICIENT_ROLE, allowedRoles, path |

---

## Estrategia de Implementacion de Tests

### Prioridad 1 (Critico — seguridad):
1. FASE 2: Matriz de acceso a rutas (TODAS las combinaciones rol x ruta)
2. FASE 5: Guest restrictions
3. FASE 7: Verificacion de cuenta
4. FASE 10: Audit logging

### Prioridad 2 (Funcional — UX correcta):
5. FASE 1: RootRedirect + ProfileRedirect + CustomerOnlyLayout
6. FASE 3: Sidebar menus por rol
7. FASE 4: Dashboard render condicional

### Prioridad 3 (Granular):
8. FASE 6: PermissionGate + usePermissions
9. FASE 8: Firestore rules (requiere emulador)
10. FASE 9: Cloud Functions (requiere emulador)

### Patron de Test Recomendado

```typescript
// Helper reutilizable para TODOS los tests de roles
const buildAuthMock = (role: UserRole, overrides = {}) => ({
  user: {
    id: `${role.toLowerCase()}-1`,
    role,
    fullName: `Test ${role}`,
    email: `${role.toLowerCase()}@test.com`,
    isGuest: false,
    venueId: role === UserRole.VENUE_OWNER ? 'venue-1' : undefined,
    venueIds: role === UserRole.VENUE_OWNER ? ['venue-1'] : [],
    ...overrides,
  },
  isAuthenticated: true,
  isLoading: false,
  isAccountVerified: true,
  isEmailVerified: true,
  hasRole: vi.fn((roles: UserRole[]) =>
    roles.includes(role) || role === UserRole.SUPER_ADMIN
  ),
  // ... demas campos del contexto
});

// Patron para test de acceso a ruta
const testRouteAccess = (
  path: string,
  allowedRoles: UserRole[],
  component: React.ReactElement,
) => {
  const allRoles = Object.values(UserRole);

  allowedRoles.forEach(role => {
    it(`${role} PUEDE acceder a ${path}`, () => {
      mockUseAuth.mockReturnValue(buildAuthMock(role));
      render(<ProtectedRoute allowedRoles={allowedRoles}>{component}</ProtectedRoute>);
      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
    });
  });

  allRoles.filter(r => !allowedRoles.includes(r)).forEach(role => {
    it(`${role} NO puede acceder a ${path}`, () => {
      mockUseAuth.mockReturnValue(buildAuthMock(role));
      render(<ProtectedRoute allowedRoles={allowedRoles}>{component}</ProtectedRoute>);
      expect(screen.getByTestId('page-home-redirect')).toBeDefined();
    });
  });
};
```

### Archivos de Test Sugeridos

```
tests/
├── roles/
│   ├── route-access-matrix.test.tsx    — FASE 2 completa (todas las rutas x roles)
│   ├── root-redirect.test.tsx          — FASE 1.1
│   ├── profile-redirect.test.tsx       — FASE 1.2
│   ├── customer-only-layout.test.tsx   — FASE 1.3
│   ├── sidebar-business.test.tsx       — FASE 3.1
│   ├── sidebar-customer.test.tsx       — FASE 3.2
│   ├── dashboard-per-role.test.tsx     — FASE 4
│   ├── guest-restrictions.test.tsx     — FASE 5
│   ├── permission-gate.test.tsx        — FASE 6
│   ├── account-verification.test.tsx   — FASE 7
│   └── audit-logging.test.tsx          — FASE 10
├── firestore-rules/
│   └── security.test.ts               — FASE 8 (requiere emulador)
└── functions/
    └── role-checks.test.js            — FASE 9 (requiere emulador)
```

---

## Checklist Final

- [ ] FASE 1: RootRedirect redirige correctamente para los 7 roles + guest + no-auth
- [ ] FASE 1: ProfileRedirect redirige correctamente para los 7 roles
- [ ] FASE 1: CustomerOnlyLayout bloquea roles no-CUSTOMER
- [ ] FASE 2: TODAS las rutas business verificadas (10 rutas x 7 roles = 70 assertions)
- [ ] FASE 2: TODAS las rutas admin verificadas (13 rutas x 7 roles = 91 assertions)
- [ ] FASE 2: TODAS las rutas backoffice verificadas (9 sub-rutas x 7 roles)
- [ ] FASE 2: Rutas driver verificadas (2 rutas x 7 roles = 14 assertions)
- [ ] FASE 2: Rutas customer verificadas (10 rutas x 2 variantes = 20 assertions)
- [ ] FASE 2: Ruta chat verificada (1 ruta x 7 roles)
- [ ] FASE 2: Ruta regional verificada (1 ruta x 7 roles)
- [ ] FASE 3: Sidebar business muestra items correctos para VENUE_OWNER, KITCHEN_STAFF, DRIVER, SUPER_ADMIN, ADMIN
- [ ] FASE 3: Sidebar customer diferencia CUSTOMER vs GUEST
- [ ] FASE 4: Dashboard muestra/oculta metricas segun KITCHEN_STAFF vs otros
- [ ] FASE 4: DriverDashboard solo carga datos para DRIVER
- [ ] FASE 5: Guest bloqueado en /app/orders, /app/favorites, /app/impact
- [ ] FASE 5: Guest ve UI reducida (sin logout, sin streak, sin nombre)
- [ ] FASE 6: PermissionGate funciona con requires, requiresAny, requiresAll, fallback
- [ ] FASE 6: usePermissions retorna permisos correctos por ROLE_PERMISSIONS
- [ ] FASE 7: isAccountVerified bypass para SUPER_ADMIN, @test.com, guest
- [ ] FASE 7: CUSTOMER sin verificar ve /verify-email
- [ ] FASE 8: Firestore rules siguen la matriz (con emulador)
- [ ] FASE 9: Cloud Functions validan roles correctamente (con emulador)
- [ ] FASE 10: Audit logs registran GUEST_FORBIDDEN e INSUFFICIENT_ROLE
- [ ] TODOS los tests pasan con `npx vitest run`
