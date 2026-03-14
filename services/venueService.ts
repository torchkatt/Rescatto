import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    limit,
    orderBy,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Venue, Product } from '../types';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';
import { isProductExpired } from '../utils/productAvailability';
import { safeParseVenue, safeParseProduct } from '../schemas';

// Claves de caché
const CACHE_KEYS = {
    ALL_VENUES: (city?: string) => `rescatto_all_venues_${city || 'global'}`,
    VENUE_DETAILS: (id: string) => `rescatto_venue_${id}`,
    VENUE_PRODUCTS: (id: string) => `rescatto_products_${id}`,
};

// Tiempos de expiración (en minutos)
const TTL = {
    ALL_VENUES: 15,
    VENUE_DETAILS: 15,
    VENUE_PRODUCTS: 5,
};

export const venueService = {
    // Obtener todos los venues activos
    getAllVenues: async (city?: string): Promise<Venue[]> => {
        // 1. Intentar leer desde caché
        const cacheKey = CACHE_KEYS.ALL_VENUES(city);
        const cached = cacheService.get<Venue[]>(cacheKey);
        if (cached) {
            // Log only in development or use debug level
            return cached;
        }

        logger.log(`🔥 Leyendo venues (${city || 'global'}) de Firestore`);
        const venuesRef = collection(db, 'venues');
        const venues: Venue[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        while (hasMore) {
            const constraints: any[] = [orderBy('name')];
            if (city) constraints.unshift(where('city', '==', city));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(venuesRef, ...constraints);
            const querySnapshot = await getDocs(q);
            const batch = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const result = safeParseVenue({ id: doc.id, ...data });
                if (!result.success) {
                    logger.error(`❌ Venue ${doc.id} parsing failed:`, result.error.format());
                    return null;
                }
                return result.data;
            }).filter(v => v !== null) as Venue[];
            venues.push(...batch);
            lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
            hasMore = querySnapshot.docs.length === 50;
        }

        // 2. Guardar en caché
        cacheService.set(cacheKey, venues, TTL.ALL_VENUES);

        return venues;
    },

    // Obtener venues con paginación
    getAllVenuesPage: async (
        city?: string,
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ): Promise<{ venues: Venue[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
        try {
            const venuesRef = collection(db, 'venues');
            const constraints: any[] = [orderBy('name')];
            if (city) constraints.unshift(where('city', '==', city));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(venuesRef, ...constraints);
            const snapshot = await getDocs(q);

            const venues = snapshot.docs.map(doc => {
                const data = doc.data();
                const result = safeParseVenue({ id: doc.id, ...data });
                if (!result.success) {
                    logger.error(`❌ Venue ${doc.id} parsing failed:`, result.error.format());
                    return null;
                }
                return result.data;
            }).filter(v => v !== null) as Venue[];

            return {
                venues,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error('getAllVenuesPage error:', error);
            return { venues: [], lastDoc: null, hasMore: false };
        }
    },

    // Obtener un venue por ID
    getVenueById: async (venueId: string): Promise<Venue | null> => {
        const cacheKey = CACHE_KEYS.VENUE_DETAILS(venueId);
        const cached = cacheService.get<Venue>(cacheKey);
        if (cached) return cached;

        const venueRef = doc(db, 'venues', venueId);
        const venueDoc = await getDoc(venueRef);

        if (!venueDoc.exists()) return null;

        const result = safeParseVenue({ id: venueDoc.id, ...venueDoc.data() });
        if (!result.success) {
            logger.error(`❌ Venue ${venueId} parsing failed:`, result.error.format());
            return null;
        }
        const venue = result.data as Venue;

        cacheService.set(cacheKey, venue, TTL.VENUE_DETAILS);
        return venue;
    },

    // Obtener productos activos (con stock y sin expirar) de un venue
    getVenueProducts: async (venueId: string): Promise<Product[]> => {
        const cacheKey = CACHE_KEYS.VENUE_PRODUCTS(venueId);
        const cached = cacheService.get<Product[]>(cacheKey);
        if (cached) return cached;

        const productsRef = collection(db, 'products');
        const q = query(
            productsRef,
            where('venueId', '==', venueId),
            limit(20)
        );
        const querySnapshot = await getDocs(q);

        const now = Date.now();
        const products = querySnapshot.docs
            .map(doc => {
                const data = doc.data();
                const result = safeParseProduct({ id: doc.id, ...data });
                if (!result.success) {
                    logger.error(`❌ Product ${doc.id} parsing failed:`, result.error.format());
                    return null;
                }
                return result.data;
            })
            .filter(p => p !== null && (p.quantity ?? 0) > 0 && !isProductExpired(p.availableUntil, now)) as Product[];

        cacheService.set(cacheKey, products, TTL.VENUE_PRODUCTS);
        return products;
    },

    // Obtener productos por venue con paginación (sin caché)
    getVenueProductsPage: async (
        venueId: string,
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ): Promise<{ products: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
        try {
            const productsRef = collection(db, 'products');
            const constraints: any[] = [
                where('venueId', '==', venueId),
                orderBy('__name__'),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));
            const q = query(productsRef, ...constraints);
            const querySnapshot = await getDocs(q);

            const now = Date.now();
            const products = querySnapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const result = safeParseProduct({ id: doc.id, ...data });
                    if (!result.success) {
                        logger.error(`❌ Product ${doc.id} parsing failed:`, result.error.format());
                        return null;
                    }
                    return result.data;
                })
                .filter(p => p !== null && (p.quantity ?? 0) > 0 && !isProductExpired(p.availableUntil, now)) as Product[];

            return {
                products,
                lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
                hasMore: querySnapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error('getVenueProductsPage error:', error);
            return { products: [], lastDoc: null, hasMore: false };
        }
    },

    // Obtener un producto por ID
    getProductById: async (productId: string): Promise<Product | null> => {
        const productRef = doc(db, 'products', productId);
        const productDoc = await getDoc(productRef);

        if (!productDoc.exists()) return null;

        return {
            id: productDoc.id,
            ...productDoc.data(),
        } as Product;
    },

    /**
     * Returns a Map<venueId, soonestAvailableUntil> for products expiring within the next 3 hours.
     * Single Firestore query (range on one field) — no composite index needed.
     */
    getExpiringProductsByVenue: async (): Promise<Map<string, string>> => {
        const now = new Date().toISOString();
        const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

        try {
            const q = query(
                collection(db, 'products'),
                where('availableUntil', '>', now),
                where('availableUntil', '<=', threeHoursFromNow)
            );
            const snapshot = await getDocs(q);

            const expiryMap = new Map<string, string>();
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (!data.venueId || !data.availableUntil || (data.quantity ?? 0) <= 0) return;
                const current = expiryMap.get(data.venueId);
                // Keep the soonest (earliest) expiry per venue
                if (!current || data.availableUntil < current) {
                    expiryMap.set(data.venueId, data.availableUntil);
                }
            });

            return expiryMap;
        } catch (error) {
            logger.error('getExpiringProductsByVenue error:', error);
            return new Map();
        }
    },

    /**
     * Returns stockMap (total units) and productCountMap (distinct active products)
     * for all non-expired products with quantity > 0.
     * Used for FOMO indicators and the "X productos activos" badge on venue cards.
     */
    getStockCountByVenue: async (): Promise<{ stockMap: Map<string, number>; productCountMap: Map<string, number> }> => {
        try {
            const q = query(
                collection(db, 'products'),
                where('quantity', '>', 0)
            );
            const snapshot = await getDocs(q);
            const now = Date.now();
            const stockMap = new Map<string, number>();
            const productCountMap = new Map<string, number>();
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (!data.venueId) return;
                // Exclude expired products
                if (data.availableUntil && isProductExpired(data.availableUntil, now)) return;
                stockMap.set(data.venueId, (stockMap.get(data.venueId) ?? 0) + (data.quantity ?? 0));
                productCountMap.set(data.venueId, (productCountMap.get(data.venueId) ?? 0) + 1);
            });
            return { stockMap, productCountMap };
        } catch (error) {
            logger.error('getStockCountByVenue error:', error);
            return { stockMap: new Map(), productCountMap: new Map() };
        }
    },

    /**
     * Returns Set of venueIds that currently have at least one product with
     * isDynamicPricing=true AND dynamicDiscountedPrice set (i.e. the CF ran).
     * Used to show "⬇️ precio bajando" badge on VenueCard in Home.
     */
    getDynamicPricingVenueIds: async (): Promise<Set<string>> => {
        try {
            const q = query(
                collection(db, 'products'),
                where('isDynamicPricing', '==', true),
                where('quantity', '>', 0)
            );
            const snapshot = await getDocs(q);
            const ids = new Set<string>();
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.dynamicDiscountedPrice) ids.add(data.venueId);
            });
            return ids;
        } catch (error) {
            logger.error('getDynamicPricingVenueIds error:', error);
            return new Set();
        }
    },

    // Invalidar caché (útil para pull-to-refresh)
    clearCache: () => {
        cacheService.clearByPrefix('rescatto_all_venues_');
        cacheService.clearByPrefix('rescatto_venue_');
        cacheService.clearByPrefix('rescatto_products_');
    }
};
