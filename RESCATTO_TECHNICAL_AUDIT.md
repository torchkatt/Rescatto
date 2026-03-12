# Rescatto — Documento Técnico para Auditoría

> **Fecha de generación:** 2026-03-12
> **Versión:** 0.2.0
> **Repositorio:** https://github.com/torchkatt/Rescatto.git
> **Producción:** https://rescatto.com / https://rescatto-c8d2b.web.app

---

## 1. Información General del Proyecto

| Campo | Detalle |
|-------|---------|
| **Nombre** | Rescatto |
| **Tipo** | Aplicación web progresiva (PWA) — SPA con capacidades offline |
| **Problema que resuelve** | Reduce el desperdicio de alimentos conectando restaurantes/negocios con clientes que compran comida próxima a vencer a precios reducidos |
| **Usuarios objetivo** | Restaurantes, panaderías, supermercados, cafeterías (vendedores) y consumidores finales en Colombia |

### Flujo principal de uso

1. **Negocio** publica productos próximos a vencer con descuento (ej. "Pack Sorpresa" al 50%)
2. **Cliente** abre la app, busca negocios por ciudad, ve productos disponibles con countdown de expiración
3. **Cliente** agrega al carrito, elige método de entrega (recoger, domicilio, donación) y paga (efectivo o tarjeta)
4. **Negocio** recibe la orden en tiempo real, prepara el pedido y actualiza el estado
5. **Conductor** (si es domicilio) acepta la orden, recoge y entrega al cliente
6. **Cliente** recibe el producto, califica al negocio y acumula puntos de impacto ambiental (CO₂ salvado, streaks, leaderboard)
7. **Sistema** ajusta precios dinámicamente según proximidad a vencimiento y gestiona gamificación

---

## 2. Arquitectura Tecnológica

| Componente | Tecnología |
|------------|------------|
| **Frontend** | React 18.2 + TypeScript 5.4 |
| **Bundler** | Vite 5.1 + vite-plugin-pwa 1.2 |
| **Estilos** | TailwindCSS 3.4 |
| **Routing** | React Router DOM 6.22 (HashRouter) |
| **Charts** | Recharts 2.15 |
| **Iconos** | Lucide React 0.344 |
| **Backend** | Firebase Cloud Functions (Node.js 22, Gen2) |
| **Base de datos** | Cloud Firestore (NoSQL, documentos) |
| **Autenticación** | Firebase Authentication (Email/Pass, Google, Apple, Facebook, Anonymous) |
| **Almacenamiento** | Firebase Storage (avatares, uploads) |
| **Hosting** | Firebase Hosting (CDN global) |
| **Pagos** | Wompi (gateway colombiano — tarjeta + PSE) |
| **Email** | SendGrid (emails transaccionales de verificación) |
| **Geocoding** | Nominatim / OpenStreetMap (gratuito, sin API key) |
| **IA** | Google Generative AI / Gemini (pausado para reducir costos) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) + Service Worker |
| **QR Codes** | qrcode.react (referral codes) |
| **CSV Export** | PapaParse |
| **Testing** | Vitest + Testing Library + jsdom (58 tests) |
| **Linting** | TypeScript strict + ESLint (functions) |
| **Git Hooks** | Husky + lint-staged (pre-commit: `tsc --noEmit`) |
| **Contenedores** | No (serverless nativo en Firebase) |
| **CI/CD** | Manual (`firebase deploy`) — sin pipeline automatizado |

### Dependencias principales (frontend)

```
firebase: ^12.8.0
react: ^18.2.0
react-router-dom: ^6.22.3
recharts: ^2.15.4
lucide-react: ^0.344.0
tailwindcss: ^3.4.1
date-fns: ^4.1.0
papaparse: ^5.5.3
qrcode.react: ^4.2.0
```

### Dependencias Cloud Functions

```
firebase-admin: ^12.7.0
firebase-functions: ^5.1.1
crypto-js: ^4.2.0
@sendgrid/mail: ^8.1.6
```

---

## 3. Estructura del Proyecto

