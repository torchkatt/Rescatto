# RESCATTO — Plan de Implementación por Capas

> Reorganización del Master Blueprint en capas prácticas e incrementales.
> Cada capa se puede implementar de forma independiente y aporta valor inmediato.
> Items marcados con ✅ ya están implementados. Items con ⚠️ están parciales.

---

## ESTADO ACTUAL DE LA PLATAFORMA

| Área | Estado | Notas |
|------|--------|-------|
| Auth + RLS + Roles | ✅ Completo | Firebase Auth, Firestore rules (358 líneas), 6 roles |
| Rate Limiting | ✅ Completo | 7 endpoints, sliding-window Firestore |
| Webhook Security | ✅ Completo | HMAC-SHA256 + idempotencia atómica |
| CORS | ✅ Completo | Whitelist production |
| Paginación | ⚠️ Parcial | Solo AdminInventory tiene cursor pagination |
| Índices Firestore | ✅ Completo | 15 índices compuestos |
| CI/CD | ⚠️ Básico | GitHub Actions test+build, sin security scanning |
| Tests | ⚠️ Parcial | 58 tests, sin integration/E2E/CF |
| Logging | ⚠️ Parcial | logger.ts básico, sin Sentry ni estructurado |
| Validación | ⚠️ Parcial | Type guards manuales, sin Zod |
| Security Headers | ❌ Falta | Solo COOP, falta CSP/HSTS/X-Frame |
| Error Tracking | ❌ Falta | ErrorBoundary existe pero sin Sentry |
| Feature Flags | ❌ Falta | Sin implementación |
| Search Engine | ❌ Falta | Filtrado client-side |
| Cache Backend | ❌ Falta | Solo Workbox frontend |
| Analytics/Events | ❌ Falta | Sin BigQuery/tracking |
| Fraud Detection | ❌ Falta | Solo transactionId uniqueness |

---

## CAPA 0 — QUICK WINS DE SEGURIDAD (1-2 sesiones)

> Cosas que se pueden hacer rápido y tienen alto impacto en seguridad.

### 0.1 Security Headers en Firebase Hosting
- Configurar `firebase.json` → `hosting.headers`:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- **Archivos**: `firebase.json`

### 0.2 Sanitización HTML
- Instalar `dompurify` + `@types/dompurify`
- Sanitizar contenido en `react-markdown` (product descriptions)
- Crear util `sanitize.ts` reutilizable
- **Archivos**: `package.json`, nuevo `utils/sanitize.ts`, componentes con react-markdown

### 0.3 Validación con Zod en Cloud Functions
- Instalar `zod` en `/functions`
- Crear schemas para los 3 endpoints más críticos:
  - `createOrder` (items, totales, dirección)
  - `generateWompiSignature` (reference, amount, currency)
  - `createNotification` (userId, title, message)
- Reemplazar validaciones manuales por `.parse()` / `.safeParse()`
- **Archivos**: `functions/package.json`, `functions/index.js` (o extraer a `functions/schemas/`)

---

## CAPA 1 — OBSERVABILIDAD (2-3 sesiones)

> Sin observabilidad volamos a ciegas. Prioridad alta.

### 1.1 Sentry para Error Tracking
- Instalar `@sentry/react` en frontend
- Configurar `Sentry.init()` en `main.tsx` con:
  - `dsn` desde env var
  - `environment: import.meta.env.MODE`
  - `tracesSampleRate: 0.1` (10% en prod)
- Conectar `ErrorBoundary` existente con `Sentry.captureException()`
- **Archivos**: `package.json`, `main.tsx`, `components/ErrorBoundary.tsx`

### 1.2 Logging Estructurado en Cloud Functions
- Reemplazar `console.log/error` con Cloud Logging estructurado:
  ```js
  const { log, error, warn } = require("firebase-functions/logger");
  ```
- Agregar contexto a cada log: `{ userId, orderId, action, timestamp }`
- **Archivos**: `functions/index.js`

