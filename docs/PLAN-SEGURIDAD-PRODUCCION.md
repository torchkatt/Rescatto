# Plan de Seguridad y Producción — Rescatto

> Diagnóstico base de seguridad, mismo método aplicado a Todo.
> Fecha: 2026-07-22
> Basado en revisión de código fuente, firestore.rules, storage.rules, functions/ y servicios.

---

## Hallazgos de seguridad (ordenados por gravedad)

### 🔴 CRÍTICO: API Keys de IA expuestas en el bundle del frontend

**Archivos:**
- `services/geminiService.ts:5` — `const API_KEY = import.meta.env.VITE_GEMINI_API_KEY`
- `services/aiService.ts:5` — `googleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)`
- `services/aiChatService.ts:70-77` — DeepSeek API key en variable `apiKey`

**Problema:** `VITE_GEMINI_API_KEY` y `VITE_DEEPSEEK_API_KEY` se inyectan en el bundle de producción. Cualquier persona puede abrir DevTools y extraerlas. Mismo bug que tenía Todo con `VITE_DEEPSEEK_API_KEY`.

**Nota:** `initDeepSeek()` nunca es llamado en el código actual (no hay `import { initDeepSeek }` en ningún lado), lo que sugiere que el AI chat de DeepSeek **nunca funciona en producción** y cae siempre al fallback. Gemini sí tiene la key expuesta.

**Fix:** Mover ambos proxies a Cloud Functions (backend), como se hizo en Todo. El frontend llama un callable, nunca tiene la key.

### 🔴 CRÍTICO: Firma de integridad MOCK en dev mode

**Archivo:** `services/paymentService.ts:33-40`

```typescript
if (import.meta.env.DEV) {
  logger.warn('⚠️ Backend not found. Returning MOCK signature.');
  return { signature: "mock_signature_" + Date.now(), ... };
}
```

**Problema:** En modo desarrollo, si el backend no responde, la función devuelve una firma de integridad falsa. Si alguien corre la app en dev y los servicios de Wompi detectan esa firma, podría haber falsos aprobados. También es un riesgo de seguridad si el modo dev se despliega accidentalmente.

**Fix:** Nunca devolver firmas mock. Lanzar error siempre. Si el backend no está disponible, la UI debe mostrar "Pago no disponible" (degradación graceful).

### 🟠 ALTO: Storage rules sin validación de tamaño/tipo

**Archivo:** `storage.rules`

**Problema:** No hay función `isValidImage()` que restrinja tamaño máximo (5MB) y content-type (`image/*`). Cualquier usuario autenticado puede subir archivos de cualquier tipo y tamaño a `avatars/{userId}/`.

**Fix:** Agregar las mismas restricciones que se implementaron en Todo: límite de 5MB, content-type debe ser `image/*`.

### 🟠 ALTO: Rate limiting in-memory (se resetea al recargar)

**Archivo:** `services/aiChatSecurity.ts:363-375`

**Problema:** `checkWriteRateLimit` usa un objeto `writeOpCounts` en memoria JavaScript. Esto se pierde al recargar la página y no escala entre usuarios (es por instancia del navegador). Un atacante puede simplemente recargar la página para resetear el contador.

**Fix:** Mover rate limiting al backend (Firestore transaction-based), como se hizo en Todo con `functions/src/lib/rateLimit.ts`.

### 🟡 MEDIO: Strike system escribe directamente en user doc

**Archivo:** `services/aiChatSecurity.ts:103-110`

**Problema:** Los strikes de seguridad se guardan en `users/{userId}.aiChatStrikes`. Esto significa que el strike system compite por el mismo documento que el perfil del usuario, y si el usuario tiene permiso de escritura en su propio doc (que debería tener para actualizar perfil), podría en teoría limpiar sus strikes.

**Fix:** Usar colección separada `ai_strikes/{userId}` (solo backend), como se hizo en Todo.

### 🟡 MEDIO: `VITE_API_URL` pública — funciones expuestas

**Archivo:** `services/paymentService.ts:17`

**Problema:** La URL de Cloud Functions está en `VITE_API_URL` en el frontend. Esto expone el endpoint público de las funciones. Si bien las funciones tienen su propia autenticación, es superficie de ataque adicional.

**Fix:** Usar `httpsCallable` de Firebase (como se hizo en Todo) en vez de fetch directo. Las callables manejan auth automáticamente y no exponen la URL.

### 🟢 BAJO: `functions/` en JavaScript (no TypeScript)

**Problema:** Las Cloud Functions están escritas en JS plano sin tipos. No hay `tsconfig.json` estricto, ni compilación, ni type checking. Esto aumenta el riesgo de bugs en el manejo de pagos.

**Fix:** Migrar a TypeScript con configuración estricta (`noUnusedLocals`, `noImplicitReturns`), como se hizo en Todo.

### 🟢 BAJO: Commits poco descriptivos

**Problema:** Los mensajes de commit existentes son genéricos ("fix", "update", "refactor"). No documentan bugs de seguridad encontrados ni decisiones de diseño.

**Fix:** Adoptar el formato de commits atómicos de Claude: un propósito por commit, mensaje explica qué cambió y por qué.