```
rescatto-business-dashboard/
│
├── src/
│   ├── App.tsx                          # Router principal + providers + guards
│   ├── index.tsx                        # Entry point
│   ├── types.ts                         # Todos los tipos e interfaces
│   │
│   ├── context/                         # 8 React Context Providers
│   │   ├── AuthContext.tsx              # Autenticación + roles + session
│   │   ├── CartContext.tsx              # Carrito (localStorage + Firestore sync)
│   │   ├── ChatContext.tsx             # Chat real-time (onSnapshot)
│   │   ├── LocationContext.tsx         # GPS + ciudad manual
│   │   ├── NotificationContext.tsx     # Notificaciones in-app + FCM
│   │   ├── ToastContext.tsx            # Toasts UI
│   │   ├── ConfirmContext.tsx          # Diálogos de confirmación
│   │   └── ThemeContext.tsx            # Tema (light/dark)
│   │
│   ├── services/                        # Capa de servicios (Firestore, APIs)
│   │   ├── firebase.ts                 # Inicialización Firebase SDK
│   │   ├── authService.ts             # Login, register, OAuth, guest, email verify
│   │   ├── dataService.ts            # CRUD venues, products, orders, donations
│   │   ├── adminService.ts           # Gestión admin (users, venues, audit, finance)
│   │   ├── chatService.ts            # Chat CRUD + real-time subscriptions
│   │   ├── paymentService.ts         # Wompi signature generation
│   │   ├── ratingService.ts          # Ratings con transacciones atómicas
│   │   ├── flashDealService.ts       # Flash deals CRUD + subscriptions
│   │   ├── messagingService.ts       # FCM token management + foreground
│   │   ├── locationService.ts        # Haversine + Nominatim geocoding
│   │   ├── leaderboardService.ts     # Top rescuers global/ciudad
│   │   ├── productService.ts         # Productos por venue
│   │   ├── venueService.ts           # Venues + expiring products
│   │   ├── driverService.ts          # Servicios del conductor
│   │   ├── walletService.ts          # Wallet del venue
│   │   ├── analyticsService.ts       # Métricas y analytics
│   │   ├── cacheService.ts           # Cache localStorage
│   │   ├── cartSyncService.ts        # Sync carrito localStorage ↔ Firestore
│   │   ├── geminiService.ts          # IA Gemini (pausado)
│   │   └── SeederService.ts          # Datos de prueba (bloqueado en prod)
│   │
│   ├── pages/
│   │   ├── customer/                   # Páginas del cliente
│   │   │   ├── Home.tsx               # Home con venues, deals, trending
│   │   │   ├── VenueDetail.tsx        # Detalle restaurante + productos
│   │   │   ├── ProductDetail.tsx      # Detalle producto
│   │   │   ├── Cart.tsx               # Carrito
│   │   │   ├── Checkout.tsx           # Checkout (cash + card Wompi)
│   │   │   ├── MyOrders.tsx           # Mis pedidos + chat + rating
│   │   │   ├── Impact.tsx             # Gamificación + leaderboard + rewards
│   │   │   ├── Favorites.tsx          # Favoritos
│   │   │   └── Login.tsx              # Login/Register/Forgot password
│   │   │
│   │   ├── business/                   # Páginas del negocio
│   │   │   ├── OrderManagement.tsx    # Gestión de órdenes (KDS)
│   │   │   ├── ProductManager.tsx     # CRUD productos
│   │   │   ├── FlashDealsManager.tsx  # Ofertas relámpago
│   │   │   └── Analytics.tsx          # Analíticas del negocio
│   │   │
│   │   ├── admin/                      # Páginas de administración
│   │   │   ├── SuperAdminDashboard.tsx
│   │   │   ├── UsersManager.tsx       # Gestión usuarios
│   │   │   ├── VenuesManager.tsx      # Gestión sedes
│   │   │   ├── CategoriesManager.tsx  # Categorías
│   │   │   ├── AuditLogs.tsx          # Logs de auditoría
│   │   │   ├── FinanceManager.tsx     # Finanzas plataforma
│   │   │   ├── VenueFinance.tsx       # Finanzas por venue
│   │   │   └── sections/
│   │   │       ├── AdminOverview.tsx   # Dashboard principal
│   │   │       ├── AdminSales.tsx      # Ventas
│   │   │       ├── AdminDeliveries.tsx # Entregas
│   │   │       ├── AdminInventory.tsx  # Inventario global
│   │   │       └── AdminSettings.tsx   # Config plataforma
│   │   │
│   │   ├── driver/
│   │   │   └── DriverDashboard.tsx    # Panel del conductor
│   │   │
│   │   ├── profile/
│   │   │   └── UnifiedProfile.tsx     # Perfil unificado todos los roles
│   │   │
│   │   ├── Chat.tsx                    # Página de chat
│   │   ├── Settings.tsx               # Config del negocio (venue owner)
│   │   ├── Dashboard.tsx              # Dashboard business
│   │   └── Login.tsx                  # Login principal
│   │
│   ├── components/                     # Componentes reutilizables
│   │   ├── chat/                      # ChatWindow, ChatList, MessageBubble
│   │   ├── rating/                    # RatingModal, StarRating, RatingDisplay
│   │   ├── customer/                  # LocationSelector, PaymentForm, Loading
│   │   ├── analytics/                 # MetricCard, RevenueChart, DateRangePicker
│   │   ├── admin/                     # UserProfilePreview, VenueMobilePreview
│   │   ├── common/                    # Pagination, NotificationDisplay, Tooltip
│   │   ├── profile/                   # ProfileHeader, ReferralSection, SecuritySettings
│   │   ├── Sidebar.tsx                # Sidebar con navegación por rol
│   │   ├── ProtectedRoute.tsx         # Route guard por rol
│   │   ├── PermissionGate.tsx         # UI permission gate
│   │   ├── ErrorBoundary.tsx          # Error boundary global
│   │   ├── Layout.tsx                 # Layouts (customer, business, admin)
│   │   └── PWAInstallPrompt.tsx       # Prompt de instalación PWA
│   │
│   ├── hooks/
│   │   ├── useFavorites.ts            # Hook de favoritos
│   │   ├── usePWA.ts                  # Hook PWA install/update
│   │   └── usePermissions.ts          # Hook de permisos por rol
│   │
│   ├── data/
│   │   └── colombianCities.ts         # ~100 ciudades colombianas (lat, lng, dept)
│   │
│   ├── utils/
│   │   ├── logger.ts                  # Logger seguro (no console.log en prod)
│   │   ├── formatters.ts             # formatCOP, formatDate, etc.
│   │   ├── delivery.ts               # Cálculo tarifa domicilio por distancia
│   │   ├── constants.ts              # Constantes globales
│   │   └── productAvailability.ts    # Helpers de expiración
│   │
│   └── tests/                          # Tests Vitest
│       ├── components/                # CartContext, ProtectedRoute
│       ├── services/                  # dataService, paymentService
│       ├── hooks/                     # useFavorites
│       └── utils/                     # delivery, logger
│
├── functions/
│   ├── index.js                        # 17 Cloud Functions (1659 líneas)
│   ├── package.json
│   └── .eslintrc.js
│
├── public/
│   └── firebase-messaging-sw.js       # Service Worker FCM (compat CDN)
│
├── scripts/
│   ├── fixRole.ts                     # Fix roles de usuario
│   ├── promoteSuperAdmin.ts           # Promover a super admin
│   └── verifyRoles.ts                 # Verificar roles
│
├── firestore.rules                     # Reglas de seguridad Firestore
├── firestore.indexes.json             # 19 índices compuestos
├── storage.rules                       # Reglas Firebase Storage
├── firebase.json                       # Config Firebase (hosting, functions, etc.)
├── vite.config.ts                     # Config Vite + PWA manifest
├── tsconfig.json                      # TypeScript config
├── vitest.config.ts                   # Vitest config
├── package.json                       # Dependencias frontend
└── .env                               # Variables de entorno
```

