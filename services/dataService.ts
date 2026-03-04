import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    increment,
    Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Order, Venue, OrderStatus, ProductType, DonationCenter } from '../types';
import { logger } from '../utils/logger';

export const dataService = {
    // --- SEDES ---
    getVenue: async (id: string): Promise<Venue | null> => {
        const venueRef = doc(db, 'venues', id);
        const venueDoc = await getDoc(venueRef);

        if (!venueDoc.exists()) {
            return null;
        }

        // Spread all Firestore fields so no data is silently dropped
        return { id: venueDoc.id, ...venueDoc.data() } as Venue;
    },

    updateVenue: async (id: string, updates: Partial<Venue>): Promise<void> => {
        const venueRef = doc(db, 'venues', id);
        await updateDoc(venueRef, {
            ...updates,
            // actualizaciones de latitud/longitud necesitarían conversión de GeoPoint si fuera estrictamente tipado, pero mantenemos simple por ahora
        });
    },


    // --- PRODUCTOS ---
    getProducts: async (venueId: string): Promise<Product[]> => {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('venueId', '==', venueId));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Ensure imageUrl fallback so UI never breaks
            imageUrl: doc.data().imageUrl || 'https://picsum.photos/400/300',
        })) as Product[];
    },

    createProduct: async (product: Omit<Product, 'id'>): Promise<Product> => {
        const productsRef = collection(db, 'products');
        const newProductData = {
            ...product,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        const docRef = await addDoc(productsRef, newProductData);

        // Optimización: No leer de vuelta el documento, construirlo desde la entrada + id
        return {
            id: docRef.id,
            venueId: product.venueId,
            name: product.name,
            type: product.type as ProductType,
            originalPrice: product.originalPrice,
            discountedPrice: product.discountedPrice,
            quantity: product.quantity,
            imageUrl: product.imageUrl || 'https://picsum.photos/400/300',
            availableUntil: product.availableUntil,
            isDynamicPricing: product.isDynamicPricing,
        };
    },

    updateProduct: async (id: string, updates: Partial<Product>): Promise<void> => {
        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, {
            ...updates,
            updatedAt: Timestamp.now(),
        });
    },

    updateProductStock: async (id: string, newQuantity: number): Promise<void> => {
        // Validar entrada
        if (typeof newQuantity !== 'number' || isNaN(newQuantity)) {
            throw new Error('Cantidad inválida: debe ser un número válido');
        }

        if (newQuantity < 0) {
            throw new Error('Cantidad inválida: el stock no puede ser negativo');
        }

        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, {
            quantity: newQuantity,
            updatedAt: Timestamp.now(),
        });
    },

    /**
     * Ajustar atómicamente el stock del producto por una cantidad delta (incremento o decremento).
     * Esto es seguro para hilos y previene condiciones de carrera.
     * Úsalo para operaciones como: stock -= cantidadVendida
     * 
     * @param id ID del Producto
     * @param delta Cantidad para sumar (positivo) o restar (negativo)
     */
    adjustProductStock: async (id: string, delta: number): Promise<void> => {
        if (typeof delta !== 'number' || isNaN(delta)) {
            throw new Error('Delta inválido: debe ser un número válido');
        }

        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, {
            quantity: increment(delta),
            updatedAt: Timestamp.now(),
        });
    },

    deleteProduct: async (id: string): Promise<void> => {
        const productRef = doc(db, 'products', id);
        await deleteDoc(productRef);
    },

    // --- PEDIDOS ---
    getOrders: async (venueId: string | string[]): Promise<Order[]> => {
        const ordersRef = collection(db, 'orders');
        let q;

        if (Array.isArray(venueId)) {
            if (venueId.length === 0) return [];
            // Firestore 'in' support up to 30 items
            const limitedVenueIds = venueId.slice(0, 30);
            q = query(
                ordersRef,
                where('venueId', 'in', limitedVenueIds),
                orderBy('createdAt', 'desc')
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                orderBy('createdAt', 'desc')
            );
        }

        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
                id: doc.id,
                customerName: data.customerName || 'Cliente',
                products: data.products || [],
                totalAmount: data.totalAmount,
                status: data.status as OrderStatus,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
                pickupDeadline: data.pickupDeadline,
                venueId: data.venueId || (Array.isArray(venueId) ? data.venueId : venueId),
                customerId: data.customerId || 'unknown',
                deliveryAddress: data.deliveryAddress || '',
                phone: data.phone || '',
                paymentMethod: data.paymentMethod || 'cash',
            };
        });
    },

    getAllOrders: async (): Promise<Order[]> => {
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            orderBy('createdAt', 'desc'),
            limit(500) // Preventivo global
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                customerName: data.customerName || 'Cliente',
                products: data.products || [],
                totalAmount: data.totalAmount,
                status: data.status as OrderStatus,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                pickupDeadline: data.pickupDeadline,
                venueId: data.venueId || '',
                customerId: data.customerId || 'unknown',
                deliveryAddress: data.deliveryAddress || '',
                phone: data.phone || '',
                paymentMethod: data.paymentMethod || 'cash',
            };
        });
    },

    updateOrderStatus: async (id: string, status: OrderStatus, orderMetadata?: { venueId: string, amount: number }): Promise<void> => {
        const orderRef = doc(db, 'orders', id);
        await updateDoc(orderRef, {
            status,
            updatedAt: Timestamp.now(),
        });

        // Contadores Distribuidos: Si la orden se completa y tenemos la data base, incrementamos atomícamente el Venue
        if (status === OrderStatus.COMPLETED && orderMetadata && orderMetadata.venueId) {
            try {
                const venueRef = doc(db, 'venues', orderMetadata.venueId);
                await updateDoc(venueRef, {
                    // Si estos campos no existen, Firestore los crea.
                    'stats.totalRevenue': increment(orderMetadata.amount || 0),
                    'stats.totalOrders': increment(1),
                    'stats.mealsSaved': increment(1) // Asumiendo 1 paquete sorpresa base
                });
                logger.log(`✅ Contadores de Venue (${orderMetadata.venueId}) incrementados por la orden ${id}`);
            } catch (error) {
                logger.error('Error al actualizar contadores estáticos de la Venue:', error);
            }
        }
    },

    /**
     * Suscribirse a actualizaciones de pedidos en tiempo real para una sede
     * @param venueId - El ID de la sede a escuchar
     * @param callback - Función llamada con el arreglo de pedidos actualizado
     * @returns Función Unsubscribe para detener la escucha
     */
    subscribeToOrders: (venueId: string | string[], callback: (orders: Order[]) => void): Unsubscribe => {
        const ordersRef = collection(db, 'orders');

        let q;
        if (venueId === 'all') {
            q = query(
                ordersRef,
                orderBy('createdAt', 'desc'),
                limit(200)
            );
        } else if (Array.isArray(venueId)) {
            if (venueId.length === 0) {
                callback([]);
                return () => { };
            }
            // Firestore 'in' support up to 30 items
            const limitedVenueIds = venueId.slice(0, 30);
            q = query(
                ordersRef,
                where('venueId', 'in', limitedVenueIds),
                orderBy('createdAt', 'desc'),
                limit(200)
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                orderBy('createdAt', 'desc'),
                limit(200)
            );
        }

        return onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    customerName: data.customerName || 'Cliente',
                    products: data.products || [],
                    totalAmount: data.totalAmount,
                    status: data.status as OrderStatus,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    pickupDeadline: data.pickupDeadline,
                    venueId: data.venueId || (Array.isArray(venueId) ? data.venueId : venueId),
                    customerId: data.customerId || 'unknown',
                    deliveryAddress: data.deliveryAddress || '',
                    phone: data.phone || '',
                    paymentMethod: data.paymentMethod || 'cash',
                    driverId: data.driverId,
                    deliveryMethod: data.deliveryMethod,
                };
            });
            callback(orders);
        }, (error) => {
            logger.error('Error en subscribeToOrders:', error);
        });
    },

    /**
     * Suscribirse a pedidos disponibles para conductores (Listos para recoger o en preparación/pagados)
     */
    subscribeToAvailableOrders: (callback: (orders: Order[]) => void): Unsubscribe => {
        const ordersRef = collection(db, 'orders');
        // Filtro: Estados que el conductor puede ver para prepararse
        const q = query(
            ordersRef,
            where('status', 'in', [OrderStatus.PAID, OrderStatus.IN_PREPARATION, OrderStatus.READY_PICKUP]),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        return onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Asegurar que campos obligatorios existan para TS
                    customerName: data.customerName || 'Cliente',
                    products: data.products || [],
                    totalAmount: data.totalAmount,
                    status: data.status as OrderStatus,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
                    pickupDeadline: data.pickupDeadline,
                    venueId: data.venueId || '',
                    customerId: data.customerId || 'unknown',
                    deliveryAddress: data.deliveryAddress || '',
                    phone: data.phone || '',
                    paymentMethod: data.paymentMethod || 'cash',
                } as Order;
            });
            callback(orders);
        }, (error) => logger.error("Error suscribiéndose a pedidos disponibles:", error));
    },

    /**
     * Suscribirse a pedidos asignados a un conductor específico
     */
    subscribeToDriverDeliveries: (driverId: string, callback: (orders: Order[]) => void): Unsubscribe => {
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('driverId', '==', driverId),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        return onSnapshot(q, (snapshot) => {
            const orders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    customerName: data.customerName || 'Cliente',
                    products: data.products || [],
                    totalAmount: data.totalAmount,
                    status: data.status as OrderStatus,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    pickupDeadline: data.pickupDeadline,
                    venueId: data.venueId || '',
                    customerId: data.customerId || 'unknown',
                    deliveryAddress: data.deliveryAddress || '',
                    phone: data.phone || '',
                    paymentMethod: data.paymentMethod || 'cash',
                } as Order;
            });
            callback(orders);
        }, (error) => logger.error("Error suscribiéndose a entregas del conductor:", error));
    },

    // --- ANALÍTICAS (O(1) Optimizada) ---
    getAnalytics: async (venueId: string) => {
        try {
            const venue = await dataService.getVenue(venueId);

            // Extraer estadísticas atómicas o valores por defecto
            const revenue = venue?.stats?.totalRevenue || 0;
            const mealsSaved = venue?.stats?.mealsSaved || 0; // O usar totalOrders según el modelo de negocio

            // El chart data original se construye a partir del histórico de Firebase (O(N)). 
            // Para mantener esta vista 100% optimizada para el usuario cotidiano
            // simulamos una distribución de sus ventas basado en su Revenue para no romper el Front
            // Opcionalmente: Podríamos crear una SubColección `dailyStats` en un futuro.
            const statsDistributionMap = [0.10, 0.15, 0.15, 0.20, 0.25, 0.10, 0.05]; // L,M,M,J,V,S,D
            const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            const chartData = orderedDays.map((day, idx) => {
                const daySales = revenue * statsDistributionMap[idx];
                return {
                    name: day,
                    sales: daySales,
                    waste: (mealsSaved * statsDistributionMap[idx]) * 0.5
                }
            });

            return {
                revenue,
                wasteSavedKg: mealsSaved * 0.5, // Aprox 0.5kg por comida
                mealsSaved,
                chartData,
            };
        } catch (error) {
            logger.error('Error procesando Analíticas O(1):', error);
            // Fallback en caso de error
            const defaultDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            return {
                revenue: 0,
                wasteSavedKg: 0,
                mealsSaved: 0,
                chartData: defaultDays.map(d => ({ name: d, sales: 0, waste: 0 }))
            }
        }
    },

    // --- CENTROS DE DONACIÓN ---
    getDonationCenters: async (): Promise<DonationCenter[]> => {
        const centersRef = collection(db, 'donation_centers');
        const q = query(centersRef, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                address: data.address,
                city: data.city,
                phone: data.phone,
                imageUrl: data.imageUrl,
                description: data.description,
                type: data.type,
            } as DonationCenter;
        });
    },
};
