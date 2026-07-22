/**
 * AI Proxy — Server-side
 * 
 * Proxy Cloud Function para DeepSeek y Gemini.
 * Las API keys viven en Secret Manager / functions/.env, NUNCA en el frontend.
 * 
 * Patrón: el frontend llama httpsCallable('aiChat'), este módulo ejecuta la
 * seguridad (jailbreak detection, rate limiting, cuota) y llama a la API
 * correspondiente. El frontend jamás tiene acceso a las keys.
 */

const axios = require('axios');
const admin = require('firebase-admin');

// ─── Config ───

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_TOKENS = 2048;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

// ─── Rate Limiting (Firestore-backed, no in-memory) ───

async function checkRateLimit(userId) {
  const db = admin.firestore();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const ref = db.collection('rate_limits').doc(`ai_${userId}`);

  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) {
        t.set(ref, { count: 1, windowStart: now });
        return true;
      }
      const data = snap.data();
      if (data.windowStart < windowStart) {
        t.set(ref, { count: 1, windowStart: now });
        return true;
      }
      if (data.count >= RATE_LIMIT_MAX_REQUESTS) return false;
      t.update(ref, { count: admin.firestore.FieldValue.increment(1) });
      return true;
    });
  } catch {
    return true; // fail-open solo por error de DB
  }
}

// ─── Security: Jailbreak Detection (server-side source of truth) ───

const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)/i,
  /forget\s+(all\s+)?(previous|instructions|rules)/i,
  /system\s+(prompt|instruction|message)/i,
  /you\s+are\s+(now|free|liberated)/i,
  /\bDAN\b|JAILBREAK|BYPASS/i,
  /sudo|admin\s+mode|developer\s+mode/i,
  /bypass\s+(security|safety|payment|checkout|verification)/i,
  /delete\s+(all\s+)?data|drop\s+database|truncate/i,
  /execute\s+(command|sql|query|code)/i,
  /steal\s+(data|info|credentials|password)/i,
  /access\s+(other\s+)?users?\s+(data|account)/i,
  /fake\s+(transaction|order|payment|review)/i,
  /modify\s+(price|amount|balance|stock)/i,
];

function sanitizeInput(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .slice(0, 500);
}

function detectInjection(text) {
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      return { detected: true, pattern: pattern.source.slice(0, 50) };
    }
  }
  return { detected: false };
}

// ─── Strike System ───

const STRIKE_THRESHOLD = 3;
const STRIKE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

