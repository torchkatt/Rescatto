import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';

/**
 * Syncs the shopping cart to Firestore under `carts/{userId}`.
 * Firestore rules ensure only the owner can read/write their own cart.
 */
export const cartSyncService = {
    async loadCart(userId: string): Promise<unknown[] | null> {
        try {
            const ref = doc(db, 'carts', userId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return null;
            const items = snap.data().items;
            return Array.isArray(items) ? items : null;
        } catch (error) {
            logger.error('cartSyncService.loadCart error:', error);
            return null;
        }
    },

    async saveCart(userId: string, items: unknown[]): Promise<void> {
        try {
            const ref = doc(db, 'carts', userId);
            await setDoc(ref, { items, updatedAt: new Date().toISOString() });
        } catch (error) {
            logger.error('cartSyncService.saveCart error:', error);
        }
    },

    async clearCart(userId: string): Promise<void> {
        try {
            const ref = doc(db, 'carts', userId);
            await deleteDoc(ref);
        } catch (error) {
            logger.error('cartSyncService.clearCart error:', error);
        }
    },
};
