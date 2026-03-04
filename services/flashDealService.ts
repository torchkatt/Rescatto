import {
    collection, query, where, orderBy, onSnapshot, getDocs,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Unsubscribe
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
            orderBy('endTime', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const deals = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            })) as FlashDeal[];
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
                orderBy('endTime', 'asc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FlashDeal[];
        } catch (error) {
            logger.error('flashDealService.getActiveDeals error:', error);
            return [];
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
            const q = query(
                collection(db, 'flash_deals'),
                where('venueId', '==', venueId),
                orderBy('startTime', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FlashDeal[];
        } catch (error) {
            logger.error('flashDealService.getDealsByVenue error:', error);
            return [];
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
