import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, Timestamp, limit, orderBy, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { Product, ProductType } from '../types';
import { logger } from '../utils/logger';
import { isProductExpired } from '../utils/productAvailability';

/**
 * Genera un array de palabras clave para búsqueda prefix-based en Firestore.
 * Incluye combinaciones de nombre, categoría y etiquetas.
 */
const generateKeywords = (str: string): string[] => {
    if (!str) return [];
    const words = str.toLowerCase().trim().split(/\s+/);
    const keywords = new Set<string>();

    words.forEach(word => {
        let prefix = "";
        for (let i = 0; i < word.length; i++) {
            prefix += word[i];
            keywords.add(prefix);
        }
    });

    // También agregar la frase completa limpia por palabras
    words.forEach(w => keywords.add(w));
    
    return Array.from(keywords);
};

export class ProductService {
    private collectionName = 'products';
    private cacheKeyPrefix = 'products_cache_';
    private defaultCacheTTL = 5 * 60 * 1000; // 5 minutos en milisegundos

    /**
     * Obtiene todos los productos de un Venue específico con soporte de Caché
     */
    async getProductsByVenue(venueId: string, forceRefresh: boolean = false): Promise<Product[]> {
        const cacheKey = `${this.cacheKeyPrefix}${venueId}`;

        try {
            // 1. Revisar Caché Local si no se fuerza limpieza
            if (!forceRefresh) {
                const cachedData = localStorage.getItem(cacheKey);
                if (cachedData) {
                    const parsedCache = JSON.parse(cachedData);
                    if (Date.now() < parsedCache.expiry) {
                        return parsedCache.data as Product[];
                    }
                }
            }

            // 2. Si no hay caché o Forzamos Refresh, ir a Firebase
            const productsRef = collection(db, this.collectionName);
            const q = query(productsRef, where('venueId', '==', venueId), limit(20));
            const snapshot = await getDocs(q);

            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];

            // 3. Guardar en storage
            localStorage.setItem(cacheKey, JSON.stringify({
                expiry: Date.now() + this.defaultCacheTTL,
                data: products
            }));

            return products;
        } catch (error) {
            logger.error(`Error fetching products for venue ${venueId}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene productos por venue con paginación (sin caché)
     */
    async getProductsByVenuePage(
        venueId: string,
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ): Promise<{ products: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
        try {
            const productsRef = collection(db, this.collectionName);
            const constraints: any[] = [
                where('venueId', '==', venueId),
                orderBy('__name__'),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(productsRef, ...constraints);
            const snapshot = await getDocs(q);
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];

            return {
                products,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error(`Error fetching paged products for venue ${venueId}:`, error);
            return { products: [], lastDoc: null, hasMore: false };
        }
    }

    /**
     * Obtiene un producto por ID
     */
    async getProductById(productId: string): Promise<Product | null> {
        try {
            const docRef = doc(db, this.collectionName, productId);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return {
                    id: snapshot.id,
                    ...snapshot.data()
                } as Product;
            }
            return null;
        } catch (error) {
            logger.error(`Error fetching product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Crea un nuevo producto
     */
    async createProduct(productData: Omit<Product, 'id'>): Promise<Product> {
        try {
            const keywords = [
                ...generateKeywords(productData.name),
                ...(productData.category ? generateKeywords(productData.category) : []),
                ...(productData.dietaryTags || []).map(t => t.toLowerCase())
            ];

            const docRef = await addDoc(collection(db, this.collectionName), {
                ...productData,
                searchKeywords: Array.from(new Set(keywords)),
                createdAt: Timestamp.now()
            });

            const response = {
                id: docRef.id,
                ...productData
            } as Product;

            // Invalidar el caché
            localStorage.removeItem(`${this.cacheKeyPrefix}${productData.venueId}`);

            return response;
        } catch (error) {
            logger.error('Error creating product:', error);
            throw error;
        }
    }

    /**
     * Actualiza un producto existente
     */
    async updateProduct(productId: string, data: Partial<Omit<Product, 'id'>>, venueId?: string): Promise<void> {
        try {
            const docRef = doc(db, this.collectionName, productId);
            
            let updateData: any = { ...data, updatedAt: Timestamp.now() };
            
            if (data.name || data.category || data.dietaryTags) {
                // Regenerar keywords si cambian campos clave
                const currentDoc = await getDoc(docRef);
                const currentData = currentDoc.data() as Product;
                const name = data.name || currentData.name;
                const category = data.category || currentData.category;
                const tags = data.dietaryTags || currentData.dietaryTags || [];
                
                const keywords = [
                    ...generateKeywords(name),
                    ...(category ? generateKeywords(category) : []),
                    ...tags.map(t => t.toLowerCase())
                ];
                updateData.searchKeywords = Array.from(new Set(keywords));
            }

            await updateDoc(docRef, updateData);

            // Invalidar el caché si tenemos el venueId
            if (venueId) localStorage.removeItem(`${this.cacheKeyPrefix}${venueId}`);
        } catch (error) {
            logger.error(`Error updating product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Elimina un producto logicamente o físicamente
     */
    async deleteProduct(productId: string, venueId?: string): Promise<void> {
        try {
            // Real physical deletion for this example
            const docRef = doc(db, this.collectionName, productId);
            await deleteDoc(docRef);

            // Invalidar caché
            if (venueId) localStorage.removeItem(`${this.cacheKeyPrefix}${venueId}`);
        } catch (error) {
            logger.error(`Error deleting product ${productId}:`, error);
            throw error;
        }
    }

    /**
     * Búsqueda global de productos usando keywords y filtros
     */
    async searchProducts(searchTerm: string, filters: { city?: string, category?: string, diet?: string } = {}): Promise<Product[]> {
        const productsRef = collection(db, this.collectionName);
        let q = query(productsRef, where('isActive', '==', true), limit(20));

        if (searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            q = query(q, where('searchKeywords', 'array-contains', term));
        }

        if (filters.city) {
            q = query(q, where('city', '==', filters.city));
        }

        if (filters.category) {
            q = query(q, where('category', '==', filters.category));
        }

        if (filters.diet) {
            q = query(q, where('dietaryTags', 'array-contains', filters.diet));
        }

        try {
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];
        } catch (error) {
            logger.error('Error during product search:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los productos activos (con stock y no expirados) para una ciudad.
     */
    async getAllActiveProducts(city?: string): Promise<Product[]> {
        try {
            const productsRef = collection(db, this.collectionName);
            const products: Product[] = [];
            let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
            let hasMore = true;
            let iterations = 0;
            const MAX_ITERATIONS = 20;
            while (hasMore) {
                if (++iterations > MAX_ITERATIONS) {
                    logger.warn('Pagination safety limit reached in getAllActiveProducts');
                    break;
                }
                const constraints: any[] = [
                    where('quantity', '>', 0),
                    orderBy('quantity', 'desc'),
                ];
                if (city) constraints.push(where('city', '==', city));
                if (lastDoc) constraints.push(startAfter(lastDoc));
                constraints.push(limit(50));
                const q = query(productsRef, ...constraints);
                const snapshot = await getDocs(q);
                products.push(...snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Product[]);
                lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
                hasMore = snapshot.docs.length === 50;
            }

            const now = Date.now();
            return products.filter(p => !isProductExpired((p as Product).availableUntil, now));
        } catch (error) {
            logger.error('Error fetching all active products:', error);
            return [];
        }
    }

    /**
     * Obtiene productos activos con paginación.
     */
    async getAllActiveProductsPage(
        city?: string,
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ): Promise<{ products: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
        try {
            const productsRef = collection(db, this.collectionName);
            const constraints: any[] = [
                where('quantity', '>', 0),
                orderBy('quantity', 'desc'),
            ];
            if (city) constraints.push(where('city', '==', city));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));

            const q = query(productsRef, ...constraints);
            const snapshot = await getDocs(q);
            const now = Date.now();
            const products = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(p => !isProductExpired((p as Product).availableUntil, now)) as Product[];

            return {
                products,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error('Error fetching active products page:', error);
            return { products: [], lastDoc: null, hasMore: false };
        }
    }
}

export const productService = new ProductService();
