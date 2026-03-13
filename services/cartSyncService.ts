import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';
import { CartItemSchema } from '../schemas';

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
            if (!Array.isArray(items)) return null;
            return items.filter(item => {
                const result = CartItemSchema.safeParse(item);
                if (!result.success) {
                    logger.warn('cartSyncService: invalid item in cloud cart ignored', result.error.format());
                    return false;
                }
                return true;
            });
        } catch (error) {
            logger.error('cartSyncService.loadCart error:', error);
            return null;
        }
    },

    async saveCart(userId: string, items: unknown[]): Promise<void> {
        try {
            const validatedItems = items.filter(item => CartItemSchema.safeParse(item).success);
            const ref = doc(db, 'carts', userId);
            await setDoc(ref, { items: validatedItems, updatedAt: new Date().toISOString() });
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
