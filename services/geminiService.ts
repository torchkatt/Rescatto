import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { logger } from '../utils/logger';

/**
 * Gemini Service — Proxy vía Cloud Function
 * 
 * La API key de Gemini ya NO vive en el frontend.
 * Toda llamada a Gemini pasa por functions/aiProxy.js.
 */

export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface AIContext {
    userName: string;
    userRole: string;
    location: string;
    nearbyVenues: string[];
    userOrders: string[];
    activeOffers: string[];
    featuredProducts: string[];
}

class GeminiService {
    private conversationHistory: AIMessage[] = [];
    private readonly maxHistoryLength = 10;

    /**
     * Send a message to the AI assistant with streaming response
     * Ahora usa el proxy server-side — la API key nunca toca el frontend.
     */
    async *sendMessageStream(userMessage: string, context: AIContext): AsyncGenerator<string, string, unknown> {
        try {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });

            if (this.conversationHistory.length > this.maxHistoryLength) {
                this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
            }

            const aiChat = httpsCallable(functions, 'aiChat');
            const result = await aiChat({
                messages: [{ role: 'user', content: userMessage }],
                context: {
                    userName: context.userName,
                    userRole: context.userRole,
                    location: context.location,
                    nearbyVenues: context.nearbyVenues,
                    userOrders: context.userOrders,
                    activeOffers: context.activeOffers,
                    featuredProducts: context.featuredProducts,
                }
            });

            const data = result.data as any;
            const fullResponse = data?.content || 'Lo siento, tuve un problema al procesar tu mensaje.';

            this.conversationHistory.push({
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date()
            });

            yield fullResponse;
            return fullResponse;
        } catch (error: any) {
            logger.error('Gemini Proxy Error:', error);
            const fallbackResponse = this.getFallbackResponse(userMessage, context);
            this.conversationHistory.push({
                role: 'assistant',
                content: fallbackResponse,
                timestamp: new Date()
            });
            yield fallbackResponse;
            return fallbackResponse;
        }
    }

    private getFallbackResponse(message: string, context: AIContext): string {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('pack') || lowerMsg.includes('sorpresa')) {
            return "¡Excelente pregunta! 🎁 El Pack Sorpresa es nuestra forma favorita de salvar comida. Es una bolsa con productos deliciosos que el restaurante no vendió en el día, ¡así que te llevas alta calidad con un descuento increíble (hasta el 70%)! Lo mejor es que cada día es una sorpresa diferente.";
        }
        if (lowerMsg.includes('funciona') || lowerMsg.includes('uso') || lowerMsg.includes('rescatto')) {
            return "Rescatto es muy sencillo de usar: \n1. Explora restaurantes cerca de ti 🍔\n2. Reserva tu 'Pack Sorpresa' o plato favorito a un precio super reducido 💸\n3. Recoge tu pedido en el horario indicado en el restaurante y ¡disfruta salvando el planeta! 🌍";
        }
        if (lowerMsg.includes('restaurante') || lowerMsg.includes('cerca') || lowerMsg.includes('comida') || lowerMsg.includes('donde')) {
            if (context.nearbyVenues && context.nearbyVenues.length > 0) {
                return `¡Claro! Tengo varios restaurantes geniales cerca de ti ahora mismo: \n\n${context.nearbyVenues.slice(0, 3).map(v => `📍 ${v}`).join('\n')}\n\n¡Anímate a pedir en uno de ellos!`;
            }
            return "¡Hay opciones deliciosas esperándote! Te sugiero ir a la pestaña 'Explorar' para descubrir en el mapa los restaurantes más cercanos a tu ubicación. 🍔";
        }
        if (lowerMsg.includes('pedido') || lowerMsg.includes('orden') || lowerMsg.includes('mi')) {
            if (context.userOrders && context.userOrders.length > 0) {
                return `¡Por supuesto! Aquí tienes información de tus pedidos actuales: \n${context.userOrders.map(o => `📦 ${o}`).join('\n')}`;
            }
            return "Parece que no tienes pedidos activos en este momento. ¡Es la oportunidad perfecta para buscar un Pack Sorpresa! 😋";
        }
        if (lowerMsg.includes('pago') || lowerMsg.includes('pagar') || lowerMsg.includes('tarjeta') || lowerMsg.includes('efectivo')) {
            return "Aceptamos distintos métodos de pago virtuales: tarjetas de crédito, débito y billeteras digitales (como Nequi o Daviplata). Todo el pago se hace seguro mediante la aplicación y no en el local. 💳";
        }
        if (lowerMsg.includes('horarios') || lowerMsg.includes('hora') || lowerMsg.includes('recoger')) {
            return "Cada restaurante establece su propia ventana de recogida (pickup), generalmente cerca del cierre del turno. Puedes validar el horario exacto ingresando al Pack Sorpresa antes de confirmar tu pago. ¡Procura ser puntual! ⏰";
        }
        if (lowerMsg.includes('cancelar') || lowerMsg.includes('reembolso')) {
            return "Puedes cancelar tu orden sin recargos desde la app siempre y cuando lo hagas con al menos 2 horas de anticipación al fin del horario de recogida. ¡Ten cuidado, porque si no reclamas el pedido a tiempo se pierde sin posibilidad de reembolso! ⚠️";
        }
        if (lowerMsg.includes('vegetariano') || lowerMsg.includes('vegano') || lowerMsg.includes('alergia')) {
            return "Al tratarse de un 'Pack Sorpresa', su contenido depende enteramente de lo que quedó en vitrina ese día. Puedes consultar en el perfil del Restaurante si tienen foco vegetariano o vegano, pero si sufres de alergias alimenticias graves te aconsejamos precaución, ya que los ingredientes cambian a diario. 🥗";
        }
        if (lowerMsg.includes('hola') || lowerMsg.includes('saludo') || lowerMsg.includes('buenas')) {
            return `¡Hola ${context.userName || ''}! 👋 Soy RescattoBot. ¿En qué puedo ayudarte a salvar comida hoy?`;
        }

        return `¡Hola! 👋 Soy RescattoBot. Por el momento mi cerebro de Inteligencia Avanzada se encuentra en reposo 😴 para no generar consumos. \n\nDe todas formas, puedo ayudarte con dudas comunes enviando palabras clave. Puedes preguntarme sobre:\n- ¿Qué es un **Pack Sorpresa**? 🎁\n- ¿Cómo **funciona** la aplicación? 📱\n- Consultar **métodos de pago** 💳\n- ¿Cuáles son las **horas de recogida**? 🕒\n- Política para **cancelar pedidos** ⚠️\n- ¿Qué **restaurantes tengo cerca**? 📍\n- Opciones para dietas (**vegano**, **vegetariano**, alergias) 🥗\n\n¿Sobre cuál de estos temas te gustaría saber más?`;
    }

    clearHistory(): void {
        this.conversationHistory = [];
    }

    getHistory(): AIMessage[] {
        return [...this.conversationHistory];
    }
}

export const geminiService = new GeminiService();