### 1.3 Auditoría de Acciones Críticas
- Verificar que `audit_logs` collection registra:
  - Login exitoso/fallido
  - Cambio de rol
  - Creación/cancelación de orden
  - Pagos procesados
  - Cambios en configuración admin
- Agregar logs faltantes en Cloud Functions
- **Archivos**: `functions/index.js`, `firestore.rules`

### 1.4 Health Check Endpoint
- Crear Cloud Function `healthCheck` (onRequest, público)
- Retorna: `{ status: "ok", timestamp, region, version }`
- Útil para monitoreo externo (UptimeRobot, etc.)
- **Archivos**: `functions/index.js`

### 1.5 Alertas Básicas
- Configurar Cloud Monitoring alerts para:
  - Error rate > 5% en Cloud Functions
  - Latencia P95 > 5s
  - Cloud Function failures
- Notificación por email al admin
- **Archivos**: Configuración en Google Cloud Console (no código)

---

## CAPA 2 — VALIDACIÓN Y ESTABILIDAD (2-3 sesiones)

> Hacer el backend robusto antes de agregar features.

### 2.1 Zod Schemas Completos
- Extender schemas de Capa 0 a TODOS los Cloud Functions:
  - `redeemPoints`, `resolveVenueChatTarget`, `ensureReferralCode`
  - `wompiWebhook` (payload validation)
  - `migrateVenueIdToVenueIds`
- Crear `functions/schemas.js` con todos los schemas centralizados
- **Archivos**: `functions/schemas.js` (nuevo), `functions/index.js`

### 2.2 Zod Schemas Frontend
- Instalar `zod` en frontend
- Validar datos de Firestore al leerlos (defensive parsing)
- Schemas para: `Venue`, `Product`, `Order`, `User` profile
- Reemplazar `isCartItem()` type guard por Zod schema
- **Archivos**: `package.json`, nuevo `schemas/` directorio, `context/CartContext.tsx`

### 2.3 Manejo Centralizado de Errores en CF
- Crear helper `handleError(error, context)` que:
  - Loguea con contexto estructurado
  - Retorna HttpsError apropiado
  - Clasifica errores (validation, auth, external, internal)
- Reemplazar try-catch repetitivos
- **Archivos**: `functions/index.js` (o extraer a `functions/utils/`)

### 2.4 Tests de Cloud Functions
- Instalar `firebase-functions-test`
- Tests para:
  - `createOrder` (happy path + validación + rate limit)
  - `wompiWebhook` (signature valid/invalid, idempotencia)
  - `redeemPoints` (balance insuficiente, rate limit)
- **Archivos**: `functions/package.json`, nuevo `functions/tests/`

### 2.5 Tests de Firestore Rules
- Instalar `@firebase/rules-unit-testing`
- Tests para:
  - Lectura/escritura por rol (CUSTOMER, VENUE_OWNER, ADMIN)
  - Bloqueo de escritura directa a orders/wallets
  - Validación de campos (rating 1-5, etc.)
- **Archivos**: nuevo `tests/firestore-rules/`

---

## CAPA 3 — CLOUD FUNCTIONS REFACTOR (3-4 sesiones)

> El archivo tiene 1,659 líneas. Necesita modularización.

### 3.1 Extraer Servicios
- Crear estructura modular:
  ```
  functions/
    src/
      services/
        orderService.js
        paymentService.js
        notificationService.js
        rewardService.js
        chatService.js
        userService.js
      schemas/
        orderSchema.js
        paymentSchema.js
      utils/
        rateLimit.js
        errorHandler.js
        logger.js
      index.js  (solo exports)
  ```
- Mover lógica de negocio a servicios
- `index.js` queda como router/entry point
- **Archivos**: reestructuración completa de `functions/`

### 3.2 Timeouts y Retry Policy
- Configurar timeouts explícitos por función:
  - `createOrder`: 30s
  - `wompiWebhook`: 15s
  - `applyDynamicPricing`: 120s (scheduled)
  - Default: 60s
