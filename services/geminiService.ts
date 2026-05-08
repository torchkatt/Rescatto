import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

// Initialize Gemini
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

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
    private model;
    private conversationHistory: AIMessage[] = [];
    private readonly maxHistoryLength = 10;

    constructor() {
        // Use gemini-2.0-flash for high speed and low cost
        if (API_KEY && API_KEY !== 'your_api_key_here') {
            this.model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 2048,
                }
            });
        } else {
            logger.warn('Gemini API Key missing or default. AI Assistant running in Fallback mode.');
            this.model = null;
        }
    }

    /**
     * Generate the system prompt with dynamic context
     */
    private getSystemPrompt(context: AIContext): string {
        return `Eres RescattoBot 🤖, el asistente virtual de Rescatto. Tu diseño es minimalista, intencional y elegante.

MISIÓN: Combatir el desperdicio de alimentos conectando restaurantes con clientes de forma eficiente.

📋 CONTEXTO ACTUAL:
- Usuario: ${context.userName} (Rol: ${context.userRole})
- Ubicación: ${context.location}
- Negocios Cerca: ${context.nearbyVenues.length > 0 ? context.nearbyVenues.join(', ') : 'Ninguno detectado'}
- Pedidos: ${context.userOrders.length > 0 ? context.userOrders.join(', ') : 'Sin pedidos activos'}

🧠 REGLAS DE ORO:
1. **Concisión Extrema**: Responde con elegancia y brevedad. Máximo 3 oraciones si es posible.
2. **Packs Sorpresa**: Promociónalos como la mejor opción de sostenibilidad (hasta 70% dto).
3. **Personalidad**: Eres entusiasta pero profesional. Usa emojis con moderación.
4. **Soporte**: Si detectas frustración, guía al usuario hacia 'Mi Perfil > Soporte'.

BASE TÉCNICA:
- Para ser Vendedor: Registrarse -> Pedir a Admin cambiar rol a VENUE_OWNER -> Crear sede.
- Super Admins: Tienen acceso total. Salúdalos con especial deferencia técnica.`;
    }

    /**
     * Send a message to the AI assistant with streaming response
     */
    async *sendMessageStream(userMessage: string, context: AIContext): AsyncGenerator<string, string, unknown> {
        try {
            // Add user message to history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });

            // Trim history
            if (this.conversationHistory.length > this.maxHistoryLength) {
                this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
            }

            // Fallback if no model or key
            if (!this.model) {
                throw new Error('API_KEY_DISABLED');
            }

            // Build prompt
            const systemPrompt = this.getSystemPrompt(context);
            const conversationText = this.conversationHistory
                .map(msg => `${msg.role === 'user' ? 'Usuario' : 'RescattoBot'}: ${msg.content}`)
                .join('\n\n');

            const fullPrompt = `${systemPrompt}\n\n---\n\nCONVERSACIÓN:\n${conversationText}\n\nRescattoBot:`;

            // Generate streaming response
            const result = await this.model.generateContentStream(fullPrompt);

            let fullResponse = '';

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;
                yield chunkText;
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date()
            });

            return fullResponse;
        } catch (error: any) {
            logger.error('Gemini Error:', error);
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

    /**
     * Fallback responses based on keywords when API fails
     */
    private getFallbackResponse(message: string, context: AIContext): string {
        const lowerMsg = message.toLowerCase();

        // 1. Pack Sorpresa
        if (lowerMsg.includes('pack') || lowerMsg.includes('sorpresa')) {
            return "¡Excelente pregunta! 🎁 El Pack Sorpresa es nuestra forma favorita de salvar comida. Es una bolsa con productos deliciosos que el restaurante no vendió en el día, ¡así que te llevas alta calidad con un descuento increíble (hasta el 70%)! Lo mejor es que cada día es una sorpresa diferente.";
        }

        // 2. Cómo funciona
        if (lowerMsg.includes('funciona') || lowerMsg.includes('uso') || lowerMsg.includes('rescatto')) {
            return "Rescatto es muy sencillo de usar: \n1. Explora restaurantes cerca de ti 🍔\n2. Reserva tu 'Pack Sorpresa' o plato favorito a un precio super reducido 💸\n3. Recoge tu pedido en el horario indicado en el restaurante y ¡disfruta salvando el planeta! 🌍";
        }

        // 3. Restaurantes cercanos
        if (lowerMsg.includes('restaurante') || lowerMsg.includes('cerca') || lowerMsg.includes('comida') || lowerMsg.includes('donde')) {
            if (context.nearbyVenues && context.nearbyVenues.length > 0) {
                return `¡Claro! Tengo varios restaurantes geniales cerca de ti ahora mismo: \n\n${context.nearbyVenues.slice(0, 3).map(v => `📍 ${v}`).join('\n')}\n\n¡Anímate a pedir en uno de ellos!`;
            }
            return "¡Hay opciones deliciosas esperándote! Te sugiero ir a la pestaña 'Explorar' para descubrir en el mapa los restaurantes más cercanos a tu ubicación. 🍔";
        }

        // 4. Mis Pedidos
        if (lowerMsg.includes('pedido') || lowerMsg.includes('orden') || lowerMsg.includes('mi')) {
            if (context.userOrders && context.userOrders.length > 0) {
                return `¡Por supuesto! Aquí tienes información de tus pedidos actuales: \n${context.userOrders.map(o => `📦 ${o}`).join('\n')}`;
            }
            return "Parece que no tienes pedidos activos en este momento. ¡Es la oportunidad perfecta para buscar un Pack Sorpresa! 😋";
        }

        // 5. Métodos de pago
        if (lowerMsg.includes('pago') || lowerMsg.includes('pagar') || lowerMsg.includes('tarjeta') || lowerMsg.includes('efectivo')) {
            return "Aceptamos distintos métodos de pago virtuales: tarjetas de crédito, débito y billeteras digitales (como Nequi o Daviplata). \nTodo el pago se hace seguro mediante la aplicación y no en el local. �";
        }

        // 6. Horarios de recogida
        if (lowerMsg.includes('horarios') || lowerMsg.includes('hora') || lowerMsg.includes('recoger')) {
            return "Cada restaurante establece su propia ventana de recogida (pickup), generalmente cerca del cierre del turno. Puedes validar el horario exacto ingresando al Pack Sorpresa antes de confirmar tu pago. ¡Procura ser puntual! ⏰";
        }

        // 7. Cancelaciones
        if (lowerMsg.includes('cancelar') || lowerMsg.includes('reembolso')) {
            return "Puedes cancelar tu orden sin recargos desde la app siempre y cuando lo hagas con al menos 2 horas de anticipación al fin del horario de recogida. ¡Ten cuidado, porque si no reclamas el pedido a tiempo se pierde sin posibilidad de reembolso! ⚠️";
        }

        // 8. Opciones de Dieta
        if (lowerMsg.includes('vegetariano') || lowerMsg.includes('vegano') || lowerMsg.includes('alergia')) {
            return "Al tratarse de un 'Pack Sorpresa', su contenido depende enteramente de lo que quedó en vitrina ese día. Puedes consultar en el perfil del Restaurante si tienen foco vegetariano o vegano, pero si sufres de alergias alimenticias graves te aconsejamos precaución, ya que los ingredientes cambian a diario. 🥗";
        }

        // 9. Saludos genericos
        if (lowerMsg.includes('hola') || lowerMsg.includes('saludo') || lowerMsg.includes('buenas')) {
            return `¡Hola ${context.userName || ''}! 👋 Soy RescattoBot. ¿En qué puedo ayudarte a salvar comida hoy?`;
        }

        // 10. Default / Desconocido (Mensaje extendido con listado de opciones por estar la IA inactiva)
        return `¡Hola! 👋 Soy RescattoBot. Por el momento mi cerebro de Inteligencia Avanzada se encuentra en reposo 😴 para no generar consumos. 

De todas formas, puedo ayudarte con dudas comunes enviando palabras clave. Puedes preguntarme sobre:
- ¿Qué es un **Pack Sorpresa**? 🎁
- ¿Cómo **funciona** la aplicación? 📱
- Consultar **métodos de pago** 💳
- ¿Cuáles son las **horas de recogida**? 🕒
- Política para **cancelar pedidos** ⚠️
- ¿Qué **restaurantes tengo cerca**? 📍
- Opciones para dietas (**vegano**, **vegetariano**, alergias) 🥗

¿Sobre cuál de estos temas te gustaría saber más?`;
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
        this.conversationHistory = [];
    }

    /**
     * Get conversation history
     */
    getHistory(): AIMessage[] {
        return [...this.conversationHistory];
    }

    /**
     * Generate a product name and description suggestion based on venue type
     */
    async generateProductSuggestion(venueType: string, packType: string): Promise<{ name: string; description: string }> {
        // En un entorno real, llamaríamos a Gemini. Aquí simulamos la respuesta inteligente.
        const suggestions: Record<string, Array<{ name: string; description: string }>> = {
            'Restaurante': [
                { name: 'Pack Gourmet del Día', description: 'Una selección de nuestras mejores preparaciones del turno, listas para que las disfrutes en casa. Puede incluir proteína, acompañamiento y ensalada.' },
                { name: 'Caja Regalo del Chef', description: 'Platos premium que no salieron a Sala pero conservan todo el sabor. ¡Una sorpresa deliciosa y sostenible!' }
            ],
            'Panadería': [
                { name: 'Bolsa de Pan Artesanal', description: 'Surtido de panes recién horneados: croissants, baguettes y pan de bono. Perfecto para el desayuno de mañana.' },
                { name: 'Mix de Pastelería Dulce', description: 'Una selección de nuestros postres y galletas del día. Dulzura pura salvada del desperdicio.' }
            ],
            'Cafetería': [
                { name: 'Combo Merienda Rescatto', description: 'Sándwich del día acompañado de un snack dulce. Ideal para una tarde productiva.' },
                { name: 'Pack Coffee Break', description: 'Muffins, wraps y bites ligeros. Calidad de cafetería premium a mitad de precio.' }
            ]
        };

        const venueKey = venueType || 'Restaurante';
        const options = suggestions[venueKey] || suggestions['Restaurante'];
        const randomIdx = Math.floor(Math.random() * options.length);
        
        // Simular latencia de IA
        await new Promise(resolve => setTimeout(resolve, 800));

        return options[randomIdx];
    }
}

// Export singleton instance
export const geminiService = new GeminiService();
