# 🎯 Rescatto: Contexto de IA y Guía de Arquitectura

Este archivo sirve como el **punto de entrada conceptual y técnico** para que modelos de Inteligencia Artificial (IA) y desarrolladores comprendan rápidamente qué hace Rescatto, cómo está construido y cómo extender o modificar el sistema sin romper sus patrones de diseño.

---

## 🌟 ¿Qué es Rescatto y para qué sirve?

**Rescatto** es una plataforma y aplicación web progresiva (PWA) de marketplace generalizado. Originalmente diseñada para combatir el desperdicio de alimentos en Colombia (**"Alta cocina, cero desperdicio"**), evolucionó a un motor de marketplace completo que soporta 4 tipos de transacciones: productos físicos, servicios, digitales y comida.

### Propósito y Funcionamiento General
Conecta **Vendedores** (restaurantes, tiendas, profesionales independientes, marcas digitales) que ofrecen productos/servicios, con **Compradores** dispuestos a adquirirlos. La plataforma maneja catálogo, carrito, pagos, logística de entrega, bookings de servicios y un asistente IA con function calling.

---

## 👥 Módulos y Roles de la Aplicación

La aplicación es un monolito frontend SPA/PWA que implementa un sistema de control de acceso y redirección basado en roles definidos en los tokens de autenticación de Firebase (Custom Claims):

| Rol | Módulo / Prefijo de Ruta | Funciones Principales |
|---|---|---|
| `CUSTOMER` | `/app` | Explorar marketplace, comprar productos/servicios/digital, gestionar carrito, ver transacciones, agenda bookings, chat IA. |
| `VENUE_OWNER` | `/dashboard`, `/seller-dashboard` | Gestionar seller, listings, ver analytics, pedidos, flash deals. |
| `KITCHEN_STAFF` | `/dashboard`, `/order-management` | Ver pedidos en tiempo real (KDS). |
| `DRIVER` | `/driver` | Ver ofertas de entrega, aceptar pedidos, chatear. |
| `ADMIN` / `SUPER_ADMIN` | `/backoffice` | Gestionar usuarios, sellers, listings, transacciones, bookings, finanzas, auditoría, inicializar marketplace. |

---

## 🛠️ Stack Tecnológico

El proyecto está estructurado con tecnologías modernas y desacopladas:

* **Frontend SPA / PWA:**
  * **Core:** React 18.2 + TypeScript 5.4.
  * **Estilos:** Tailwind CSS 3.4.
  * **Manejador de Estado:** React Contexts para estados de sesión y Zustand para estados globales UI (`stores/`).
  * **Data Fetching:** React Query v5 (TanStack Query) para caching óptimo y sincronización de datos con Firestore.
  * **Build Tool:** Vite 5.1 + `vite-plugin-pwa` para soporte Offline (Workbox caching).
* **Backend Serverless (Firebase):**
  * **Autenticación:** Firebase Auth con Custom Claims para roles de usuario.
  * **Base de Datos:** Cloud Firestore (base de datos NoSQL documental de tiempo real).
  * **Backend Lógico:** Firebase Cloud Functions Gen2 (Node.js) con 4 funciones marketplace.
  * **Notificaciones:** Firebase Cloud Messaging para alertas Push.
  * **Storage:** Firebase Cloud Storage para imágenes de productos y comprobantes de pago.
* **Integraciones y APIs:**
  * **Pasarela de Pago:** Wompi (soporte para tarjetas de crédito, débito y PSE con webhooks securizados con firmas HMAC-SHA256).
  * **Geolocalización:** Google Maps API (autocompletado de direcciones, mapas y cálculo de distancias por coordenadas GPS).

---

## 📂 Estructura de Directorios Clave

