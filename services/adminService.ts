import {
    collection,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    setDoc,
    query,
    orderBy,
    limit,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
    getCountFromServer
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { User, Venue, UserRole, Product, Order } from '../types';
import { loggerService } from './loggerService';
import { logger } from '../utils/logger';

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
            ...doc.data()
        }));

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    // --- USUARIOS ---

    getAllUsers: async (): Promise<User[]> => {
        const querySnapshot = await getDocs(collection(db, 'users'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as User[];
    },

    getUsersPaginated: async (pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
        const usersRef = collection(db, 'users');
        // Simple pagination by raw doc ID order since users don't have a strict createdAt field everywhere
        let q = query(usersRef, limit(pageSize));

        if (lastDoc) {
            q = query(usersRef, startAfter(lastDoc), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
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
            // 1. Intentar borrar la cuenta de Auth
            const deleteAccount = httpsCallable(functions, 'deleteUserAccount');
            await deleteAccount({ uid: userId });
        } catch (error) {
            logger.error("Error al borrar cuenta de Auth (posiblemente no es Super Admin o ya no existe):", error);
            // Continuamos para al menos limpiar el documento si el usuario lo desea, 
            // o podrías elegir lanzar el error. Dado que el usuario pidió que se borrara,
            // intentaremos ambos.
        }

        // 2. Borrar documento de Firestore
        await deleteDoc(doc(db, 'users', userId));

        if (adminId) {
            await loggerService.logAction('USER_DELETED', adminId, userId, 'users', {});
        }
    },

    // --- GESTIÓN DE SEDES ---

    getAllVenues: async (forceRefresh: boolean = false): Promise<Venue[]> => {
        if (!forceRefresh) {
            const cached = localStorage.getItem(VENUES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() < parsed.expiry) return parsed.data;
            }
        }

        const querySnapshot = await getDocs(collection(db, 'venues'));
        const venues = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Venue[];

        localStorage.setItem(VENUES_CACHE_KEY, JSON.stringify({
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
            ...doc.data()
        })) as Venue[];

        return {
            data,
            lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    },

    createVenue: async (venueData: Omit<Venue, 'id'>) => {
        // Crea un nuevo documento en colección 'venues'
        const docRef = await addDoc(collection(db, 'venues'), venueData);

        // Invalidar Cachés Administrativos y de Cliente
        localStorage.removeItem(VENUES_CACHE_KEY);

        // Actualizar el doc con su propio ID si es necesario, o solo retornarlo
        return { id: docRef.id, ...venueData };
    },

    updateVenue: async (venueId: string, data: Partial<Venue>) => {
        const venueRef = doc(db, 'venues', venueId);
        await updateDoc(venueRef, data);
        localStorage.removeItem(VENUES_CACHE_KEY); // Limpiar caché
    },

    deleteVenue: async (venueId: string) => {
        await deleteDoc(doc(db, 'venues', venueId));
        localStorage.removeItem(VENUES_CACHE_KEY); // Limpiar caché
    },

    getAllProducts: async (): Promise<Product[]> => {
        const querySnapshot = await getDocs(collection(db, 'products'));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Product[];
    },

    // --- GESTIÓN DE CATEGORÍAS ---

    getAllCategories: async (): Promise<any[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, 'categories'));
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            logger.error('Error obteniendo categorías desde servicio:', error);
            throw error;
        }
    },

    createCategory: async (data: any) => {
        const docRef = await addDoc(collection(db, 'categories'), data);
        return { id: docRef.id, ...data };
    },

    updateCategory: async (id: string, data: any) => {
        await updateDoc(doc(db, 'categories', id), data);
    },

    deleteCategory: async (id: string) => {
        await deleteDoc(doc(db, 'categories', id));
    },

    seedDefaultCategories: async () => {
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
            // Verificar si existe para evitar duplicados sería bueno, pero por ahora solo añadir
            // Enfoque simple: Lógica de añadir si no existe es compleja con auto-IDs.
            // Simplemente creémoslas. El usuario puede borrar.
            await addDoc(collection(db, 'categories'), cat);
        }
    },

    // --- PEDIDOS / FINANZAS ---

    getAllOrders: async (): Promise<Order[]> => {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(500));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Order[];
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
            ...doc.data()
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
    }
};
