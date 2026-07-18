# 🎯 Rescatto — Contexto de IA y Guía de Arquitectura

Este archivo es el **punto de entrada conceptual y técnico** para que IAs y desarrolladores comprendan rápidamente el proyecto Rescatto: su arquitectura, reglas de negocio, y cómo extenderlo sin romper patrones.

---

## 🌟 ¿Qué es Rescatto?

**Rescatto** es un **marketplace generalizado** colombiano donde vendedores (tiendas, restaurantes, profesionales, marcas digitales) publican productos, servicios y contenido digital, y compradores los adquieren mediante pagos seguros con **Wompi**. Incluye un **asistente IA** con function calling, suscripciones **Seller Pass**, y un panel administrativo completo.

---

## 👥 Roles y Módulos

| Rol | Ruta | Funciones |
|-----|------|-----------|
| `CUSTOMER` | `/app` | Explorar, comprar, carrito, transacciones, bookings, chat IA |
| `VENUE_OWNER` | `/dashboard` | Gestionar seller, listings, analytics, pedidos |
| `ADMIN`/`SUPER_ADMIN` | `/backoffice` | Gestionar usuarios, sellers, listings, transacciones, finanzas, planes |

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18.2 + TypeScript 5.4 + Tailwind CSS 3.4 |
| **Build** | Vite 5.1 + vite-plugin-pwa (Workbox) |
| **State** | React Context + Zustand 5.0 |
| **Data Fetching** | Firebase SDK directo (onSnapshot, getDocs) |
| **Auth** | Firebase Auth + Custom Claims |
| **DB** | Cloud Firestore |
| **Backend** | Firebase Cloud Functions Gen2 (Node.js) |
| **Pagos** | Wompi (widget checkout + webhooks) |
| **AI** | DeepSeek v4 Flash/Pro con function calling |
| **Notificaciones** | Firebase Cloud Messaging |
| **Storage** | Firebase Cloud Storage |
| **Tests** | Vitest (883 tests) |

---

## 📂 Estructura de Directorios

```
Rescatto/
├── components/          # Componentes React (seller/, customer/, admin/, common/)
├── context/             # React Contexts (Auth, Cart, Chat, Toast, Theme)
├── docs/                # Documentación y guías (SEO_GUIDE.md)
├── functions/           # Cloud Functions
│   ├── src/
│   │   ├── marketplace.js           # createTransaction, createBooking, cancelTransaction
│   │   ├── marketplace-notifications.js  # onTransactionCreated, onBookingCreated
│   │   ├── seller-pass.js           # createSellerSubscription, handleWompiSubscription
│   │   └── services/               # adminService, paymentService, etc. (legacy)
│   └── index.js         # Entry point con exports
├── hooks/               # Custom hooks (useAdminTable, etc.)
├── pages/               # Vistas (Landing, customer/, admin/, business/)
│   ├── Landing.tsx      # Página de marketing con precios dinámicos
│   ├── Help.tsx         # Centro de ayuda
│   └── customer/        # SellerOnboarding, SellerDetail, MyTransactions, BookingPage
├── public/              # Assets estáticos (sitemap.xml, robots.txt)
├── scripts/             # Utilidades (seedPlans.cjs)
├── services/            # Servicios frontend
│   ├── planService.ts            # Planes desde Firestore (dinámico)
│   ├── sellerPassService.ts      # Gestión de suscripciones
│   ├── listingService.ts         # CRUD de listings
│   ├── transactionService.ts     # Transacciones
│   ├── aiChatService.ts          # DeepSeek IA con tool calling
│   └── ...
├── tests/               # Tests Vitest
├── types.ts             # Tipos globales TypeScript
├── AI_CONTEXT.md        # Este archivo
└── README.md
```

---

## 📊 Modelo de Datos (Firestore)

### Colecciones Principales

#### `sellers` (Vendedores)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre del negocio |
| `type` | enum | `food` \| `retail` \| `service` \| `individual` |
| `ownerId` | string | UID del dueño |
| `location` | object | `{ lat, lng, address, city, neighborhood }` |
| `categoryIds` | string[] | IDs de categorías donde vende |
| `subscription` | string | `free` \| `seller_pass_monthly` \| `seller_pass_annual` |
| `commissionRate` | number | 0.10 (free) · 0.05 (pass) |
| `subscriptionExpiresAt` | string | ISO fecha de expiración |

#### `listings` (Listados/Productos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sellerId` | string | ID del vendedor |
| `categoryId` | string | Categoría |
| `type` | enum | `product` \| `service` \| `digital` |
| `title`, `description` | string | Nombre y descripción |
| `price`, `quantity` | number | Precio y stock |
| `images` | string[] | URLs de imágenes |
| `deliveryMethods` | array | `pickup` \| `shipping` \| `digital` \| `inPerson` |
| `attributes` | object | Atributos dinámicos por categoría |
| `searchKeywords` | string[] | Para búsqueda prefix-based |

