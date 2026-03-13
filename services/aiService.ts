import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product, User, Venue } from "../types";
import { logger } from "../utils/logger";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * AIService
 * Handles AI-driven logic such as personalized recommendations.
 */
export const aiService = {
    /**
     * Get personalized recommendations for a user based on their history and currently available products.
     */
    getRecommendedPacks: async (user: User, availableProducts: Product[], venues: Venue[]): Promise<string[]> => {
        if (!availableProducts.length || !user.impact) {
            // Fallback to most popular or newest if no history
            return availableProducts.slice(0, 3).map(p => p.id);
        }

        const venueMap = new Map(venues.map(v => [v.id, v.name]));

        const prompt = `
            Eres un asistente experto en sostenibilidad y ahorro de alimentos para la app Rescatto.
            Basado en el perfil del usuario y los productos disponibles, recomienda los 3 mejores packs sorpresa.
            
            Perfil del Usuario:
            - Nivel: ${user.impact.level}
            - Rescates totales: ${user.impact.totalRescues}
            - Intereses: Basado en su lista de favoritos (ID de sedes): ${user.favoriteVenueIds?.join(', ') || 'Ninguno'}
            
            Productos Disponibles (ID, Nombre, Sede, Precio con Descuento):
            ${availableProducts.map(p => `- ${p.id}: ${p.name} en ${venueMap.get(p.venueId)}, precio: ${p.discountedPrice}`).join('\n')}
            
            Responde ÚNICAMENTE con un array de JSON que contenga los IDs de los productos recomendados.
            Ejemplo: ["id1", "id2", "id3"]
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Clean response to ensure it's valid JSON
            const jsonStr = text.match(/\[.*\]/s)?.[0] || '[]';
            const recommendedIds = JSON.parse(jsonStr);
            
            return recommendedIds;
        } catch (error) {
            logger.error("Error getting AI recommendations:", error);
            // Fallback
            return availableProducts.slice(0, 3).map(p => p.id);
        }
    },
    /**
     * Get predictions for a merchant about waste and inventory optimization.
     * Capa 13: Predictive IA.
     */
    getMerchantPredictions: async (venue: Venue, salesHistory: any[], weatherData: any): Promise<any> => {
        const prompt = `
            Eres un experto en optimización de inventario y reducción de desperdicio de alimentos.
            Analiza los datos del comercio "${venue.name}" para predecir el desperdicio de mañana.
            
            Contexto:
            - Tipo de negocio: ${venue.businessType}
            - Ventas históricas recientes (últimos 7 días): ${JSON.stringify(salesHistory)}
            - Clima previsto para mañana: ${JSON.stringify(weatherData)}
            
            Responde ÚNICAMENTE con un objeto JSON que contenga:
            {
              "predictedWasteKg": número,
              "recommendedPacks": número (cuántos packs sorpresa debería publicar),
              "confidenceScore": número (0.0 a 1.0),
              "insight": "una breve explicación profesional en español de por qué (máximo 150 caracteres)"
            }
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonStr = text.match(/\{.*\}/s)?.[0] || '{}';
            return JSON.parse(jsonStr);
        } catch (error) {
            logger.error("Error getting merchant predictions:", error);
            return {
                predictedWasteKg: 5,
                recommendedPacks: 3,
                confidenceScore: 0.5,
                insight: "No se pudo generar una predicción precisa. Sugerimos mantener el promedio habitual."
            };
        }
    }
};

export default aiService;
