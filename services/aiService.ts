import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Product, User, Venue } from "../types";
import { logger } from "../utils/logger";

/**
 * AIService
 * Ahora usa el proxy server-side (functions/aiProxy.js).
 * La API key de Gemini/DeepSeek NUNCA está en el frontend.
 */
export const aiService = {
    /**
     * Get personalized recommendations for a user.
     */
    getRecommendedPacks: async (user: User, availableProducts: Product[], venues: Venue[]): Promise<string[]> => {
        if (!availableProducts.length || !user.impact) {
            return availableProducts.slice(0, 3).map(p => p.id);
        }

        const venueMap = new Map(venues.map(v => [v.id, v.name]));
        const productList = availableProducts.map(p =>
            `- ${p.id}: ${p.name} en ${venueMap.get(p.venueId) || 'desconocido'}, precio: ${p.discountedPrice}`
        ).join('\n');

        const prompt = `Recomienda los 3 mejores packs sorpresa para un usuario nivel ${user.impact.level} con ${user.impact.totalRescues} rescates. Productos disponibles:\n${productList}\nResponde SOLO con un array JSON de IDs.`;

        try {
            const aiChat = httpsCallable(functions, 'aiChat');
            const result = await aiChat({
                messages: [{ role: 'user', content: prompt }],
                skipSecurity: true, // son datos estructurados, no input de usuario
            });

            const data = result.data as any;
            const text = data?.content || '[]';
            const jsonStr = text.match(/\[.*\]/s)?.[0] || '[]';
            return JSON.parse(jsonStr);
        } catch (error) {
            logger.error("Error getting AI recommendations:", error);
            return availableProducts.slice(0, 3).map(p => p.id);
        }
    },

    /**
     * Get predictions for a merchant about waste and inventory optimization.
     */
    getMerchantPredictions: async (venue: Venue, salesHistory: any[], weatherData: any): Promise<any> => {
        const prompt = `Analiza el desperdicio de "${venue.name}" (${venue.businessType}). Ventas: ${JSON.stringify(salesHistory)}. Clima: ${JSON.stringify(weatherData)}. Responde SOLO con JSON: {predictedWasteKg: número, recommendedPacks: número, confidenceScore: número, insight: string}`;

        try {
            const aiChat = httpsCallable(functions, 'aiChat');
            const result = await aiChat({
                messages: [{ role: 'user', content: prompt }],
                skipSecurity: true,
            });

            const data = result.data as any;
            const text = data?.content || '{}';
            const jsonStr = text.match(/\{.*\}/s)?.[0] || '{}';
            return JSON.parse(jsonStr);
        } catch (error) {
            logger.error("Error getting merchant predictions:", error);
            return {
                predictedWasteKg: 5,
                recommendedPacks: 3,
                confidenceScore: 0.5,
                insight: "No se pudo generar una predicción precisa. Sugerimos mantener el promedio habitual.",
            };
        }
    },
};

export default aiService;