#### `transactions` (Transacciones)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `buyerId`, `sellerId` | string | Comprador y vendedor |
| `transactionType` | enum | `purchase` \| `booking` \| `digital` |
| `status` | enum | `PENDING` → `CONFIRMED` → `COMPLETED` \| `CANCELLED` |
| `lineItems` | array | Items con listingId, quantity, price, title |
| `subtotal`, `commission`, `sellerEarnings` | number | Financiero |
| `commissionRate` | number | Tasa aplicada (del seller) |
| `payment` | object | `{ method, id, status }` |

#### `bookings` (Reservas)
| Campo | Tipo |
|-------|------|
| `transactionId`, `sellerId`, `buyerId` | string |
| `startTime`, `endTime` | ISO string |
| `status` | `confirmed` \| `cancelled` \| `attended` \| `no_show` |

#### `categories` (Categorías)
| Campo | Tipo |
|-------|------|
| `name`, `slug`, `icon` | string |
| `parentId` | string (null para raíces) |
| `listingAttributes` | array (atributos dinámicos) |
| Roots | Comida, Tecnología, Servicios, Digital (19 subcategorías) |

#### `subscription_plans` (Planes de Suscripción)
| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `id` | string | `free` \| `seller_pass_monthly` \| `seller_pass_annual` |
| `name` | string | Gratuito, Seller Pass Mensual, Anual |
| `price` | number | 0, 49900, 499900 |
| `commissionRate` | number | 0.10, 0.05, 0.05 |
| `period` | string | `monthly` \| `annual` |
| `features` | string[] | Lista de características |
| `isActive` | boolean | Plan activo/disponible |

---

## ⚡ Reglas de Negocio Clave

### 1. Modelo Híbrido de Monetización
| Plan | Comisión | Precio |
|------|----------|--------|
| **Free** | 10% por venta | $0/mes |
| **Seller Pass Mensual** | 5% por venta | $49.900/mes |
| **Seller Pass Anual** | 5% por venta | $499.900/año |

- Los planes se almacenan en `subscription_plans` y se leen dinámicamente
- La `commissionRate` se guarda en el documento del seller al hacer upgrade
- `createTransaction` calcula la comisión según `seller.commissionRate` (default 0.10)

### 2. AI Chat (RescattoBot)
- 21 herramientas de function calling
- Llamadas a DeepSeek v4 Flash/Pro
- 5 capas de seguridad: sanitización, role enforcement, rate limiting, destructive guard, prompt injection detection + strike system
- Memoria persistente por usuario en `ai_chat_memories`

### 3. Pagos Wompi
- Checkout via widget de Wompi en el frontend
- Webhook `handleWompiSellerSubscription` para activación de Seller Pass
- Transacciones solo creables via Cloud Function (`create: if false` en rules)

### 4. Seguridad Firestore
- `create: if false` en transactions, bookings — solo CF
- Listings: solo owner del seller o admin pueden crear/editar
- Users: `canUserCreateOwnProfile` limita role a `CUSTOMER`
- `canUserUpdateOwnProfile` limita campos editables
- Helper functions: `isAdmin()`, `isSuperAdmin()`, `isOwner()`, `hasRole()`

---

## 🔧 Cloud Functions

| Función | Archivo | Tipo | Descripción |
|---------|---------|------|-------------|
| `createTransaction` | marketplace.js | callable | Crea transacción PENDING con comisión dinámica |
| `createBooking` | marketplace.js | callable | Crea reserva |
| `cancelTransaction` | marketplace.js | callable | Cancela transacción PENDING |
| `seedCategories` | marketplace.js | callable | Siembra categorías iniciales |
| `onTransactionCreated` | marketplace-notifications.js | trigger | Notifica al seller |
| `onBookingCreated` | marketplace-notifications.js | trigger | Notifica al seller |
| `createSellerSubscription` | seller-pass.js | callable | Upgrade de plan |
| `handleWompiSellerSubscription` | seller-pass.js | webhook | Procesa pago Wompi |

---

## 🧪 Tests

```bash
npm run test        # Vitest — 883 tests
npx tsc --noEmit    # TypeScript check — 0 errores
npm run build       # Vite build — ~9s, 107 precache
```

---

## 🔍 SEO

| Recurso | Estado |
|---------|--------|
| `public/sitemap.xml` | ✅ 10 URLs |
| `public/robots.txt` | ✅ Indexa rutas públicas |
| `index.html` (meta OG + Twitter + JSON-LD) | ✅ |
| Google Search Console | ✅ `rescatto.com` + `rescatto-c8d2b.web.app` |