---

## 4. Base de Datos

### Motor

**Cloud Firestore** (NoSQL, documento-orientado, tiempo real)

- **Modelo:** Colecciones → Documentos → Campos + Subcollecciones
- **Consistencia:** Strong consistency (single-region)
- **Tiempo real:** onSnapshot listeners para actualizaciones instantáneas
- **Transacciones:** Soporte nativo para operaciones atómicas

### Colecciones principales

#### `users/{userId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| fullName | string | Nombre completo |
| email | string | Email |
| role | string | SUPER_ADMIN, ADMIN, VENUE_OWNER, KITCHEN_STAFF, DRIVER, CUSTOMER |
| phone | string? | Teléfono |
| city | string? | Ciudad |
| address | string? | Dirección |
| avatarUrl | string? | URL avatar |
| isVerified | boolean | Verificado por admin |
| venueId | string? | ID sede (legacy) |
| venueIds | string[]? | IDs sedes (post-migración) |
| referralCode | string | Código referral único (6-8 chars) |
| invitedBy | string? | Código de quien lo invitó |
| fcmToken | string? | Token FCM push notifications |
| isGuest | boolean? | Usuario anónimo temporal |
| impact | object | {totalRescues, co2Saved, moneySaved, points, level} |
| streak | object | {current, longest, lastOrderDate, multiplier} |
| redemptions | ActiveRedemption[] | Canjes activos |
| createdAt | string | ISO timestamp |

#### `venues/{venueId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre del negocio |
| type | string | RESTAURANT, HOTEL, SUPERMARKET, CAFE, BAKERY, OTHER |
| address | string | Dirección |
| city | string | Ciudad |
| latitude | number? | Latitud GPS |
| longitude | number? | Longitud GPS |
| phone | string? | Teléfono |
| closingTime | string? | Hora de cierre |
| imageUrl | string? | Logo/imagen |
| coverImageUrl | string? | Imagen portada |
| isActive | boolean | Visible para clientes |
| ownerId | string? | userId del dueño (para chat resolution) |
| deliveryConfig | object | {isEnabled, baseFee, pricePerKm, maxDistance, freeDeliveryThreshold, minOrderAmount} |
| categoryId | string? | Categoría del negocio |
| dietaryTags | string[]? | Tags alimenticios |
| createdAt | string | ISO timestamp |

**Subcollección:** `venues/{venueId}/stats/ratings` → RatingStats

#### `products/{productId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| venueId | string | ID del negocio dueño |
| name | string | Nombre |
| description | string? | Descripción |
| originalPrice | number | Precio original (COP) |
| discountedPrice | number | Precio con descuento |
| quantity | number | Stock disponible |
| imageUrl | string? | URL imagen |
| category | string? | Categoría |
| type | string | SURPRISE_PACK, SPECIFIC_DISH |
| availableUntil | string? | ISO datetime de expiración |
| isActive | boolean | Visible |
| isDynamicPricing | boolean? | Pricing dinámico habilitado |
| dynamicDiscountedPrice | number? | Precio dinámico calculado |
| dynamicTier | string? | Tier actual (ej. "⬇️ -40% últimos 30 min") |
| dietaryTags | string[]? | VEGAN, VEGETARIAN, GLUTEN_FREE, KETO |
| createdAt | string | ISO timestamp |

#### `orders/{orderId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| customerId | string | ID del cliente |
| customerName | string | Nombre del cliente |
| customerEmail | string | Email del cliente |
| venueId | string | ID del negocio |
| products | OrderProduct[] | [{productId, name, quantity, price, originalPrice, imageUrl}] |
| totalAmount | number | Total final (COP) |
| subtotal | number | Subtotal productos |
| platformFee | number | Comisión plataforma (10%) |
| deliveryFee | number | Tarifa domicilio |
| venueEarnings | number | Ganancia neta del venue |
| status | string | PENDING → PAID → IN_PREPARATION → READY_PICKUP → DRIVER_ACCEPTED → IN_TRANSIT → COMPLETED / CANCELLED / MISSED |
| paymentMethod | string | "cash" o "card" |
| paymentStatus | string | "pending", "paid", "failed" |
| transactionId | string? | ID transacción Wompi |
| deliveryMethod | string | "delivery", "pickup", "donation" |
| deliveryAddress | string | Dirección de entrega |
| phone | string | Teléfono contacto |
| driverId | string? | ID conductor asignado |
| isDonation | boolean | Es donación |
| donationCenterId | string? | Centro de donación |
| donationCenterName | string? | Nombre centro |
| estimatedCo2 | number | CO₂ estimado salvado (kg, max 10) |
| moneySaved | number | Dinero ahorrado vs precio original |
| totalOriginalPrice | number | Precio total sin descuento |
| redemptionId | string? | ID canje aplicado |
| discountApplied | number | Monto descuento por canje |
| pickupDeadline | string | ISO datetime (30 min después de creación) |
| metadata | object | {venueOwnerId, venueName} |
| createdAt | string | ISO timestamp |

