# Plan Integral — Rescatto Security Hardening (Completar lo pendiente)

> Estado: iniciado → 9 commits hechos. Faltante vs Todo benchmark

---

## Inventario: Hecho vs Pendiente

| Área | Todo (Claude) | Rescatto (yo) | Estado |
|------|---------------|---------------|--------|
| Setup (tsconfig, gitignore, emuladores) | ✅ | ✅ storage.rules + gitignore | Hecho |
| Plan document | ✅ | ✅ PLAN-SEGURIDAD-PRODUCCION.md | Hecho |
| AI proxy (keys fuera del bundle) | ✅ | ✅ functions/aiProxy.js + frontend | Hecho |
| Payment sin mock | ✅ | ✅ httpsCallable, sin mock | Hecho |
| State machine | ✅ | ✅ functions/orderState.js + utils/orderState.ts | Hecho |
| Amount validation en webhook | ✅ | ✅ mismatch → DISPUTED | Hecho |
| Stock management | ✅ | ✅ reserve + restore | Hecho |
| verifyTransaction (reconciliación) | ✅ | ✅ callable en marketplace.js | Hecho |
| Rules tests vs emulador | ✅ | ✅ 23 tests | Hecho |
| CI/CD + secret scan | ✅ | ✅ | Hecho |
| **Sentry init** | ✅ **Claude lo encontró roto** | ❌ **No revisado** | **Pendiente** |
| **CheckoutPage frontend** | ✅ **reescrito** | ❌ **No revisado** | **Pendiente** |
| **VITE_* limpieza** | ✅ | ❌ VITE_STRIPE_PUBLIC_KEY stale | **Pendiente** |
| **firestore.rules audit profunda** | ✅ | ❌ Solo tests, no revisión | **Pendiente** |
| **aiChatTools.ts (80KB)** | ✅ **tools proxy** | ❌ **No revisado** | **Pendiente** |

---

## Plan de ejecución (orden topológico)

### Fase A: Sentry + Observabilidad
- [ ] Verificar si Sentry se inicializa (buscar `Sentry.init` en `index.tsx`/`main.tsx`)
- [ ] Si no existe → crear `services/sentry.ts` con PII scrubbing
- [ ] Si existe pero mal → corregir

### Fase B: firestore.rules audit profunda
- [ ] Buscar auto-aprobación: ¿products/listings pueden crearse con `isApproved: true`?
- [ ] Buscar suplantación: ¿venues pueden crearse con ownerId ajeno?
- [ ] Buscar escalación de roles: ¿usuario puede auto-asignarse ADMIN/SUPER_ADMIN?
- [ ] Buscar colecciones internas sin bloqueo
- [ ] Corregir hallazgos + actualizar tests

### Fase C: Review aiChatTools.ts (80KB)
- [ ] Verificar que las tools definitions no exponen operaciones peligrosas
- [ ] Verificar que las tools respetan el modelo de permisos de Firestore

### Fase D: Checkout frontend review
- [ ] Verificar que CheckoutPage no calcula montos
- [ ] Verificar que usa httpsCallable y no fetch directo
- [ ] Verificar que no hay VITE_API_KEY en el componente

### Fase E: Cleanup
- [ ] Remover `VITE_STRIPE_PUBLIC_KEY` de `vite-env.d.ts` si no se usa
- [ ] Remover `test-gemini.ts` si expone keys (usa process.env.VITE_GEMINI_API_KEY)
- [ ] Review final de .env.example

---

## Validación final
- [ ] `tsc --noEmit` → 0 errores
- [ ] `vitest run` → 855+ pass
- [ ] `npm run test:rules` → 23+ pass
- [ ] `git status` → limpio
- [ ] push a remote