```bash
Rescatto/
├── .ai-context/          # Memoria histórica de decisiones de arquitectura (memory.json)
├── components/           # Componentes visuales organizados por subcarpetas (chat, customer, admin, common)
├── context/              # Contextos de React (AuthContext, CartContext, ChatContext, etc.)
├── docs/                 # Manuales de usuario y flujos detallados
├── functions/            # Backend Serverless en Firebase Cloud Functions
│   ├── src/
│   │   ├── services/     # Lógica centralizada del backend (orderService, cronService, paymentService, etc.)
│   │   └── utils/        # Logger y gestores de errores globales
│   └── tests/            # Tests unitarios del backend
├── graphify-out/         # Grafo de conocimiento del código (GRAPH_REPORT.md)
├── hooks/                # Custom React Hooks reutilizables (useAdminTable, useOrderFlow)
├── pages/                # Vistas principales de la aplicación divididas por módulos (admin, business, customer)
├── services/             # Clases de servicio frontend para API y Firebase (authService, productService, etc.)
├── stores/               # Almacenes de Zustand para manejo de estado UI ligero
├── tests/                # Tests unitarios e integración del frontend (Vitest)
└── types.ts              # Tipos globales de TypeScript
```

---

## 📊 Modelo de Datos (Firestore Schema)

Firestore es NoSQL, pero sigue un esquema lógico estricto definido en `types.ts`. A continuación se detallan las colecciones principales:

### Colecciones Legacy (Food Rescue)

### 1. `users` (Usuarios)
* `id` (string): Firebase Auth UID.
* `email` (string): Correo electrónico.
* `role` (string): `CUSTOMER`, `VENUE_OWNER`, `DRIVER`, `SUPER_ADMIN`, etc.
* `fullName` (string): Nombre completo.
* `phone` (string): Teléfono.
* `favoriteVenueIds` / `favoriteSellerIds` (string[]): Favoritos.
* `impact` (object): CO₂ saved, money saved, points, level, streak.
* `rescattoPass` (object): Suscripción premium.

### 2. `venues` (Sedes / Locales — legacy)
* `id` (string): ID de la sede.
* `name` (string): Nombre del restaurante/establecimiento.
* `ownerId` (string): UID del dueño.
* `latitude` / `longitude` (number): Coordenadas GPS.
* `city` (string): Ciudad.
* `deliveryConfig` (object): Config de domicilio.

### 3. `products` (Productos / Excedentes — legacy)
* `id` (string): ID del producto.
* `venueId` (string): ID de la sede.
* `name` (string): Nombre.
* `type` (enum): `SURPRISE_PACK` | `SPECIFIC_DISH`.
* `originalPrice` / `discountedPrice` (number): Precios.
* `quantity` (number): Stock.
* `availableUntil` (string): Fecha de expiración.
* `isDynamicPricing` (boolean): Precio dinámico activo.

### 4. `orders` (Pedidos — legacy)
* `id` (string): ID del pedido.
* `customerId` / `venueId` / `driverId` (string): Participantes.
* `status` (enum): `PENDING` → `ACCEPTED` → `READY` → `COMPLETED` + driver flow.
* `products` (array): Items del pedido.
* `totalAmount` (number): Total pagado.
* `deliveryMethod`: `delivery` | `pickup`.

### Colecciones Marketplace (nuevas)

### 5. `categories` (Categorías)
* Árbol jerárquico via `parentId`.
* `name`, `slug`, `icon`, `level`, `order`.
* `listingAttributes`: Atributos dinámicos por categoría (ej: brand, condition, duration).
* Roots: Comida, Tecnología, Servicios, Digital (19 subcategorías).

### 6. `sellers` (Vendedores)
* `name`, `type`: `food` | `retail` | `service` | `individual`.
* `ownerId`: Dueño del seller.
* `location`: `{ lat, lng, address, city }`.
* `categoryIds`: Categorías donde vende.
* `deliveryConfig`: Config de envíos.
* `subscription`: `free` | `seller_pass_monthly` | `seller_pass_annual`.

### 7. `listings` (Listados)
* `sellerId`, `categoryId`.
* `type`: `product` | `service` | `digital`.
* `title`, `description`, `images`, `price`, `quantity`.
* `attributes`: Record<string, any> (dinámico por categoría).
* `deliveryMethods`: `pickup` | `shipping` | `digital` | `inPerson`.
* `searchKeywords`: Para búsqueda prefix-based.