#### `chats/{chatId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| participants | string[] | [userId1, userId2] |
| participantNames | Record<string, string> | {userId: name} |
| participantRoles | Record<string, UserRole> | {userId: role} |
| type | string | "customer-venue", "customer-driver", "venue-driver", "admin-support" |
| orderId | string? | ID orden relacionada |
| lastMessage | object | {text, senderId, timestamp, read} |
| metadata | object | {customerName?, venueName?, driverName?, orderNumber?} |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

**Subcollección:** `chats/{chatId}/messages/{messageId}`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| chatId | string | ID chat padre |
| senderId | string | ID del que envía |
| senderName | string | Nombre |
| senderRole | UserRole | Rol |
| text | string | Contenido del mensaje |
| type | string | "text", "image", "location", "system" |
| read | boolean | Leído |
| imageUrl | string? | URL imagen adjunta |
| location | object? | {lat, lng} |
| timestamp | string | ISO timestamp |

#### `ratings/{dedupKey}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| orderId | string | ID orden |
| fromUserId | string | Quien califica |
| fromUserRole | UserRole | Rol de quien califica |
| toUserId | string | A quien se califica |
| toUserRole | UserRole | Rol del calificado |
| score | number | 1–5 estrellas |
| comment | string? | Comentario |
| venueId | string? | ID venue (si aplica) |
| driverId | string? | ID driver (si aplica) |
| createdAt | string | ISO timestamp |

#### `flash_deals/{dealId}`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| venueId | string | ID negocio |
| productId | string | ID producto |
| title | string | Título |
| description | string | Descripción |
| extraDiscountPct | number | % descuento extra (1-100) |
| startTime | string | ISO inicio |
| endTime | string | ISO fin |
| isActive | boolean | Activo |
| maxClaims | number? | Límite de claims |
| claimsCount | number | Claims actuales |
| createdAt | Timestamp | Firestore server timestamp |

#### Otras colecciones

| Colección | Descripción |
|-----------|-------------|
| `wallets/{venueId}` | Balance del venue (solo CF escribe) |
| `wallet_transactions/{txId}` | Historial movimientos wallet (solo CF) |
| `categories/{catId}` | Categorías de negocios |
| `donation_centers/{centerId}` | Centros de donación |
| `notifications/{notifId}` | Notificaciones in-app |
| `settings/platform` | Config global de plataforma |
| `audit_logs/{logId}` | Logs de auditoría |
| `rate_limits/{key}` | Rate limiting (sliding window) |
| `webhook_dedup/{key}` | Idempotencia webhooks Wompi |
| `redemptions/{redemptionId}` | Canjes de puntos |
| `roles/{roleId}` | Definiciones de roles |

### Índices compuestos (19)

| Colección | Campos | Scope |
|-----------|--------|-------|
| chats | participants (CONTAINS) + updatedAt (DESC) | COLLECTION |
| orders | venueId + createdAt (ASC) | COLLECTION |
| orders | venueId + createdAt (DESC) | COLLECTION |
| orders | status + createdAt (DESC) | COLLECTION |
| orders | driverId + createdAt (DESC) | COLLECTION |
| orders | driverId + status + createdAt (DESC) | COLLECTION |
| orders | customerId + createdAt (DESC) | COLLECTION |
| orders | venueId + status + createdAt (DESC) | COLLECTION |
| products | venueId + quantity (DESC) | COLLECTION |
| notifications | userId + createdAt (DESC) | COLLECTION |
| messages | read + senderId | COLLECTION_GROUP |
| audit_logs | performedBy + timestamp (DESC) | COLLECTION |
| ratings | orderId + fromUserId + toUserId | COLLECTION |
| ratings | venueId + createdAt (DESC) | COLLECTION |
| ratings | toUserId + createdAt (DESC) | COLLECTION |
| flash_deals | isActive + endTime | COLLECTION |
| users | role + venueIds (CONTAINS) | COLLECTION |
| users | role + venueId | COLLECTION |

---

## 5. Sistema de Autenticación

| Aspecto | Implementación |
|---------|----------------|
| **Proveedor** | Firebase Authentication |
| **Métodos de login** | Email/Password, Google OAuth, Apple OAuth, Facebook OAuth, Anónimo (guest) |
| **Registro** | Email + password + nombre + rol → crea doc en Firestore `users/{uid}` |
| **Verificación email** | Cloud Function `sendVerificationEmail` → SendGrid HTML email con link Firebase |
| **Recuperación contraseña** | Firebase `sendPasswordResetEmail` nativo |
| **Tipo de autenticación** | Firebase Auth tokens (JWT-like, managed by Firebase SDK) |
| **Hash de contraseñas** | Gestionado por Firebase (bcrypt/scrypt interno) |
| **Refresh tokens** | Automático por Firebase SDK (1 hora access token, refresh transparente) |
| **Expiración de sesiones** | Token Firebase auto-refresh; timeout UI de 10 segundos para loading state |
| **Guest users** | `signInAnonymously()` → puede convertirse a permanente con `linkWithCredential()` |
| **Auto-sync** | `onAuthStateChanged` + real-time Firestore listener en `users/{uid}` |
| **Race condition fix** | Login methods NO setean isLoading; solo primera carga usa timeout |
| **Verificación unificada** | SUPER_ADMIN → siempre verificado; test accounts → verificado; anonymous → verificado; regular → requiere emailVerified + isVerified en Firestore |

---

## 6. Roles y Permisos

### Roles del sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **SUPER_ADMIN** | Administrador total de la plataforma | Todo. Siempre pasa `hasRole()`. |
| **ADMIN** | Administrador operativo | Gestión usuarios, venues, productos, órdenes, finanzas, auditoría |
| **VENUE_OWNER** | Dueño de negocio/sede | Sus productos, órdenes de su(s) sede(s), analytics, flash deals, configuración |
| **KITCHEN_STAFF** | Personal de cocina | Órdenes de su sede (actualizar estado), ver productos |
| **DRIVER** | Conductor/repartidor | Órdenes disponibles, sus entregas asignadas, chat con cliente/venue |
| **CUSTOMER** | Cliente/comprador | Navegar, comprar, carrito, pedidos, chat, impacto, favoritos, rating |