- Implementar retry con backoff para llamadas externas (Wompi, SendGrid)
- **Archivos**: `functions/src/` (post-refactor)

### 3.3 Validación de Entrada Unificada
- Middleware pattern: cada Cloud Function pasa por:
  1. Auth check
  2. Rate limit check
  3. Zod validation
  4. Business logic
  5. Structured response
- **Archivos**: `functions/src/utils/middleware.js` (nuevo)

---

## CAPA 4 — BASE DE DATOS (2-3 sesiones)

### 4.1 Optimizar Queries
- Auditar todos los `where()` + `orderBy()` en services/
- Asegurar que cada query tiene índice compuesto
- Eliminar queries que hacen full-collection scans
- **Archivos**: `services/*.ts`, `firestore.indexes.json`

### 4.2 Paginación Universal
- Implementar cursor pagination en:
  - `MyOrders` (actualmente usa onSnapshot sin límite)
  - `VenueDetail` productos (carga todos)
  - `AdminSales`, `AdminDeliveries`
  - `AuditLogs` (ya tiene parcial)
- Crear hook reutilizable `usePaginatedQuery()`
- **Archivos**: nuevo `hooks/usePaginatedQuery.ts`, pages afectadas

### 4.3 Distributed Counters
- Para contadores de alta escritura:
  - Total de órdenes por venue
  - Total de usuarios activos
  - Contadores de productos vendidos
- Implementar sharded counters o usar `increment()` con transacciones
- **Archivos**: `functions/src/services/`, nuevo `utils/counters.ts`

### 4.4 Limpieza de Datos
- Script/Cloud Function para:
  - Limpiar `rate_limits` expirados (> 24h)
  - Limpiar `webhook_dedup` antiguos (> 7 días)
  - Detectar órdenes huérfanas (sin venue válido)
  - Detectar usuarios sin actividad > 1 año (para GDPR)
- **Archivos**: nueva Cloud Function `cleanupData` (scheduled)

---

## CAPA 5 — RENDIMIENTO (2-3 sesiones)

### 5.1 Optimizar Listeners
- Auditar uso de `onSnapshot` en toda la app
- Reemplazar listeners innecesarios por `getDoc`/`getDocs`
- Centralizar listeners activos para evitar memory leaks
- **Archivos**: `pages/`, `context/`, `services/`

### 5.2 Cache Frontend Inteligente
- Implementar cache en memoria para datos semi-estáticos:
  - Venues list (TTL: 5 min)
  - Categories (TTL: 30 min)
  - User profile (TTL: 10 min)
- Crear `utils/queryCache.ts` con TTL y invalidación
- **Archivos**: nuevo `utils/queryCache.ts`, `services/`

### 5.3 Lazy Loading
- Code splitting por rutas con `React.lazy()`:
  - Admin pages (bundle separado)
  - Business pages (bundle separado)
  - Driver pages (bundle separado)
- Optimizar bundle size: analizar con `vite-bundle-visualizer`
- **Archivos**: `App.tsx`, rutas

### 5.4 Optimizar Carga Inicial
- Preload de datos críticos en `App.tsx`
- Service Worker: precache de assets críticos
- Optimizar imágenes: WebP + lazy loading nativo
- **Archivos**: `App.tsx`, `vite.config.ts`

---

## CAPA 6 — ANTIFRAUDE (2-3 sesiones)

### 6.1 Métricas de Fraude
- Crear colección `fraud_metrics` en Firestore:
  ```
  {
    userId, ip, deviceFingerprint,
    ordersLastHour, ordersLastDay,
    promoUsageCount, accountAge,
    flaggedAt, riskScore
  }
  ```
- Cloud Function que actualiza métricas en cada orden
- **Archivos**: `functions/src/services/fraudService.js`, `firestore.rules`

### 6.2 Detección de Abuso de Promociones
- 1 promoción por usuario + 1 por dispositivo
- Tracking de device fingerprint (FingerprintJS lite)
- Bloquear si > N promociones en período
- **Archivos**: `functions/src/services/fraudService.js`, frontend fingerprint util

