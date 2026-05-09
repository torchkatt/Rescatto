import {
    collection,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
    getCountFromServer,
    where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { User, Venue, Product, Order, UserRole } from '../types';
import { loggerService } from './loggerService';
import { logger } from '../utils/logger';
import { inMemorySearch } from '../utils/searchUtils';

const VENUES_CACHE_KEY = 'venues_cache_all';
const CACHE_TTL = 10 * 60 * 1000; // 10 Minutos de Caché para Negocios (Suelen cambiar poco)

export const adminService = {
    // --- AUDIT LOGS ---
    getAuditLogsPaginated: async (pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
        const logsRef = collection(db, 'audit_logs');
        let q = query(logsRef, orderBy('timestamp', 'desc'), limit(pageSize));

        if (lastDoc) {
            q = query(logsRef, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as any
        }));

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    // --- USUARIOS ---

    async getAllUsers(cityFilter?: string): Promise<User[]> {
        const usersRef = collection(db, 'users');
        const users: User[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        let iterations = 0;
        const MAX_ITERATIONS = 20;
        while (hasMore) {
            if (++iterations > MAX_ITERATIONS) {
                logger.warn('Pagination safety limit reached in getAllUsers');
                break;
            }
            const constraints: any[] = [orderBy('__name__')];
            if (cityFilter) constraints.push(where('city', '==', cityFilter));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);
            users.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            })) as User[]);
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }
        return users;
    },

    async getUsersCount() {
        const usersRef = collection(db, 'users');
        const snapshot = await getCountFromServer(usersRef);
        return snapshot.data().count;
    },

    async getUsersCountByRole(role: string) {
        const usersRef = collection(db, 'users');
        const snapshot = await getCountFromServer(query(usersRef, where('role', '==', role)));
        return snapshot.data().count;
    },

    async getUsersPaginated(pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null, searchTerm: string = '', roleFilter: string = '') {
        const usersRef = collection(db, 'users');

        if (searchTerm) {
            const allUsers = await this.getAllUsers();
            const result = inMemorySearch<User>(allUsers, searchTerm, ['fullName', 'email', 'city', 'role', 'id']);
            // Aplica filtro de rol si está activo
            if (roleFilter) result.data = result.data.filter(u => u.role === roleFilter) as any;
            return result;
        }

        // PAGINACIÓN NORMAL: sin búsqueda, paginación por cursor eficiente
        let q;
        if (roleFilter) {
            q = lastDoc
                ? query(usersRef, where('role', '==', roleFilter), startAfter(lastDoc), limit(pageSize))
                : query(usersRef, where('role', '==', roleFilter), limit(pageSize));
        } else {
            q = lastDoc
                ? query(usersRef, startAfter(lastDoc), limit(pageSize))
                : query(usersRef, limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as any
        })) as User[];

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    updateUser: async (userId: string, data: Partial<User>, adminId?: string) => {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, data);
        if (adminId) {
            await loggerService.logAction('USER_UPDATED', adminId, userId, 'users', data);
        }
    },

    verifyUser: async (userId: string, isVerified: boolean, adminId: string) => {
        const userRef = doc(db, 'users', userId);
        const updateData = {
            isVerified,
            verificationDate: isVerified ? new Date().toISOString() : null,
            verifiedBy: isVerified ? adminId : null
        };
        await updateDoc(userRef, updateData);
        await loggerService.logAction(
            isVerified ? 'USER_VERIFIED' : 'USER_UNVERIFIED',
            adminId,
            userId,
            'users',
            updateData
        );
    },

    // Elimina el documento de Firestore y la cuenta de Firebase Auth (vía Cloud Function)
    deleteUserDoc: async (userId: string, adminId?: string) => {
        try {
            // Invocamos la Cloud Function que se encarga de Auth y Firestore (Admin SDK bypasses rules)
            const deleteAccount = httpsCallable(functions, 'deleteUserAccount');
            await deleteAccount({ uid: userId });

            if (adminId) {
                await loggerService.logAction('USER_DELETED', adminId, userId, 'users', {});
            }
        } catch (error) {
            logger.error("Error al eliminar usuario (Auth/Firestore):", error);
            throw error; // Lanzamos para que el frontend pueda mostrar el error
        }
    },
    
    async getDriversPaginated(pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null, searchTerm: string = '') {
        const usersRef = collection(db, 'users');
        
        if (searchTerm) {
            const allDrivers = (await this.getAllUsers()).filter(u => u.role === UserRole.DRIVER);
            return inMemorySearch<User>(allDrivers, searchTerm, ['fullName', 'email', 'city', 'id']);
        }

        const q = lastDoc
            ? query(usersRef, where('role', '==', UserRole.DRIVER), startAfter(lastDoc), limit(pageSize))
            : query(usersRef, where('role', '==', UserRole.DRIVER), limit(pageSize));

        const snapshot = await getDocs(q);
        return {
            data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })) as User[],
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    async getDriversCount() {
        const usersRef = collection(db, 'users');
        const snapshot = await getCountFromServer(query(usersRef, where('role', '==', UserRole.DRIVER)));
        return snapshot.data().count;
    },

    // --- GESTIÓN DE SEDES ---

    getAllVenues: async (forceRefresh: boolean = false, cityFilter?: string): Promise<Venue[]> => {
        const cacheKey = cityFilter ? `${VENUES_CACHE_KEY}_${cityFilter}` : VENUES_CACHE_KEY;
        
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() < parsed.expiry) return parsed.data;
            }
        }

        const venuesRef = collection(db, 'venues');
        const venues: Venue[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        let iterations = 0;
        const MAX_ITERATIONS = 20;

        while (hasMore) {
            if (++iterations > MAX_ITERATIONS) {
                logger.warn('Pagination safety limit reached in getAllVenues');
                break;
            }
            const constraints: any[] = [orderBy('__name__')];
            if (cityFilter) constraints.push(where('city', '==', cityFilter));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(venuesRef, ...constraints);
            const snapshot = await getDocs(q);
            const batch = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            })) as Venue[];
            venues.push(...batch);
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }

        localStorage.setItem(cacheKey, JSON.stringify({
            expiry: Date.now() + CACHE_TTL,
            data: venues
        }));

        return venues;
    },

    getVenuesPaginated: async (pageSize: number = 10, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
        const venuesRef = collection(db, 'venues');
        let q = query(venuesRef, limit(pageSize));

        if (lastDoc) {
            q = query(venuesRef, startAfter(lastDoc), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as any
        })) as Venue[];

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    createVenue: async (venueData: Omit<Venue, 'id'>, adminId: string) => {
        // Crea un nuevo documento en colección 'venues'
        const docRef = await addDoc(collection(db, 'venues'), venueData);

        // Registrar acción en auditoría
        await loggerService.logAction('VENUE_CREATED', adminId, docRef.id, 'venues', {
            name: venueData.name,
            type: venueData.businessType
        });

        // Invalidar Cachés Administrativos y de Cliente
        localStorage.removeItem(VENUES_CACHE_KEY);

        // Actualizar el doc con su propio ID si es necesario, o solo retornarlo
        return { id: docRef.id, ...venueData };
    },

    updateVenue: async (venueId: string, data: Partial<Venue>, adminId: string) => {
        const venueRef = doc(db, 'venues', venueId);
        await updateDoc(venueRef, data);

        // Registrar acción en auditoría
        await loggerService.logAction('VENUE_UPDATED', adminId, venueId, 'venues', data);

        localStorage.removeItem(VENUES_CACHE_KEY); // Limpiar caché
    },

    deleteVenue: async (venueId: string, adminId: string) => {
        await deleteDoc(doc(db, 'venues', venueId));

        // Registrar acción en auditoría
        await loggerService.logAction('VENUE_DELETED', adminId, venueId, 'venues', {});

        localStorage.removeItem(VENUES_CACHE_KEY); // Limpiar caché
    },

    getAllProducts: async (cityFilter?: string): Promise<Product[]> => {
        const productsRef = collection(db, 'products');
        const products: Product[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        let iterations = 0;
        const MAX_ITERATIONS = 20;

        while (hasMore) {
            if (++iterations > MAX_ITERATIONS) {
                logger.warn('Pagination safety limit reached in getAllProducts');
                break;
            }
            const constraints: any[] = [orderBy('__name__')];
            if (cityFilter) {
                constraints.push(where('city', '==', cityFilter));
            }
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(productsRef, ...constraints);
            const snapshot = await getDocs(q);
            const batch = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            })) as Product[];
            products.push(...batch);
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }

        return products;
    },

    // --- GESTIÓN DE CATEGORÍAS ---

    getAllCategories: async (): Promise<any[]> => {
        try {
            const categories: any[] = [];
            let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
            let hasMore = true;
            let iterations = 0;
            const MAX_ITERATIONS = 20;
            while (hasMore) {
                if (++iterations > MAX_ITERATIONS) {
                    logger.warn('Pagination safety limit reached in getAllCategories');
                    break;
                }
                const q = lastDoc
                    ? query(collection(db, 'categories'), orderBy('__name__'), startAfter(lastDoc), limit(50))
                    : query(collection(db, 'categories'), orderBy('__name__'), limit(50));
                const snapshot = await getDocs(q);
                categories.push(...snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data() as any
                })));
                lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
                hasMore = snapshot.docs.length === 50;
            }
            return categories;
        } catch (error) {
            logger.error('Error obteniendo categorías desde servicio:', error);
            throw error;
        }
    },

    async getCategoriesPaginated(pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null, searchTerm: string = '') {
        try {
            const categoriesRef = collection(db, 'categories');
            
            if (searchTerm) {
                const allCats = await this.getAllCategories();
                return inMemorySearch<any>(allCats, searchTerm, ['name', 'slug']);
            }

            let q = query(categoriesRef, orderBy('name'), limit(pageSize));
            if (lastDoc) {
                q = query(categoriesRef, orderBy('name'), startAfter(lastDoc), limit(pageSize));
            }
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            }));
            return {
                data,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize
            };
        } catch (error) {
            logger.error('Error obteniendo categorías paginadas:', error);
            throw error;
        }
    },

    createCategory: async (data: any, adminId: string) => {
        const docRef = await addDoc(collection(db, 'categories'), data);
        
        await loggerService.logAction('CATEGORY_CREATED', adminId, docRef.id, 'categories', {
            name: data.name,
            slug: data.slug
        });

        return { id: docRef.id, ...data };
    },

    updateCategory: async (id: string, data: any, adminId: string) => {
        await updateDoc(doc(db, 'categories', id), data);
        
        await loggerService.logAction('CATEGORY_UPDATED', adminId, id, 'categories', data);
    },

    deleteCategory: async (id: string, adminId: string) => {
        await deleteDoc(doc(db, 'categories', id));

        await loggerService.logAction('CATEGORY_DELETED', adminId, id, 'categories', {});
    },

    seedDefaultCategories: async (adminId: string) => {
        const defaults = [
            { name: 'Restaurante', slug: 'restaurante', icon: '🍽️', isActive: true },
            { name: 'Cafetería', slug: 'cafeteria', icon: '☕', isActive: true },
            { name: 'Panadería', slug: 'panaderia', icon: '🥖', isActive: true },
            { name: 'Comida Rápida', slug: 'comida-rapida', icon: '🍔', isActive: true },
            { name: 'Supermercado', slug: 'supermercado', icon: '🛒', isActive: true },
            { name: 'Frutería', slug: 'fruteria', icon: '🍎', isActive: true },
            { name: 'Licorería', slug: 'licoreria', icon: '🍷', isActive: true },
            { name: 'Floristería', slug: 'floristeria', icon: '💐', isActive: true },
            { name: 'Farmacia', slug: 'farmacia', icon: '💊', isActive: true },
            { name: 'Mascotas', slug: 'mascotas', icon: '🐾', isActive: true },
        ];

        const batch = [];
        for (const cat of defaults) {
            // Simplemente creémoslas. El usuario puede borrar.
            await addDoc(collection(db, 'categories'), cat);
        }

        await loggerService.logAction('SYSTEM_SEED_CATEGORIES', adminId, 'multiple', 'categories', {
            count: defaults.length
        });
    },

    // --- PEDIDOS / FINANZAS ---

    getAllOrders: async (cityFilter?: string): Promise<Order[]> => {
        const ordersRef = collection(db, 'orders');
        const orders: Order[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        let iterations = 0;
        const MAX_ITERATIONS = 20;
        while (hasMore) {
            if (++iterations > MAX_ITERATIONS) {
                logger.warn('Pagination safety limit reached in adminService.getAllOrders');
                break;
            }
            const constraints: any[] = [orderBy('createdAt', 'desc')];
            if (cityFilter) constraints.push(where('city', '==', cityFilter));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(ordersRef, ...constraints);
            const snapshot = await getDocs(q);
            orders.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data() as any
            })) as Order[]);
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }
        return orders;
    },

    getOrdersPaginated: async (pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
        const ordersRef = collection(db, 'orders');
        let q = query(ordersRef, orderBy('createdAt', 'desc'), limit(pageSize));

        if (lastDoc) {
            q = query(ordersRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as any
        })) as Order[];

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    getOrdersStats: async () => {
        // Las consultas de agregación son más baratas/rápidas que leer todos los documentos
        // Nota: Las agregaciones del lado del cliente aún cuestan 1 lectura por cada 1000 entradas de índice o similar,
        // pero `getCountFromServer` está muy optimizado.
        // Para sumas (Procesar Ingresos), estrictamente necesitamos leer documentos o usar Extensiones/Cloud Functions.
        // Por ahora, optimizaremos conteos básicos.
        const ordersRef = collection(db, 'orders');
        const snapshot = await getCountFromServer(ordersRef);
        return {
            totalOrders: snapshot.data().count
        };
    },

    getVenueFinancialReportData: async (venueId: string, month: number, year: number) => {
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef, 
            where('venueId', '==', venueId),
            where('status', '==', 'COMPLETED'),
            where('createdAt', '>=', startOfMonth),
            where('createdAt', '<=', endOfMonth)
        );

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })) as Order[];

        const summary = {
            totalOrders: orders.length,
            grossSales: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            netEarnings: orders.reduce((sum, o) => sum + (o.venueEarnings || 0), 0),
            platformFees: orders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
            co2Saved: orders.reduce((sum, o) => sum + (o.estimatedCo2 || 0), 0),
            moneySavedForCustomers: orders.reduce((sum, o) => sum + (o.moneySaved || 0), 0),
            ordersByStatus: orders.reduce((acc: any, o) => {
                acc[o.status] = (acc[o.status] || 0) + 1;
                return acc;
            }, {}),
            period: { month, year, label: new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' }) }
        };

        return {
            venueId,
            orders,
            summary
        };
    },

    // --- BILLETERAS / COMISIONES ---

    async getAllWallets(): Promise<{ venueId: string; balance: number; updatedAt: string; venueName?: string; city?: string }[]> {
        const snapshot = await getDocs(collection(db, 'wallets'));
        return snapshot.docs.map(d => ({ venueId: d.id, ...d.data() as any } as { venueId: string; balance: number; updatedAt: string }));
    },

    async getCommissionsPaginated(pageSize: number = 20, lastDoc: any = null, searchTerm: string = '') {
        try {
            const [venues, wallets] = await Promise.all([
                this.getAllVenues(),
                this.getAllWallets(),
            ]);

            const venueMap = new Map<string, any>(venues.map(v => [v.id!, v]));

            // Merge wallets into venues list
            let allRows = venues.map(v => {
                const w = wallets.find(wallet => wallet.venueId === v.id);
                return {
                    venueId: v.id!,
                    venueName: v.name,
                    city: v.city || '—',
                    balance: w?.balance ?? 0,
                    updatedAt: w?.updatedAt ?? '',
                };
            });

            // Apply search
            if (searchTerm) {
                const low = searchTerm.toLowerCase();
                allRows = allRows.filter(r => 
                    r.venueName.toLowerCase().includes(low) || 
                    r.city.toLowerCase().includes(low) ||
                    r.venueId.toLowerCase().includes(low)
                );
            }

            // Sort by most debt first (consistent with original)
            allRows.sort((a, b) => a.balance - b.balance);

            const start = lastDoc ? allRows.findIndex(w => w.venueId === lastDoc.venueId) + 1 : 0;
            const page = allRows.slice(start, start + pageSize);

            return {
                data: page,
                lastDoc: (page.length > 0 ? { venueId: page[page.length - 1].venueId } : null) as any,
                hasMore: start + pageSize < allRows.length
            };
        } catch (error) {
            logger.error('Error fetching commissions paginated:', error);
            throw error;
        }
    },

    async getCommissionsCount() {
        const snapshot = await getCountFromServer(collection(db, 'wallets'));
        return snapshot.data().count;
    },

    recordSettlement: async (params: { venueId: string; amount: number; type: 'DEBT_PAYMENT' | 'PAYOUT'; description: string }) => {
        const fn = httpsCallable(functions, 'recordManualSettlement');
        const result = await fn(params);
        return result.data;
    },

    getCompletedOrdersLocations: async (cityFilter?: string) => {
        const ordersRef = collection(db, 'orders');
        const points: { lat: number; lng: number; weight: number }[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        let iterations = 0;
        const MAX_ITERATIONS = 20;
        while (hasMore) {
            if (++iterations > MAX_ITERATIONS) {
                logger.warn('Pagination safety limit reached in getCompletedOrdersLocations');
                break;
            }
            const constraints: any[] = [
                where('status', '==', 'COMPLETED'),
                orderBy('__name__'),
            ];
            if (cityFilter) constraints.push(where('city', '==', cityFilter));
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(ordersRef, ...constraints);
            const snapshot = await getDocs(q);
            points.push(...snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    lat: data.venueLatitude || 4.6097,
                    lng: data.venueLongitude || -74.0817,
                    weight: 1
                };
            }));
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }
        return points;
    },

    async getFraudMetricsPaginated(pageSize: number = 30, lastDoc: any = null, flaggedOnly: boolean = true) {
        const metricsRef = collection(db, 'fraud_metrics');
        let constraints: any[] = [];
        
        if (flaggedOnly) {
            constraints.push(where('isFlagged', '==', true));
        }
        
        constraints.push(orderBy('score', 'desc'));
        constraints.push(limit(pageSize));
        
        if (lastDoc) {
            constraints.push(startAfter(lastDoc));
        }

        const q = query(metricsRef, ...constraints);
        const snapshot = await getDocs(q);
        
        return {
            data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })),
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    }
};