### Modelo de control de acceso

**RBAC (Role-Based Access Control)** implementado en dos niveles:

1. **Frontend:** `ProtectedRoute` + `PermissionGate` + `hasRole()` en AuthContext
2. **Backend:** Firestore Security Rules + Cloud Functions con validación de rol

### Permisos por rol (22 permisos granulares)

```
SUPER_ADMIN:
  ✅ Acceso total a todas las funcionalidades
  ✅ Crear/eliminar usuarios y asignar cualquier rol
  ✅ Gestionar todas las sedes, productos, categorías
  ✅ Ver auditoría, finanzas globales, settings plataforma
  ✅ Eliminar cuentas de Firebase Auth
  ✅ Ejecutar migraciones (migrateVenueIdToVenueIds)

ADMIN:
  ✅ Gestionar usuarios (crear, editar, verificar — no eliminar de Auth)
  ✅ Gestionar venues (CRUD)
  ✅ Gestionar productos (CRUD global)
  ✅ Gestionar categorías
  ✅ Ver órdenes de todas las venues
  ✅ Ver auditoría, finanzas, ventas, deliveries
  ❌ Settings de plataforma (solo lectura)
  ❌ Eliminar usuarios de Firebase Auth

VENUE_OWNER:
  ✅ CRUD productos de su(s) sede(s)
  ✅ Ver/gestionar órdenes de su(s) sede(s)
  ✅ Gestionar flash deals de su(s) sede(s)
  ✅ Ver analytics de su(s) sede(s)
  ✅ Configurar su sede (nombre, dirección, delivery config)
  ✅ Chat con clientes y conductores
  ❌ Ver órdenes de otras sedes
  ❌ Gestionar usuarios o categorías

KITCHEN_STAFF:
  ✅ Ver órdenes de su sede
  ✅ Actualizar estado de órdenes (PREPARING → READY)
  ✅ Chat con clientes
  ❌ Gestionar productos, venues, usuarios
  ❌ Ver analytics o finanzas

DRIVER:
  ✅ Ver órdenes disponibles para entrega
  ✅ Aceptar órdenes de delivery
  ✅ Actualizar estado (ACCEPTED → IN_TRANSIT → COMPLETED)
  ✅ Chat con clientes y venues
  ❌ Gestionar productos, venues, usuarios

CUSTOMER:
  ✅ Navegar venues y productos
  ✅ Agregar al carrito, checkout (cash/card)
  ✅ Ver sus órdenes
  ✅ Calificar venues y conductores (1-5 estrellas)
  ✅ Chat con venues y conductores
  ✅ Ver impacto ambiental, leaderboard, canjear puntos
  ✅ Compartir código referral
  ✅ Gestionar favoritos
  ❌ Acceso a paneles admin/business
```

### Firestore Security Rules — Resumen

| Colección | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `users` | Owner \| Admin | Own profile \| Admin | Own profile \| Admin | SUPER_ADMIN |
| `venues` | Authenticated | Admin | Owner of venue \| Admin | Admin |
| `products` | Authenticated | Admin \| Owner of venue | Admin \| Owner of venue | Admin \| Owner of venue |
| `orders` | Admin \| Owner \| Venue staff \| Driver | **false** (solo Cloud Functions) | Admin \| Venue owner \| Kitchen \| Driver | SUPER_ADMIN |
| `chats` | Admin \| Participant | Authenticated (self in participants, ≥2 participants) | Admin \| Participant | Admin |
| `messages` | Admin \| Chat participant | Chat participant (self as sender) | Sender \| Participant (solo read field) | SUPER_ADMIN |
| `ratings` | Authenticated | Authenticated (score 1-5) | **false** | **false** |
| `flash_deals` | **Public** (sin auth) | Admin \| Owner of venue | Admin \| Owner of venue | Admin |
| `wallets` | Venue owner \| Admin | **false** (solo CF) | **false** (solo CF) | — |
| `wallet_transactions` | Venue owner \| Admin | **false** (solo CF) | **false** (solo CF) | — |
| `audit_logs` | Admin | Authenticated (performedBy == self) | **false** | **false** |
| `settings` | Admin | SUPER_ADMIN | SUPER_ADMIN | — |
| `categories` | Authenticated | Admin | Admin | Admin |
| `rate_limits` | **false** | **false** | **false** | **false** |
| `webhook_dedup` | **false** | **false** | **false** | **false** |

---

## 7. Módulos y Funcionalidades

### Módulos por área funcional

**Marketplace (Cliente)**
- Exploración de negocios por ciudad con filtros (categoría, dietary tags, búsqueda)
- Detalle de restaurante con productos, ratings, countdown de expiración
- Carrito multi-venue con validación de stock y expiración en tiempo real
- Checkout dual (efectivo + tarjeta Wompi) con cálculo de delivery GPS-based
- Donación de comida a centros registrados
- Tracking de órdenes en tiempo real (onSnapshot)
- Reorder de pedidos anteriores

**Gestión de Negocio**
- CRUD de productos con imagen, precios, stock, expiración, dietary tags
- Gestión de órdenes en tiempo real (KDS — Kitchen Display System)
- Flash deals (ofertas relámpago con countdown)
- Analytics del negocio (revenue, órdenes, top products)
- Configuración de delivery (tarifa base, precio/km, distancia máxima)
- Dynamic pricing automático (descuentos por proximidad a vencimiento)