---

## Plan de acción por fases (mismo ordenamiento topológico que Todo)

### Fase 0: Setup — higiene de secretos y build infra

- [ ] `storage.rules`: Agregar `isValidImage()` con límite de 5MB y content-type
- [ ] `functions/`: Agregar `tsconfig.json`, scripts de build, emuladores en `firebase.json`
- [ ] `.gitignore`: Agregar `functions/lib/`, logs de emuladores
- [ ] Verificar que ningún `.env` está trackeado en git

### Fase 1: Documento de plan (este documento)

### Fase 2: Proxy de IA server-side (Gemini + DeepSeek)

- [ ] Crear `functions/src/ai/aiProxy.ts` — callable que recibe mensajes, llama a DeepSeek/Gemini con key como secreto
- [ ] Crear `functions/src/ai/security.ts` — sanitización, jailbreak detection, strike system persistente
- [ ] Crear `functions/src/ai/usage.ts` — cuota diaria atómica vía Firestore
- [ ] Crear `functions/src/ai/tools.ts` — definiciones de herramientas
- [ ] Eliminar `VITE_GEMINI_API_KEY` y `VITE_DEEPSEEK_API_KEY` del frontend
- [ ] Refactorizar `aiChatService.ts` para llamar al callable
- [ ] Refactorizar `geminiService.ts` para usar el callable
- [ ] Eliminar `aiService.ts` o refactorizar

### Fase 3: Backend de pagos Wompi (modular)

- [ ] Auditar `functions/src/services/paymentService.js` para `generateWompiSignature`
- [ ] Reemplazar con `functions/src/payments/createTransaction.ts` (callable, montos server-side)
- [ ] Agregar `functions/src/payments/wompiSignature.ts` (checksum obligatorio)
- [ ] Agregar `functions/src/payments/wompiClient.ts` (server-to-server consulta)
- [ ] Agregar `functions/src/payments/wompiWebhook.ts` (con verificación de firma)
- [ ] Agregar `functions/src/payments/verifyTransaction.ts` (reconciliación)
- [ ] Agregar `functions/src/lib/rateLimit.ts` (Firestore-based, no in-memory)
- [ ] Agregar `functions/src/lib/audit.ts` (audit trail para pagos)
- [ ] Corregir `paymentService.ts`: eliminar mock signature, usar `httpsCallable`

### Fase 4: Máquina de estados de órdenes

- [ ] Auditar el estado actual de órdenes en las reglas de Firestore (ya hay funciones de transición)
- [ ] Crear `functions/src/domain/orderState.ts` con `ALLOWED_TRANSITIONS`
- [ ] Crear espejo de solo lectura en `src/utils/orderState.ts` para UI

### Fase 5: Reglas Firestore/Storage — auditoría

- [ ] Revisar `firestore.rules` (816 líneas) en busca de:
  - Auto-aprobación de listings/productos
  - Suplantación de venues/sellers
  - Escalamiento de roles por el usuario
  - Colecciones internas bloqueadas
- [ ] Corregir storage.rules con tamaño/tipo
- [ ] Agregar tests de reglas contra emulador real

### Fase 6: Refactor frontend — checkout sin montos en cliente

- [ ] `CheckoutPage.tsx` (si existe) o flujo de pago: usar callable en vez de fetch directo
- [ ] Eliminar lógica de cálculo de montos del cliente
- [ ] Degradación graceful cuando Wompi no está configurado

### Fase 7: Observabilidad

- [ ] Verificar que Sentry se inicializa correctamente (como se hizo en Todo)
- [ ] PII scrubbing en eventos de Sentry

### Fase 8: Testing

- [ ] Tests unitarios para `orderState`, `wompiSignature`
- [ ] Tests de reglas Firestore/Storage contra emulador real
- [ ] Fix a tests rotos por refactor
- [ ] Smoke tests E2E con emuladores

### Fase 9: CI/CD

- [ ] GitHub Actions: typecheck, lint, test, build, secret-scan
- [ ] Bloqueo de secretos en CI (grep de patrones `sk-`, `prv_`)

---

## Bugs de seguridad conocidos (encontrados durante el análisis)

| Bug | Archivo | Gravedad | Fix |
|-----|---------|----------|-----|
| Gemini API key expuesta en bundle | `services/geminiService.ts:5` | 🔴 | Mover a Cloud Function |
| DeepSeek API key en `.env.example` nunca se usó | `.env.example:27` + `aiChatService.ts:70` | 🔴 | Mover a CF + limpiar |
| Firma Wompi mock en dev | `services/paymentService.ts:33-40` | 🔴 | Eliminar mock, lanzar error |
| Storage sin validación de tamaño/tipo | `storage.rules` | 🟠 | Agregar isValidImage() |
| Rate limiting in-memory | `aiChatSecurity.ts:363-375` | 🟠 | Mover a Firestore |
| Strike system en user doc | `aiChatSecurity.ts:103-110` | 🟡 | Colección separada |
| VITE_API_URL pública | `paymentService.ts:17` | 🟡 | Usar httpsCallable |
| functions en JS sin tipos | `functions/` | 🟢 | Migrar a TS |