### 8. `transactions` (Transacciones)
* `buyerId`, `sellerId`.
* `transactionType`: `purchase` | `booking` | `digital`.
* `status`: `PENDING` → `CONFIRMED` → `COMPLETED` | `CANCELLED`.
* `lineItems`: Array con listingId, quantity, price, title.
* `deliveryMethod`, `totalAmount`, `commission`, `sellerEarnings`.
* `payment`: `{ method, id, status }`.

### 9. `bookings` (Reservas de servicios)
* `transactionId`, `sellerId`, `buyerId`, `listingId`.
* `startTime`, `endTime`: ISO timestamps.
* `status`: `confirmed` | `cancelled` | `attended` | `no_show`.

---

## ⚡ Reglas y Mecanismos de Negocio Críticos

### 1. Motor de Precios Dinámicos (Dynamic Pricing Engine)
Calcula automáticamente el precio de rescate basándose en el tiempo restante hasta la hora de cierre del local. A medida que se acerca la hora de cierre, el valor del producto disminuye de forma lineal o exponencial para forzar su venta.
* **Ubicación:** `functions/src/services/cronService.js` (ejecutado periódicamente por Cloud Scheduler).
* **Fórmula base:** $PrecioActual = PrecioOriginal \times (1 - DescuentoProgresivo)$.

### 2. Integración de Pasarela de Pagos (Wompi)
* El cliente selecciona pagar con tarjeta o PSE.
* El frontend abre el widget de Wompi (`components/customer/checkout/PaymentForm.tsx`).
* Wompi procesa el cobro y envía un Webhook seguro a la Cloud Function `paymentWebhook` (`functions/src/services/paymentService.js`).
* El backend valida la firma `SHA-256` utilizando la llave de integridad provista por Wompi para asegurar que la transacción es legítima y actualiza el estado del pedido a `PREPARING`.

### 3. Sincronización de Custom Claims (Roles)
* Cuando un administrador cambia el rol de un usuario en el Backoffice (`pages/admin/UsersManager.tsx`), se invoca la función `syncUserClaims`.
* Esto escribe el rol en la metadata de Firebase Auth del usuario.
* El cliente detecta la actualización y fuerza un refresco del token para reflejar las nuevas rutas de acceso permitidas mediante `ProtectedRoute`.

---

## ⚙️ Directrices de Desarrollo para IAs (Patrones de Código)

Cuando implementes o modifiques código, **DEBES** seguir estas reglas estrictas:

### 1. Módulos Administrativos (DataTable)
* **Prohibido:** Crear estados locales para paginar o buscar elementos manualmente en tablas administrativas de Firestore.
* **Patrón Obligatorio:** Usa siempre el hook `useAdminTable` ubicado en [useAdminTable.ts](file:///c:/Users/ALEXANDER%20SANDOVAL/Documents/PERSONAL/DESARROLLO/Rescatto/hooks/useAdminTable.ts) junto con el componente reutilizable `DataTable.tsx`. Esto habilita automáticamente búsqueda local rápida con `inMemorySearch` o paginación server-side basada en cursor de Firestore.

### 2. Manejo de Errores y Logging
* Todas las llamadas asíncronas deben envolverse en bloques `try/catch`.
* En frontend: Utiliza `services/loggerService.ts` para capturar errores de forma controlada.
* En backend (Cloud Functions): Utiliza el logger unificado en `functions/src/utils/logger.js` mediante la función `error()`, `warn()`, y `log()`.

### 3. Mantener el Grafo de Conocimiento al Día
* Este proyecto cuenta con `graphify`, un extractor automático de dependencias y mapa visual.
* Cada vez que realices modificaciones en los archivos de código, **debes ejecutar la siguiente instrucción en la terminal** para reconstruir el grafo:
  ```bash
  python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
  ```
  Esto actualizará automáticamente `graphify-out/GRAPH_REPORT.md` y `graphify-out/graph.json`.

---

## 🔍 Planes de Verificación

* **Tests Unitarios Frontend:** Ejecutar `npm run test:run` para comprobar que la lógica de componentes y hooks esté intacta.
* **E2E Playwright:** Ejecutar `npx playwright test` para correr las pruebas de integración en flujos críticos (registro, carrito, checkout).
* **Firestore Rules:** Ejecutar `npm run test:rules` para validar que la seguridad del acceso de Firestore no haya sido vulnerada.