**Administración**
- Gestión de usuarios (CRUD, verificación, asignación de roles)
- Gestión de sedes (CRUD, geocoding, preview mobile)
- Gestión de categorías
- Finanzas globales (revenue, comisiones, top venues por período)
- Auditoría (logs de acciones con export CSV anonimizado)
- Ventas y deliveries (reportes detallados)
- Settings de plataforma (comisiones, configuración global)

**Delivery (Conductor)**
- Panel de órdenes disponibles vs asignadas
- Aceptar/rechazar órdenes
- Actualizar estado de entrega (ACCEPTED → IN_TRANSIT → COMPLETED)
- Chat con cliente y restaurante
- Estadísticas personales (entregas, rating, earnings)

**Chat**
- Chat bidireccional en tiempo real (onSnapshot) entre:
  - Cliente ↔ Restaurante
  - Cliente ↔ Conductor
  - Restaurante ↔ Conductor
- Mensajes de texto, ubicación, sistema
- Indicador de leído, conteo de no leídos
- Notificación sonora en foreground

**Gamificación**
- Sistema de puntos: CO₂ salvado + dinero ahorrado → puntos
- Streak diario: 3d→1.5x, 7d→2.0x, 14d→2.5x, 30d→3.0x multiplicador
- Niveles: NOVICE (0-5), HERO (6-20), GUARDIAN (21+) rescues
- Leaderboard global y por ciudad
- Tienda de rewards (canjear puntos por descuentos, envío gratis, donaciones)
- Referral program (código único + QR + bonus 50pts al referrer y referido)
- Impact card compartible (WhatsApp, Web Share API)
- Flash deals con countdown timer

**Notificaciones**
- Push notifications (FCM) para cambios de estado de orden
- Notificaciones in-app en tiempo real
- Deep linking desde notificación push → orden específica
- Alerta pre-vencimiento (30 min antes de pickupDeadline)
- Permission modal con value proposition (una sola vez)

**Pagos**
- Efectivo (cash on delivery/pickup)
- Tarjeta (Wompi widget con firma HMAC-SHA256)
- Webhook idempotente para confirmación de pago
- Wallet por venue (balance, transacciones, comisiones)
- Canjes de puntos como descuento en checkout

---

## 8. API (Cloud Functions)

### Funciones Callable (onCall)

```
POST createOrder
  Auth: ✅ Requerido
  Rate limit: 10/user/10min
  Params: {venueId, products[], paymentMethod, deliveryMethod, address, phone,
           transactionId?, deliveryFee, estimatedCo2, redemptionId?, isDonation,
           donationCenterId?, donationCenterName?}
  Response: {success: true, orderId: string}

POST redeemPoints
  Auth: ✅ Requerido
  Rate limit: 3/user/hour
  Params: {rewardId: "discount_5k"|"discount_10k"|"free_pack"|"donation_meal"|"free_shipping"|"discount_10"}
  Response: {success: true, newBalance, chargedCost, redemption}

POST resolveVenueChatTarget
  Auth: ✅ Requerido
  Rate limit: 20/user/min
  Params: {orderId: string}
  Response: {userId, userName, venueId}

POST createNotification
  Auth: ✅ Requerido
  Rate limit: 40/user/min
  Params: {userId, title, message, type?, link?}
  Response: {success: true, notificationId}

POST ensureReferralCode
  Auth: ✅ Requerido
  Rate limit: 8/user/min
  Response: {referralCode, created: boolean}

POST sendVerificationEmail
  Auth: ✅ Requerido
  Rate limit: 3/email/hour
  Params: {email?: string}
  Response: {success: true}

POST deleteUserAccount
  Auth: ✅ Solo SUPER_ADMIN
  Params: {uid: string}
  Response: {success: true}

POST migrateVenueIdToVenueIds
  Auth: ✅ Solo ADMIN/SUPER_ADMIN
  Response: {migrated, skipped, total}

POST getFinanceStats
  Auth: ✅ Solo SUPER_ADMIN
  Params: {startDate?, endDate?}
  Response: {totalRevenue, totalPlatformFee, totalVenueEarnings, totalOrders,
             averageOrderValue, topVenues[]}
```

### Funciones HTTP (onRequest)

```
POST /generateWompiSignature
  CORS: Whitelist producción
  Secrets: WOMPI_INTEGRITY_SECRET, WOMPI_PUBLIC_KEY
  Rate limit: 20/IP/min
  Body: {reference, amount, currency?}
  Response: {signature, reference, amountInCents, currency, publicKey}

POST /wompiWebhook
  CORS: Whitelist producción
  Secrets: WOMPI_INTEGRITY_SECRET
  Headers: x-wompi-signature, x-wompi-timestamp
  Validation: HMAC-SHA256 timing-safe
  Idempotency: webhook_dedup collection
  Response: {received: true}
```

### Triggers Firestore

```
onDocumentUpdated orders/{orderId} → onOrderUpdated
  - Push FCM notification al cliente (status change)
  - Gamificación: streak, points, level, referral bonus (solo COMPLETED)

onDocumentUpdated orders/{orderId} → aggregateAdminStats
  - Incrementa contadores globales (solo COMPLETED)
```

### Funciones programadas (Scheduled)

```
every 5 minutes  → notifyBeforePickup     (alerta pre-vencimiento 30 min)
every 10 minutes → handleMissedPickups     (marca READY_PICKUP expirados como MISSED)
every 15 minutes → applyDynamicPricing     (ajusta precios por proximidad a vencimiento)
every 60 minutes → deactivateExpiredProducts (marca productos expirados como stock=0)
```

---

## 9. Seguridad Implementada

