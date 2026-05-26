# Rescatto

**"Alta cocina, cero desperdicio."**

Rescatto es una plataforma y aplicación web progresiva (PWA) de impacto ambiental y social en Colombia. Permite conectar a hoteles, restaurantes, panaderías, supermercados y cafeterías con consumidores finales para monetizar excedentes de comida de alta calidad a precios reducidos, integrando además repartidores y una suite completa de administración.

Este repositorio contiene la **aplicación cliente, el panel de negocio (KDS), el panel de conductor y el SuperAdmin Backoffice V2** desarrollado en React + TypeScript + Vite, junto con el backend serverless en Firebase Cloud Functions.

---

## 🚀 Arquitectura y Módulos de la Aplicación

La aplicación se comporta como un monolito frontend SPA/PWA con redirección y control de acceso basado en roles (`CUSTOMER`, `VENUE_OWNER`, `KITCHEN_STAFF`, `DRIVER`, `ADMIN`, `SUPER_ADMIN` y `CITY_ADMIN`).

### 1. Marketplace de Clientes (`/app`)
* **Buscador & Geolocalización:** Exploración de locales por ciudad y tags dietarios con cálculo de distancia GPS.
* **Carrito Expirable:** Stock controlado y validación de proximidad de horario en tiempo real.
* **Checkout Dual:** Soporta pago en efectivo y tarjeta mediante el widget del gateway colombiano **Wompi**.
* **Gamificación y Huella Verde:** Sistema de puntos basados en CO₂ salvado, racha diaria (streaks) con multiplicadores de nivel y tienda de recompensas.
* **Referidos:** Códigos y códigos QR automáticos que otorgan bonos a quien invita y al invitado.

### 2. Gestión de Negocios y Cocina (`/dashboard` & `/order-management`)
* **KDS (Kitchen Display System):** Flujo de preparación y despacho de pedidos en tiempo real.
* **Dynamic Pricing Engine:** Motor automatizado que reduce progresivamente el precio del producto conforme se acerca la hora de cierre del local.
* **Flash Deals:** Programación de ofertas relámpago con contadores temporales para salida rápida de stock.

### 3. Panel de Repartidores (`/driver`)
* **Despacho Autónomo:** Lista de pedidos de entrega a domicilio disponibles para aceptar.
* **Chat Integrado:** Comunicación bidireccional cliente-repartidor y local-repartidor.
* **Estadísticas de Conductor:** Registro de ganancias acumuladas y calificaciones.

### 4. Backoffice Administrativo V2 (`/backoffice`)
* **Gestión de Ecosistema:** CRUD de usuarios, locales y categorías con estandarización de tablas server-side (`useAdminTable`).
* **Soporte & Disputas:** Sistema de mensajería para resolver incidentes en pedidos.
* **Módulo de Fraude:** Métricas de comportamiento sospechoso en transacciones y cuentas.
* **Admin Lab:** Panel para limpieza quirúrgica y siembra de ecosistemas completos mediante triggers atómicos.

### 5. Backend Serverless (`functions/`)
* 17 Cloud Functions escritas en Node.js que procesan de forma segura pagos, validación de stock, webhooks con firmas HMAC-SHA256, y tareas automatizadas cada 5-15 minutos (precios dinámicos, expiración y alertas).

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 18.2, TypeScript 5.4, TailwindCSS 3.4.
* **State Management:** Zustand 5.0 (stores centralizadas).
* **Data Fetching:** React Query v5.
* **Build Tool & PWA:** Vite 5.1 + `vite-plugin-pwa` (Workbox offline caching).
* **Backend & DB:** Firebase (Auth, Firestore, Cloud Messaging para notificaciones push, Storage y Cloud Functions Gen2).
* **Pasarela de Pago:** Wompi (tarjeta + PSE).
* **Testing:** Vitest (unitario) + Playwright (E2E).
* **AI Router:** Enrutamiento inteligente con DeepSeek para procesamiento estratégico (`scripts/ai-router.ts`).

---

## 📦 Instalación Local

1. Clonar el repositorio.
2. Crear un archivo `.env` tomando como base `.env.example` y configurar las claves de desarrollo de Firebase y Wompi.
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Iniciar servidor de desarrollo local:
   ```bash
   npm run dev
   ```
5. Para ejecutar los tests unitarios:
   ```bash
   npm test
   ```

---
© 2024 Rescatto Technologies.