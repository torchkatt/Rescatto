import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product } from '../types';
import { aiService } from '../services/aiService';
import { dataService } from '../services/dataService';
import { venueService } from '../services/venueService';
import { logger } from '../utils/logger';

/**
 * useRecommendations Hook
 * Fetches personalized product recommendations using Gemini AI.
 */
export function useRecommendations() {
    const { user } = useAuth();
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const userId = user?.id;
    const userCity = user?.city;
    const userFavoriteVenueIds = user?.favoriteVenueIds;

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                // 1. Fetch available products and venues in the user's city
                const city = userCity || undefined;
                const [venues, products] = await Promise.all([
                    venueService.getAllVenues(city),
                    dataService.getAllOrders().then(() => []) // This is a placeholder, we need a getAvailableProducts
                ]);

                // For the purpose of this implementation, let's assume we fetch all products
                // In a real app, we'd query for currently available packs
                const allVenues = await venueService.getAllVenues(city);
                const allAvailableProducts: Product[] = [];

                for (const venue of allVenues) {
                    const venueProducts = await dataService.getProducts(venue.id);
                    allAvailableProducts.push(...venueProducts.filter(p => p.quantity > 0));
                }

                if (allAvailableProducts.length === 0) {
                    setRecommendedProducts([]);
                    return;
                }

                // 2. Get AI recommendations — reconstruir objeto mínimo para el servicio
                const userSnapshot = { id: userId, city: userCity, favoriteVenueIds: userFavoriteVenueIds } as any;
                const recommendedIds = await aiService.getRecommendedPacks(userSnapshot, allAvailableProducts, allVenues);

                // 3. Filter products based on AI IDs
                const recommended = allAvailableProducts.filter(p => recommendedIds.includes(p.id));

                // Ensure we have at least some if AI fails or returns weird IDs
                setRecommendedProducts(recommended.length > 0 ? recommended : allAvailableProducts.slice(0, 3));
            } catch (err) {
                logger.error('Error in useRecommendations:', err);
                setError('No pudimos cargar tus recomendaciones personalizadas.');
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [userId, userCity, userFavoriteVenueIds]);

    return { recommendedProducts, loading, error };
}

export default useRecommendations;
