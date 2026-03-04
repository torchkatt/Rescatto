import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Product, ProductType } from '../types';
import { logger } from '../utils/logger';

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
            const q = query(productsRef, where('venueId', '==', venueId));
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
            const docRef = await addDoc(collection(db, this.collectionName), {
                ...productData,
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
            await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });

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
}

export const productService = new ProductService();
