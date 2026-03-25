import {
    collection, query, where, orderBy, onSnapshot, getDocs, limit, startAfter,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Unsubscribe, QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore';
import { db } from './firebase';
import { FlashDeal } from '../types';
import { logger } from '../utils/logger';

export type FlashDealInput = Omit<FlashDeal, 'id'>;

export const flashDealService = {
    /**
     * Subscribes to active flash deals (real-time).
     * Only returns deals that are currently active and not yet expired.
     */
    subscribeToActiveDeals: (callback: (deals: FlashDeal[]) => void): Unsubscribe => {
        const now = new Date().toISOString();
        const q = query(
            collection(db, 'flash_deals'),
            where('isActive', '==', true),
            where('endTime', '>', now),
            orderBy('endTime', 'asc'),
            limit(20)
        );

        return onSnapshot(q, (snapshot) => {
            const deals = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as FlashDeal))
                .filter(d => !d.startTime || d.startTime <= now);
            callback(deals);
        }, (error) => {
            logger.error('flashDealService.subscribeToActiveDeals error:', error);
            callback([]);
        });
    },

    /**
     * One-time fetch of active flash deals (for SSR or non-reactive use).
     */
    getActiveDeals: async (): Promise<FlashDeal[]> => {
        try {
            const now = new Date().toISOString();
            const q = query(
                collection(db, 'flash_deals'),
                where('isActive', '==', true),
                where('endTime', '>', now),
                orderBy('endTime', 'asc'),
                limit(20)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FlashDeal[];
        } catch (error) {
            logger.error('flashDealService.getActiveDeals error:', error);
            return [];
        }
    },

    getActiveDealsPage: async (
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ) => {
        try {
            const now = new Date().toISOString();
            const constraints: any[] = [
                where('isActive', '==', true),
                where('endTime', '>', now),
                orderBy('endTime', 'asc'),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));
            const q = query(collection(db, 'flash_deals'), ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as FlashDeal))
                .filter(d => !d.startTime || d.startTime <= now);
            return {
                data,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error('flashDealService.getActiveDealsPage error:', error);
            return { data: [], lastDoc: null, hasMore: false };
        }
    },

    /** Time remaining in seconds */
    getSecondsRemaining: (deal: FlashDeal): number => {
        return Math.max(0, Math.floor((new Date(deal.endTime).getTime() - Date.now()) / 1000));
    },

    /** Format as MM:SS */
    formatCountdown: (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    /** Fetch all deals for a venue (admin view, includes inactive/expired) */
    getDealsByVenue: async (venueId: string): Promise<FlashDeal[]> => {
        try {
            const deals: FlashDeal[] = [];
            let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
            let hasMore = true;
            let iterations = 0;
            const MAX_ITERATIONS = 20;
            while (hasMore) {
                if (++iterations > MAX_ITERATIONS) {
                    logger.warn('Pagination safety limit reached in getDealsByVenue');
                    break;
                }
                const constraints: any[] = [
                    where('venueId', '==', venueId),
                    orderBy('startTime', 'desc'),
                ];
                if (lastDoc) constraints.push(startAfter(lastDoc));
                constraints.push(limit(50));
                const q = query(collection(db, 'flash_deals'), ...constraints);
                const snapshot = await getDocs(q);
                deals.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FlashDeal[]);
                lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
                hasMore = snapshot.docs.length === 50;
            }
            return deals;
        } catch (error) {
            logger.error('flashDealService.getDealsByVenue error:', error);
            return [];
        }
    },

    getDealsByVenuePage: async (
        venueId: string,
        lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
        pageSize: number = 20
    ) => {
        try {
            const constraints: any[] = [
                where('venueId', '==', venueId),
                orderBy('startTime', 'desc'),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(pageSize));
            const q = query(collection(db, 'flash_deals'), ...constraints);
            const snapshot = await getDocs(q);
            return {
                data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FlashDeal[],
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize,
            };
        } catch (error) {
            logger.error('flashDealService.getDealsByVenuePage error:', error);
            return { data: [], lastDoc: null, hasMore: false };
        }
    },

    /** Create a new flash deal */
    createDeal: async (data: FlashDealInput): Promise<string> => {
        const ref = await addDoc(collection(db, 'flash_deals'), {
            ...data,
            claimsCount: 0,
            createdAt: serverTimestamp(),
        });
        return ref.id;
    },

    /** Update an existing flash deal */
    updateDeal: async (id: string, data: Partial<FlashDealInput>): Promise<void> => {
        await updateDoc(doc(db, 'flash_deals', id), {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    /** Delete a flash deal permanently */
    deleteDeal: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'flash_deals', id));
    },

    /** Toggle isActive on a deal */
    toggleActive: async (id: string, isActive: boolean): Promise<void> => {
        await updateDoc(doc(db, 'flash_deals', id), { isActive, updatedAt: serverTimestamp() });
    },
};