| Protección | Estado | Detalle |
|------------|--------|---------|
| **Hash de contraseñas** | ✅ | Firebase Authentication (bcrypt/scrypt interno) |
| **Validación de inputs** | ✅ | Server-side en todas las Cloud Functions (tipo, rango, formato) |
| **Protección SQL Injection** | N/A | Firestore NoSQL — no aplica SQL; queries tipadas |
| **Protección XSS** | ✅ Parcial | React escapa automáticamente; no hay `dangerouslySetInnerHTML`; CSP header no configurado |
| **CORS** | ✅ | Whitelist en producción: rescatto.com, app.rescatto.com, Firebase domains |
| **CSRF** | ✅ | Firebase Auth tokens (no cookies de sesión) |
| **Rate limiting** | ✅ | Sliding-window Firestore en: createOrder (10/10min), redeemPoints (3/hr), generateWompiSignature (20/min/IP), sendVerificationEmail (3/hr), createNotification (40/min) |
| **Logs de seguridad** | ✅ | Colección `audit_logs` con performedBy, action, timestamp, metadata |
| **Auditoría de acciones** | ✅ | Export CSV anonimizado (IPs masked, nombres → iniciales) |
| **Control intentos login** | ❌ | Delegado a Firebase Auth (bloqueo automático por intentos) |
| **HMAC webhook** | ✅ | Wompi webhook validado con `crypto.timingSafeEqual` |
| **Idempotencia** | ✅ | `webhook_dedup` collection para prevenir procesamiento duplicado |
| **Validación server-side de precios** | ✅ | createOrder usa precios de Firestore, ignora precios del cliente |
| **Row-Level Security** | ✅ | Firestore rules: usuarios solo acceden a sus propios datos; venues por ownership |
| **Protección datos financieros** | ✅ | `wallets` y `wallet_transactions` solo escribibles por Cloud Functions |
| **Guard producción** | ✅ | SeederService bloqueado en `import.meta.env.PROD` |
| **Secrets management** | ✅ | Firebase Secret Manager para WOMPI_INTEGRITY_SECRET, WOMPI_PUBLIC_KEY, SENDGRID_KEY |
| **COOP header** | ✅ | `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Firebase Auth popups) |
| **Logger seguro** | ✅ | `utils/logger.ts` — no `console.log` en producción |
| **Transacciones atómicas** | ✅ | createOrder, redeemPoints, createRating usan `runTransaction` |
| **Unique transaction validation** | ✅ | transactionId verificado antes de crear orden (previene doble cobro) |
| **CSP headers** | ❌ | No configurado |
| **HSTS** | ✅ | Firebase Hosting habilita HSTS automáticamente |

### Variables de entorno

```
VITE_FIREBASE_API_KEY          # API key Firebase (público — browser bundle)
VITE_FIREBASE_AUTH_DOMAIN      # Auth domain
VITE_FIREBASE_PROJECT_ID       # Project ID
VITE_FIREBASE_STORAGE_BUCKET   # Storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID  # FCM sender
VITE_FIREBASE_APP_ID           # App ID
VITE_FIREBASE_VAPID_KEY        # Web Push certificate key
VITE_WOMPI_PUBLIC_KEY           # Clave pública Wompi (público)
VITE_API_URL                    # URL base Cloud Functions

# Secrets (Firebase Secret Manager — NO en .env):
# WOMPI_INTEGRITY_SECRET        # Secret HMAC Wompi
# WOMPI_PUBLIC_KEY              # Clave pública Wompi (server)
# SENDGRID_KEY                  # API key SendGrid
```

> **Nota:** Las variables `VITE_*` se incluyen en el bundle del frontend (son públicas). Los secrets sensibles están en Firebase Secret Manager, accesibles solo por Cloud Functions.

---

## 10. Despliegue y Operación

| Aspecto | Detalle |
|---------|---------|
| **Proveedor hosting** | Firebase Hosting (CDN global) |
| **Proveedor backend** | Google Cloud Functions (via Firebase) |
| **Región** | us-central1 |
| **Runtime** | Node.js 22 (Cloud Functions Gen2) |
| **Docker** | No — serverless nativo |
| **CI/CD** | Manual: `npm run build && firebase deploy` |
| **Backups de DB** | Firebase automatic backups (configuración por defecto) |
| **Monitoreo** | Firebase Console (Crashlytics no habilitado, Functions logs) |
| **Logs** | Cloud Functions logs (Google Cloud Logging) + `audit_logs` Firestore |
| **Escalabilidad** | Auto-scaling de Cloud Functions; Firestore escala automáticamente |
| **CDN** | Firebase Hosting CDN global (edge locations) |
| **SSL/HTTPS** | Automático por Firebase Hosting + HSTS |
| **Dominio** | rescatto.com → Firebase Hosting |
| **PWA** | Service Worker con Workbox (precache 65 archivos, runtime cache strategies) |

### Cache strategies (PWA)

| Recurso | Estrategia | TTL |
|---------|-----------|-----|
| Firebase API | NetworkFirst | 24 horas |
| Cloud Functions | NetworkFirst | 1 hora |
| Imágenes externas | StaleWhileRevalidate | 7 días |
| Firebase Storage | CacheFirst | 30 días |
| Google Fonts | CacheFirst | 1 año |

---

## 11. Testing

| Tipo | Herramienta | Estado |
|------|-------------|--------|
| **Tests unitarios** | Vitest + Testing Library | ✅ 58 tests passing |
| **Tests de integración** | Vitest (mocks de Firebase) | ✅ Parcial |
| **Tests end-to-end** | No implementado | ❌ |
| **Coverage** | @vitest/coverage-v8 | Parcial |

### Tests existentes

```
tests/
├── components/
│   ├── CartContext.test.tsx        # Context de carrito
│   └── ProtectedRoute.test.tsx    # Route guards
├── hooks/
│   └── useFavorites.test.ts       # Hook favoritos
├── services/
│   ├── dataService.test.ts        # CRUD Firestore
│   └── paymentService.test.ts     # Pagos Wompi
└── utils/
    ├── delivery.test.ts           # Cálculo de delivery fee
    └── logger.test.ts             # Logger seguro
