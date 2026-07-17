# 🏭 Runbook de Producción — Rescatto

> **Última actualización:** 2026-07-16
> **Proyecto Firebase:** rescatto-c8d2b
> **Dominio:** rescatto-c8d2b.web.app (configurar dominio personalizado)

---

## 📋 Índice de contenidos

1. [Arquitectura](#1-arquitectura)
2. [Deploy](#2-deploy)
3. [Monitoreo](#3-monitoreo)
4. [Backups](#4-backups)
5. [Incidentes comunes](#5-incidentes-comunes)
6. [Firestore](#6-firestore)
7. [Cloud Functions](#7-cloud-functions)
8. [AI Chat](#8-ai-chat)

---

## 1. Arquitectura

```
Usuario → Firebase Hosting (PWA React)
              │
              ├── Firebase Auth (email, Google, Apple)
              ├── Cloud Firestore (DB principal)
              ├── Cloud Functions (17 funciones)
              ├── Cloud Storage (imágenes)
              ├── Firebase Cloud Messaging (notificaciones push)
              ├── DeepSeek API (AI Chat)
              └── Wompi API (pagos Colombia)
```

### Stack técnico
| Componente | Versión | 
|------------|---------|
| React | 18.2 |
| TypeScript | 5.4 |
| Vite | 5.1 |
| Firebase | 10.x |
| DeepSeek | v4-flash (`deepseek-chat`) |
| TailwindCSS | 3.4 |
| Wompi | v1 (producción) |

---

## 2. Deploy

### Prerrequisitos
```bash
# Token de Firebase (generar en Firebase Console)
# Project Settings > Service Accounts > Generate new private key
set FIREBASE_TOKEN=<token>
```

### A staging
```bash
scripts\deploy.bat staging
```

### A producción
```bash
scripts\deploy.bat prod
```

### El script hace:
1. ✅ `npm run build` — compila frontend
2. ✅ `firebase deploy --only firestore:rules` — reglas de seguridad
3. ✅ `firebase deploy --only firestore:indexes` — índices compuestos
4. ✅ `firebase deploy --only functions` — Cloud Functions (17)
5. ✅ `firebase deploy --only hosting` — PWA (dist/)

### Staging
- Proyecto: `rescatto-staging`
- URL: `https://rescatto-staging.web.app`
- Deploy automático: en cada push a `main`
- Base de datos separada de producción
- Mismas reglas de seguridad que producción

---

## 3. Monitoreo

### Google Cloud Console
- **URL:** https://console.cloud.google.com/monitoring (proyecto rescatto-c8d2b)
- **Alertas configuradas:**
  - Error rate > 5% en Cloud Functions → notificar email + Telegram
  - Latencia P95 > 5s en Cloud Functions → notificar email
  - Firestore read/write operations > 100k/día → notificar email
  - Backup diario no ejecutado → notificar email
  - Sentry error rate > 10/hora

### Sentry
- **URL:** https://sentry.io (proyecto Rescatto)
- **Configuración:** `index.tsx` — 10% traces, 50% replays en error, prod only
- **DSN:** configurado en `VITE_SENTRY_DSN`

### Logs
```bash
# Ver logs de Cloud Functions
firebase functions:log

# Ver logs específicos
firebase functions:log --filter "createOrder"

# Logs estructurados en Firebase Console
# Functions > Logs
```

---

## 4. Backups

### Firestore automático
- **Schedule:** Diario a las 02:00 UTC (21:00 Colombia)
- **Bucket:** `gs://rescatto-backups/firestore/YYYY-MM-DD/`
- **Retención:** 30 días (configurar lifecycle en GCS)
- **Implementado en:** `cronService.backupFirestore()`

### Configurar backup bucket
```bash
# 1. Crear bucket en Google Cloud Storage
gsutil mb -l us-central1 -p rescatto-c8d2b gs://rescatto-firestore-backups

# 2. Configurar retención (30 días)
gsutil lifecycle set - <<EOF
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 30}
  }]
}
EOF

# 3. Configurar variable de entorno en Firebase Functions
firebase functions:config:set firestore.backup_bucket="gs://rescatto-firestore-backups"

# 4. Re-deploy functions
firebase deploy --only functions
```

### Restaurar backup
```bash
# Usar gcloud para importar
gcloud firestore import gs://rescatto-firestore-backups/firestore/2026-07-16/

# Esto sobreescribe TODA la base de datos
# ⚠️ No hay undo — asegúrate de tener un backup actual antes
```

---

## 5. Incidentes comunes

### ❌ 5.1 — Usuarios no pueden iniciar sesión con Google

**Síntoma:** Error "auth/popup-closed-by-user" o "auth/unauthorized"
**Causa:** URL no autorizada en Firebase Console
**Fix:**
1. Ir a Firebase Console > Authentication > Settings > Authorized domains
2. Agregar: `rescatto-c8d2b.web.app` (y dominio personalizado)
3. Esperar 5 min para propagación

### ❌ 5.2 — Webhook de Wompi falla

**Síntoma:** Pedidos quedan en PENDING_PAYMENT
**Causa:** Firma HMAC inválida o URL del webhook incorrecta
**Fix:**
1. Verificar en Wompi Dashboard que el webhook apunte a:
   `https://us-central1-rescatto-c8d2b.cloudfunctions.net/wompiWebhook`
2. Verificar que `WOMPI_INTEGRITY_KEY` en Functions tenga el valor correcto
3. Re-enviar webhook desde Wompi Dashboard

### ❌ 5.3 — AI Chat no responde con datos reales

**Síntoma:** La IA da respuestas genéricas (fallback)
**Causa:** `VITE_DEEPSEEK_API_KEY` no está en el `.env`
**Fix:**
```env
VITE_DEEPSEEK_API_KEY=sk-...
```

### ❌ 5.4 — Firestore Missing or insufficient permissions

**Síntoma:** Error 403 en consola
**Causa:** Reglas de Firestore no desplegadas
**Fix:**
```bash
npm run deploy:bunker
# o:
npx firebase deploy --only firestore:rules
```

### ❌ 5.5 — Cloud Functions timeout

**Síntoma:** createOrder timeout después de 60s
**Causa:** Latencia de Wompi o Firestore
**Fix:**
- Verificar estado de Wompi: https://status.wompi.co
- Aumentar timeout en `functions/index.js` para createOrder

### ❌ 5.6 — Usuario bloqueado por la IA

**Síntoma:** Usuario dice "mi cuenta está bloqueada"
**Causa:** Alcanzó 2 strikes en el AI Chat
**Fix:**
1. Ir a Firestore > users/{uid}
2. Eliminar campo `aiChatStrikes`
3. Setear `isActive: true`
4. Verificar en audit_logs qué pasó

---

## 6. Firestore

### Colecciones principales
| Colección | Tamaño estimado | Reglas |
|-----------|:---------------:|--------|
| `users` | ~1K docs | Owner/Admin |
| `venues` | ~100 docs | Público lectura |
| `products` | ~5K docs | Público lectura |
| `orders` | ~50K docs | Owner/Venue/Driver |
| `chats` | ~10K docs | Participantes |
| `ai_chat_memories` | ~5K docs | Owner |
| `ai_chat_usage` | ~1K docs | Owner |
| `audit_logs` | ~100K docs | Admin |
| `backups` (system_events) | ~1K docs | Admin |

### Índices compuestos
15+ índices definidos en `firestore.indexes.json`. Deploy automático en `deploy.bat`.

### Costos estimados
| Servicio | Estimado/mes (100 usuarios activos) |
|----------|:-----------------------------------:|
| Firestore reads | ~$5 |
| Firestore writes | ~$3 |
| Cloud Functions | ~$2 |
| Firebase Hosting | ~$1 |
| DeepSeek API | ~$1 |
| Firebase Auth | Gratis |
| **Total** | **~$12/mes** |

---

## 7. Cloud Functions

### Lista de funciones (17)
| Función | Trigger | Timeout |
|---------|---------|:-------:|
| `createOrder` | onCall | 30s |
| `wompiWebhook` | onRequest | 15s |
| `applyDynamicPricing` | onSchedule (5 min) | 120s |
| `handleMissedPickups` | onSchedule (5 min) | 60s |
| `notifyBeforePickup` | onSchedule (5 min) | 60s |
| `cleanupData` | onSchedule (24h) | 60s |
| `backupFirestore` | onSchedule (24h, 2AM) | 300s |
| `generateWompiSignature` | onCall | 10s |
| `redeemPoints` | onCall | 10s |
| `syncUserClaims` | onCall | 10s |
| `sendVerificationEmail` | onCall | 15s |
| `deleteUserAccount` | onCall | 30s |
| `migrateVenueIdToVenueIds` | onCall | 60s |
| `healthCheck` | onRequest | 10s |
| `onOrderStatusChanged` | onDocumentUpdated | 30s |
| `onUserCreated` | onDocumentCreated | 30s |
| `onUserUpdated` | onDocumentUpdated | 30s |

### Redeploy de función individual
```bash
firebase deploy --only functions:createOrder
```

---

## 8. AI Chat

### RescattoBot
- **Modelo:** DeepSeek v4-flash (`deepseek-chat`)
- **19 tools:** búsqueda, carrito, pedidos, finanzas, favoritos, chats, perfil, admin, navegación, info
- **Seguridad:** 5 capas + strikes (2 → bloqueo)
- **Memoria:** persistente en Firestore (4 categorías con TTL)
- **Almacenamiento:** Local (localStorage) o Nube (Firestore)
- **Límites:** Guest 5, Free 20, Pass Mensual 100, Pass Anual/Admin ∞

### Auditoría de seguridad
Cada violación de la IA se registra en `audit_logs/` con:
- `action: AI_CHAT_SECURITY_VIOLATION`
- userId, userName, userRole, input, pattern, strikeNumber
- userAgent, location, timestamp

### Strikes
```json
// En users/{uid}:
{
  "aiChatStrikes": {
    "count": 1,
    "lastOffense": "code_generation",
    "lastOffenseAt": "2026-07-16T22:00:00Z",
    "blocked": false
  }
}
```

---

## Contacto
- **Owner:** Alexander Sandoval
- **Repo:** https://github.com/torchkatt/Rescatto
- **AI Chat Skill:** `rescatto-ai-chat` (v3.0.0)
- **AI Core Docs:** `Torchkatt-AI-Core/ai_core/docs/ai-chat-architecture-pattern.md`