### 6.3 Detección de Órdenes Sospechosas
- Flags automáticos:
  - > 5 órdenes/hora del mismo usuario
  - Orden > 500,000 COP
  - Dirección de entrega > 20km del venue
  - Cuenta creada hace < 1 hora con orden grande
- Dashboard admin para revisar flags
- **Archivos**: CF fraud service, nueva página admin

### 6.4 Detección de Cuentas Duplicadas
- Comparar por: email normalizado, IP, device fingerprint
- Flag en `fraud_metrics` si coincide
- Alert al admin
- **Archivos**: CF fraud service

---

## CAPA 7 — DEVOPS Y CALIDAD (2-3 sesiones)

### 7.1 Staging Environment
- Crear proyecto Firebase separado para staging
- Configurar env vars por ambiente
- Deploy automático a staging en PR merge
- **Archivos**: `.firebaserc`, `firebase.json`, `.github/workflows/`

### 7.2 Security Scanning en CI
- Agregar a GitHub Actions:
  - `npm audit` check (fail on high/critical)
  - ESLint security plugin (`eslint-plugin-security`)
  - Dependabot alerts
- **Archivos**: `.github/workflows/ci.yml`, `.eslintrc`

### 7.3 Tests Automáticos Mejorados
- Pre-commit hooks con Husky:
  - Lint
  - Type check
  - Tests afectados
- Coverage mínimo: 70% en archivos modificados
- **Archivos**: `package.json`, nuevo `.husky/`

### 7.4 Backups Automáticos
- Configurar Firestore scheduled exports:
  - Cloud Function scheduled diaria → export a Cloud Storage bucket
  - Retención: 30 días
  - Test de restore mensual (documentar proceso)
- **Archivos**: nueva CF `scheduledBackup`

---

## CAPA 8 — FEATURE FLAGS + ANALYTICS (2-3 sesiones)

### 8.1 Feature Flags Simple
- Implementar con Firestore collection `feature_flags`:
  ```
  { name, enabled, percentage, allowedRoles, description }
  ```
- Hook `useFeatureFlag(name)` que lee de Firestore (cached)
- Admin UI para toggle flags
- Casos de uso inmediatos:
  - Dynamic pricing on/off
  - Flash deals on/off
  - Nuevo checkout flow
- **Archivos**: nuevo `hooks/useFeatureFlag.ts`, `services/featureFlagService.ts`, admin page

### 8.2 Event Tracking Básico
- Firebase Analytics (ya incluido en SDK):
  - `logEvent('order_created', { venueId, total, items })`
  - `logEvent('payment_completed', { method, amount })`
  - `logEvent('deal_viewed', { dealId, venueId })`
  - `logEvent('user_registered', { method })`
- Wrapper `utils/analytics.ts` para centralizar
- **Archivos**: nuevo `utils/analytics.ts`, páginas clave

### 8.3 Dashboard de Métricas de Negocio
- Exportar Firebase Analytics → BigQuery (configuración en console)
- Métricas clave:
  - Conversión: visitantes → órdenes
  - Retención: usuarios activos por semana
  - Revenue por venue
  - Ticket promedio
- **Archivos**: configuración en Firebase Console + BigQuery

---

## CAPA 9 — BÚSQUEDA Y CACHE (3-4 sesiones)

### 9.1 Search Engine
- Evaluar: Algolia (managed, más fácil) vs Meilisearch (self-hosted, más barato)
- Recomendación: **Algolia** para MVP, migrar a Meilisearch en escala
- Índices: `products` (nombre, categoría, venue, precio), `venues` (nombre, ciudad, categoría)
- Sync: Cloud Function trigger en write a products/venues → actualiza Algolia
- Frontend: `react-instantsearch` para búsqueda con filtros
- **Archivos**: `functions/src/services/searchService.js`, nuevo `components/Search/`

