import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { User, Venue, Product, Order, UserRole } from '../types';
import { AIContext } from './geminiService';
import { logger } from '../utils/logger';

/**
 * Build comprehensive context for AI assistant from real-time app data
 */
export class AIContextBuilder {
    /**
     * Get user context information
     */
    private static getUserContext(user: User): { userName: string; userRole: string; location: string } {
        return {
            userName: user.fullName || 'Usuario',
            userRole: user.role === UserRole.SUPER_ADMIN ? 'Super Administrador' :
                user.role === UserRole.CUSTOMER ? 'Cliente' :
                    user.role === UserRole.VENUE_OWNER ? 'Dueño de Restaurante' :
                        user.role === UserRole.DRIVER ? 'Repartidor' : 'Usuario',
            location: user.address || 'Bogotá, Chapinero'
        };
    }

    /**
     * Get nearby venues information
     */
    private static async getVenuesContext(): Promise<string[]> {
        try {
            const venuesRef = collection(db, 'venues');
            const q = query(venuesRef, limit(5));
            const snapshot = await getDocs(q);

            const venues: string[] = [];
            snapshot.forEach(doc => {
                const venue = doc.data() as Venue;
                const distance = this.getRandomDistance(); // Simulated distance
                const cuisine = venue.categories && venue.categories.length > 0 ? venue.categories[0] : 'Comida variada';
                venues.push(`📍 ${venue.name} - ${distance}km - ${cuisine}`);
            });

            return venues;
        } catch (error) {
            logger.error('Error fetching venues:', error);
            return ['No se pudieron cargar los restaurantes'];
        }
    }

    /**
     * Get user's orders information
     */
    private static async getUserOrders(userId: string): Promise<string[]> {
        try {
            const ordersRef = collection(db, 'orders');
            const q = query(
                ordersRef,
                where('customerId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(3)
            );
            const snapshot = await getDocs(q);

            const orders: string[] = [];
            snapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() } as Order;
                const status = this.getStatusText(order.status);
                const orderNumber = order.id.slice(0, 8);
                orders.push(`📦 Pedido #${orderNumber} - ${status}`);
            });

            return orders;
        } catch (error) {
            logger.error('Error fetching orders:', error);
            return [];
        }
    }

    /**
     * Get active offers and promotions
     */
    private static async getActiveOffers(): Promise<string[]> {
        const offers = [
            '🎁 Pack Sorpresa: Ahorra hasta 70% en comida del día',
            '🌟 Restaurantes con ofertas especiales disponibles',
            '♻️ Ayuda a reducir el desperdicio de alimentos'
        ];
        return offers;
    }

    /**
     * Get featured products
     */
    private static async getFeaturedProducts(): Promise<string[]> {
        try {
            const productsRef = collection(db, 'products');
            const q = query(productsRef, limit(3));
            const snapshot = await getDocs(q);

            const products: string[] = [];
            snapshot.forEach(doc => {
                const product = doc.data() as Product;
                products.push(`🍽️ ${product.name} - $${product.originalPrice.toLocaleString()}`);
            });

            return products;
        } catch (error) {
            logger.error('Error fetching products:', error);
            return [];
        }
    }

    /**
     * Build complete AI context
     */
    static async buildContext(user: User): Promise<AIContext> {
        const userContext = this.getUserContext(user);

        // Fetch all context data in parallel
        const [nearbyVenues, userOrders, activeOffers, featuredProducts] = await Promise.all([
            this.getVenuesContext(),
            this.getUserOrders(user.id),
            this.getActiveOffers(),
            this.getFeaturedProducts()
        ]);

        return {
            ...userContext,
            nearbyVenues,
            userOrders,
            activeOffers,
            featuredProducts
        };
    }

    /**
     * Helper: Get random distance for venues (simulated)
     */
    private static getRandomDistance(): string {
        return (Math.random() * 5 + 0.5).toFixed(1);
    }

    /**
     * Helper: Convert order status to Spanish text
     */
    private static getStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'pending': 'Pendiente',
            'confirmed': 'Confirmado',
            'preparing': 'Preparando',
            'ready': 'Listo para recoger',
            'in_transit': 'En camino',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado'
        };
        return statusMap[status] || status;
    }
}