```

### Scripts de test

```bash
npm test              # Vitest watch mode
npm run test:run      # Run once
npm run test:coverage # Con coverage report
npm run test:ui       # UI visual (Vitest UI)
```

---

## 12. Evidencias y Referencias

| Recurso | URL |
|---------|-----|
| **Repositorio GitHub** | https://github.com/torchkatt/Rescatto.git |
| **Producción** | https://rescatto.com |
| **Firebase Hosting** | https://rescatto-c8d2b.web.app |
| **Firebase Console** | https://console.firebase.google.com/project/rescatto-c8d2b |
| **Wompi Dashboard** | https://comercios.wompi.co |
| **Cloud Functions logs** | Firebase Console → Functions → Logs |
| **Firestore indexes** | Firebase Console → Firestore → Indexes |

---

## Apéndice: Flujo de Pagos Wompi (Detalle)

```
┌──────────┐    ┌──────────────────┐    ┌───────────┐    ┌───────────┐
│  Cliente  │    │  Cloud Function  │    │   Wompi   │    │ Firestore │
└─────┬────┘    └────────┬─────────┘    └─────┬─────┘    └─────┬─────┘
      │                  │                     │                │
      │  1. Checkout     │                     │                │
      │  paymentMethod   │                     │                │
      │  = "card"        │                     │                │
      │                  │                     │                │
      │  2. POST         │                     │                │
      │  generateWompi   │                     │                │
      │  Signature       │                     │                │
      │ ─────────────────>                     │                │
      │                  │  3. SHA256 hash     │                │
      │                  │  ref+amount+secret  │                │
      │  4. {signature,  │                     │                │
      │   publicKey}     │                     │                │
      │ <─────────────────                     │                │
      │                  │                     │                │
      │  5. Abre widget  │                     │                │
      │  Wompi con sig   │                     │                │
      │ ──────────────────────────────────────>│                │
      │                  │                     │                │
      │  6. Pago OK      │                     │                │
      │  transactionId   │                     │                │
      │ <──────────────────────────────────────│                │
      │                  │                     │                │
      │  7. POST         │                     │                │
      │  createOrder     │                     │                │
      │  txId=tx_abc     │                     │                │
      │ ─────────────────>                     │                │
      │                  │  8. Valida stock,   │                │
      │                  │  precios SERVER,    │                │
      │                  │  crea orden         │                │
      │                  │ ────────────────────────────────────>│
      │  9. {orderId}    │                     │                │
      │ <─────────────────                     │                │
      │                  │                     │                │
      │                  │  10. POST webhook   │                │
      │                  │  x-wompi-signature  │                │
      │                  │ <───────────────────│                │
      │                  │                     │                │
      │                  │  11. HMAC verify    │                │
      │                  │  timing-safe        │                │
      │                  │                     │                │
      │                  │  12. Idempotency    │                │
      │                  │  check (dedup)      │                │
      │                  │                     │                │
      │                  │  13. Update order   │                │
      │                  │  status=PAID,       │                │
      │                  │  wallet credit      │                │
      │                  │ ────────────────────────────────────>│
      │                  │                     │                │
      │                  │  14. 200 OK         │                │
      │                  │ ────────────────────>                │
```

---

## Apéndice: Flujo de Gamificación

```
Orden completada (status → COMPLETED)
    │
    ├── Cálculo de puntos base
    │   pointsEarned = floor(moneySaved / 1000) + floor(co2Saved × 10)
    │
    ├── Cálculo de streak
    │   ├── Si lastOrderDate == today     → streak mantiene
    │   ├── Si lastOrderDate == yesterday → streak + 1
    │   └── Si otro                       → streak = 1
    │
    ├── Multiplicador por streak
    │   ├── 30+ días → 3.0×
    │   ├── 14+ días → 2.5×
    │   ├── 7+ días  → 2.0×
    │   ├── 3+ días  → 1.5×
    │   └── <3 días  → 1.0×
    │
    ├── Puntos finales = floor(pointsEarned × multiplier)
    │
    ├── Actualización de impacto
    │   ├── totalRescues + 1
    │   ├── co2Saved + validatedCo2 (0-10kg)
    │   ├── moneySaved + orderMoneySaved
    │   └── points + bonusPoints
    │
    ├── Nivel
    │   ├── 21+ rescues → GUARDIAN 🏆
    │   ├── 6-20 rescues → HERO ⚡
    │   └── 0-5 rescues → NOVICE 🌱
    │
    └── Bonus referral (solo primera orden)
        ├── Referrer → +50 puntos
        └── New user → +50 puntos

Tienda de rewards:
    ├── discount_5k   → 50 pts  → 5.000 COP descuento
    ├── discount_10k  → 90 pts  → 10.000 COP descuento
    ├── free_pack     → 150 pts → 15.000 COP (pack gratis)
    ├── donation_meal → 100 pts → Donación de comida
    ├── free_shipping → 50 pts  → Envío gratis (5.000 COP)
    └── discount_10   → 150 pts → 10% descuento
```

---

## Apéndice: Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
    function isAdmin() {
      return isAuthenticated() &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role
        in ['SUPER_ADMIN', 'ADMIN'];
    }

    // Avatares: cada usuario gestiona su carpeta
    match /avatars/{userId}/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId) || isAdmin();
    }

    // Uploads operativos restringidos a admins
    match /admin/{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Default deny
    match /{allPaths=**} {
      allow read: if isAuthenticated();
      allow write: if false;
    }
  }
}
```