### 9.2 Cache Backend (Redis)
- Cloud Memorystore (Redis) para:
  - Venues populares (TTL: 5 min)
  - Productos por venue (TTL: 2 min)
  - Config/settings (TTL: 10 min)
- Reducir lecturas Firestore en endpoints de alto tráfico
- **Archivos**: `functions/src/utils/cache.js`, servicios que lean datos frecuentes

---

## CAPA 10 — UX Y PRODUCTO (2-3 sesiones)

### 10.1 Manejo de Errores UX
- Componente `ErrorState` reutilizable con:
  - Mensaje amigable
  - Botón retry
  - Reportar problema (→ Sentry)
- Reemplazar errores genéricos en toda la app
- **Archivos**: nuevo `components/ErrorState.tsx`, páginas

### 10.2 Retry en Operaciones
- Hook `useRetry(fn, options)` para operaciones de red
- Aplicar en: crear orden, cargar venues, cargar productos
- Backoff exponencial: 1s, 2s, 4s, max 3 intentos
- **Archivos**: nuevo `hooks/useRetry.ts`, páginas clave

### 10.3 Optimización Mobile
- Auditar performance mobile con Lighthouse
- Targets: Performance > 80, Accessibility > 90
- Fix: font loading, image optimization, touch targets
- **Archivos**: componentes según hallazgos

### 10.4 SEO Básico
- Meta tags dinámicos por ruta (react-helmet-async)
- OpenGraph tags para compartir venues/deals
- Sitemap.xml generado
- **Archivos**: `package.json`, `App.tsx`, nuevo `utils/seo.ts`

---

## CAPA 11 — EXPANSIÓN (futuro)

> Estas capas son para cuando la plataforma tenga tracción real.

### 11.1 Multi-ciudad
- Filtro de ciudad en venues query
- Location-based search
- Configuración por ciudad (delivery fees, zonas)

### 11.2 Multi-moneda / Multi-idioma
- i18n con `react-i18next`
- Moneda configurable por país
- Formatos de fecha/número localizados

### 11.3 Event Architecture
- Pub/Sub para eventos de dominio
- Desacoplar notificaciones de lógica de órdenes
- Cola de tareas para procesamiento asíncrono

### 11.4 Microservicios Graduales
- Separar CF en servicios independientes por dominio
- API Gateway para routing
- Deployments independientes

---

## CAPA 12 — MADUREZ (futuro avanzado)

### 12.1 A/B Testing + Depliegues Graduales
### 12.2 Circuit Breakers + Degradación Controlada
### 12.3 Penetration Testing + Auditoría Externa
### 12.4 Documentación de APIs + Arquitectura para inversión

---

## ORDEN DE EJECUCIÓN RECOMENDADO

```
Capa 0  →  Quick Wins Seguridad        [PRIMERO — protege lo que ya existe]
Capa 1  →  Observabilidad              [ver qué pasa en producción]
Capa 2  →  Validación + Estabilidad    [hacer el backend robusto]
Capa 3  →  CF Refactor                 [deuda técnica — facilita todo lo demás]
Capa 4  →  Base de Datos               [performance y limpieza]
Capa 5  →  Rendimiento                 [UX rápida]
Capa 6  →  Antifraude                  [proteger el negocio]
Capa 7  →  DevOps                      [automatización y calidad]
Capa 8  →  Feature Flags + Analytics   [datos para decisiones]
Capa 9  →  Search + Cache              [escala]
Capa 10 →  UX + Producto               [crecimiento]
Capa 11 →  Expansión                   [cuando haya tracción]
Capa 12 →  Madurez                     [empresa establecida]
```

---

## NOTAS

- Cada capa estima 2-4 sesiones de trabajo
- Las capas 0-2 son **críticas** para ir a producción real con usuarios
- Las capas 3-7 son para **estabilidad y crecimiento**
- Las capas 8-10 son para **escala y producto**
- Las capas 11-12 son **futuro** cuando haya tracción

> Documento generado: 2026-03-12
> Basado en: auditoría técnica completa del codebase actual