async function recordStrike(userId, pattern) {
  const db = admin.firestore();
  const ref = db.collection('ai_strikes').doc(userId);
  const now = Date.now();

  const strikeCount = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const strikes = snap.exists ? (snap.data().strikes || []) : [];
    const fresh = strikes.filter((s) => now - s.time < STRIKE_TTL_MS);
    fresh.push({ pattern: pattern.slice(0, 100), time: now });
    t.set(ref, { strikes: fresh, count: fresh.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return fresh.length;
  });

  // Audit log
  try {
    await db.collection('audit_logs').add({
      action: 'AI_CHAT_STRIKE',
      performedBy: userId,
      details: { pattern: pattern.slice(0, 100), strikeCount },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { /* fire-and-forget */ }

  if (strikeCount >= STRIKE_THRESHOLD) {
    await db.collection('users').doc(userId).update({
      isActive: false,
      bannedAt: new Date().toISOString(),
      bannedReason: 'AI Chat: Uso indebido de la plataforma',
    });
    return {
      blocked: true,
      strikeCount,
      message: 'Tu cuenta ha sido bloqueada por actividad sospechosa. Contacta a soporte.',
    };
  }

  return {
    blocked: false,
    strikeCount,
    message: `Advertencia (${strikeCount}/${STRIKE_THRESHOLD}): comportamiento no permitido detectado.`,
  };
}

// ─── AI Chat Handler ───

async function handleAiChat(data, auth) {
  if (!auth) throw new Error('Debes iniciar sesión.');
  if (!Array.isArray(data?.messages) || data.messages.length === 0) {
    throw new Error('Faltan mensajes.');
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!deepseekKey && !geminiKey) {
    return { content: '⚠️ El asistente de IA no está configurado por el momento.', toolCalls: null };
  }

  const messages = [...data.messages];

  if (!data.continuation) {
    // Rate limiting
    if (!(await checkRateLimit(auth.uid))) {
      return { content: 'Demasiadas solicitudes. Espera un momento.', toolCalls: null, quotaExceeded: true };
    }

    // Security check
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      const sanitized = sanitizeInput(lastUserMsg.content);
      const injection = detectInjection(sanitized);
      if (injection.detected) {
        const strike = await recordStrike(auth.uid, injection.pattern || 'unknown');
        return { content: strike.message, toolCalls: null, blocked: strike.blocked };
      }
      lastUserMsg.content = sanitized;
    }
  }

  // Call DeepSeek (preferred) or fallback to Gemini
  if (deepseekKey) {
    return callDeepSeek(messages, deepseekKey);
  }
  return callGemini(messages, geminiKey);
}

async function callDeepSeek(messages, apiKey) {
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 20_000,
      }
    );

    const choice = response.data?.choices?.[0];
    if (!choice) return { content: '⚠️ No se recibió respuesta del asistente.', toolCalls: null };

    const msg = choice.message;
    if (msg.tool_calls?.length) {
      return { content: msg.content || '', toolCalls: msg.tool_calls };
    }
    return { content: msg.content || '👍 Listo. ¿Necesitas algo más?', toolCalls: null };
  } catch (e) {
    console.error('aiProxy: DeepSeek error:', e.message);
    return { content: '⚠️ Error al conectar con el asistente. Intenta de nuevo.', toolCalls: null };
  }
}

async function callGemini(messages, apiKey) {
  try {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + (lastUserMsg?.content || '') }] }
    ];

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      { contents },
      { timeout: 20_000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { content: text || '👍 Listo. ¿Necesitas algo más?', toolCalls: null };
  } catch (e) {
    console.error('aiProxy: Gemini error:', e.message);
    return { content: '⚠️ Error al conectar con el asistente. Intenta de nuevo.', toolCalls: null };
  }
}

const SYSTEM_PROMPT = `Eres **RescattoBot**, el asistente virtual oficial de Rescatto ("Alta cocina, cero desperdicio").

## TU PROPÓSITO
Ayudas a usuarios de Rescatto a:
- Encontrar restaurantes, productos y packs sorpresa disponibles
- Consultar el estado de sus pedidos
- Recibir recomendaciones personalizadas
- Entender cómo funciona la plataforma
- Navegar por la aplicación

## REGLAS ESTRICTAS
1. **SOLO HABLAS DE RESCATTO.** Si el usuario pregunta sobre temas NO relacionados con Rescatto (política, deportes, tecnología general, programación, etc.), responde amablemente que solo puedes ayudar con temas de Rescatto.
2. **SÉ CONCISO Y ÚTIL.** Responde en máximo 3-4 oraciones cuando sea posible. Usa un tono cálido pero profesional.
3. **USA LAS HERRAMIENTAS DISPONIBLES.** Cuando el usuario busque algo específico, usa las herramientas. No inventes datos.
4. **FORMATEA LINDO.** Usa emojis con moderación (🌱 🍽️ 🎁 📍). Cuando muestres productos, incluye precios en formato COP ($12,000).
5. **NO HAGAS COSAS FUERA DEL ALCANCE.** No puedes modificar pedidos, crear órdenes, cambiar contraseñas, ni hacer acciones administrativas.
6. **IDIOMA.** Respondes en español de Colombia, a menos que el usuario pregunte en otro idioma.`;

module.exports = { handleAiChat };
