/**
 * Rescatto AI Chat Service — Proxy vía Cloud Function
 * 
 * La API key de DeepSeek/Gemini ya NO vive en el frontend.
 * Toda la seguridad (jailbreak detection, strikes, rate limiting) y el llamado
 * a la API de IA se hacen server-side en functions/aiProxy.js.
 * 
 * El frontend solo orquesta el loop de tool-calls: ejecuta las herramientas
 * localmente con la sesión del usuario (gobernadas por Firestore rules) y
 * reenvía los resultados al proxy.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { executeToolCall } from './aiChatTools';
import { logger } from '../utils/logger';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

interface AiChatResponse {
  content: string;
  toolCalls: any[] | null;
  blocked?: boolean;
  quotaExceeded?: boolean;
}

// Inicialización lazy para poder mockear en tests
type AiChatCallable = (data: { messages: Message[]; continuation?: boolean }) => Promise<{ data: AiChatResponse }>;
let _aiChatCallable: AiChatCallable | null = null;
function getAiChatCallable(): AiChatCallable {
  if (!_aiChatCallable) {
    _aiChatCallable = httpsCallable<{ messages: Message[]; continuation?: boolean }, AiChatResponse>(
      functions, 'aiChat'
    ) as AiChatCallable;
  }
  return _aiChatCallable;
}

export async function chatWithAI(
  messages: Message[],
  userId?: string,
): Promise<string> {
  if (!userId) return 'Inicia sesión para usar el asistente.';

  try {
    const first = await getAiChatCallable()({ messages });
    let { content, toolCalls } = first.data;

    // Si el backend detectó bloqueo, mostrar el mensaje directamente
    if (first.data.blocked || first.data.quotaExceeded) {
      return content || 'No puedes usar el asistente en este momento.';
    }

    // Si hay tool_calls, ejecutarlos localmente y enviar resultados como continuación
    if (toolCalls?.length) {
      const withToolCalls: Message[] = [
        ...messages,
        { role: 'assistant', content: content || '', tool_calls: toolCalls }
      ];

      for (const toolCall of toolCalls) {
        const fn = toolCall.function;
        let args: any = {};
        try { args = JSON.parse(fn.arguments); } catch (e) { logger.error('[AI] arg parse error:', e); }
        const toolResult = await executeToolCall(fn.name, args, userId);
        withToolCalls.push({ role: 'tool', content: toolResult, tool_call_id: toolCall.id });
      }

      // Enviar tool results al backend como continuación
      const second = await getAiChatCallable()({ messages: withToolCalls, continuation: true });
      content = second.data.content || content;
    }

    return content || '👍 Listo. ¿Necesitas algo más?';
  } catch (e) {
    logger.error('aiChat callable error', e);
    return '⚠️ Error de conexión. Verifica tu conexión a internet.';
  }
}

export { executeToolCall };
