# Rescatto — Marketplace Inteligente

**Conectamos tu negocio con compradores inteligentes.** Marketplace generalizado colombiano con pagos Wompi, AI Chat, suscripciones Seller Pass y analytics.

---

## 🚀 Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Build | Vite 5 + PWA (Workbox) |
| Backend | Firebase (Auth, Firestore, Functions, Messaging, Storage) |
| Pagos | Wompi (widget + webhook) |
| AI | DeepSeek v4 Flash/Pro con function calling |
| Tests | Vitest (883 tests) |

---

## 📦 Instalación

```bash
git clone https://github.com/torchkatt/Rescatto.git
cd Rescatto
cp .env.example .env   # Completar con tus claves
npm install
npm run dev            # Servidor local
```

## 🧪 Tests

```bash
npm run test       # 883 tests unitarios
npx tsc --noEmit   # Verificación TypeScript
npm run build      # Build de producción + PWA
```

---

## 🌐 Dominios

| URL | Propósito |
|-----|-----------|
| https://rescatto.com | Dominio principal |
| https://rescatto-c8d2b.web.app | Firebase Hosting |

---

## 📋 Features

- Marketplace general (productos, servicios, digital)
- AI Chat con 21 herramientas y 5 capas de seguridad
- Pagos Wompi (tarjeta, PSE, Nequi)
- Seller Pass (suscripción Free/Pro — comisión dinámica)
- Landing page con precios desde Firestore
- Help center + FAQ
- PWA offline + notificaciones push
- Dashboard admin con revenue
- SEO (sitemap, robots, Open Graph, JSON-LD, Google Search Console)
- 883 tests · 0 errores TS

---

## 📄 Licencia

© 2026 TorchKatt Group SAS — Todos los derechos reservados.
