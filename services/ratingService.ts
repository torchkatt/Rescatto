import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Rating, RatingStats, UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * Create a new rating for an order
 */
export const createRating = async (data: {
    orderId: string;
    fromUserId: string;
    fromUserRole: UserRole;
    toUserId: string;
    toUserRole: UserRole;
    score: number;
    comment?: string;
    venueId?: string;
    driverId?: string;
    sellerId?: string;
}): Promise<Rating> => {
    try {
        // Validate score
        if (data.score < 1 || data.score > 5) {
            throw new Error('Score must be between 1 and 5');
        }

        const ratingData = {
            ...data,
            createdAt: new Date().toISOString(),
        };

        // Use a deterministic doc ID to prevent duplicate ratings atomically.
        // runTransaction + set ensures exactly-once semantics even under concurrent requests.
        const dedupKey = `${data.orderId}_${data.fromUserId}_${data.toUserId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const ratingRef = doc(db, 'ratings', dedupKey);
        const orderRef = doc(db, 'orders', data.orderId);

        await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(ratingRef);
            if (existing.exists()) {
                throw new Error('Ya has calificado este pedido');
            }
            transaction.set(ratingRef, ratingData);
            transaction.update(orderRef, { rated: true });
        });

        // Update stats asynchronously after the transaction commits
        updateRatingStats(data.toUserId, data.toUserRole === UserRole.VENUE_OWNER ? 'venue' : 'user').catch(
            (e) => logger.error('updateRatingStats failed (toUser):', e)
        );
        if (data.venueId && data.toUserRole === UserRole.VENUE_OWNER) {
            updateRatingStats(data.venueId, 'venue').catch(
                (e) => logger.error('updateRatingStats failed (venue):', e)
            );
        }

        return {
            id: dedupKey,
            ...ratingData,
        };
    } catch (error) {
        logger.error('Error creating rating:', error);
        throw error;
    }
};

/**
 * Check if user has already rated this order for a specific recipient
 */
export const hasRated = async (
    orderId: string,
    fromUserId: string,
    toUserId: string
): Promise<boolean> => {
    try {
        const ratingsRef = collection(db, 'ratings');
        const q = query(
            ratingsRef,
            where('orderId', '==', orderId),
            where('fromUserId', '==', fromUserId),
            where('toUserId', '==', toUserId)
        );

        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        logger.error('Error checking if rated:', error);
        return false;
    }
};

/**
 * Get all ratings for a specific user, venue, or seller
 */
export const getRatings = async (
    userId: string,
    userType: 'user' | 'venue' | 'seller' = 'user'
): Promise<Rating[]> => {
    try {
        const ratingsRef = collection(db, 'ratings');
        let q;
        if (userType === 'venue') {
            q = query(ratingsRef, where('venueId', '==', userId));
        } else if (userType === 'seller') {
            q = query(ratingsRef, where('sellerId', '==', userId));
        } else {
            q = query(ratingsRef, where('toUserId', '==', userId));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Record<string, any>),
        })) as Rating[];
    } catch (error) {
        logger.error('Error getting ratings:', error);
        return [];
    }
};

/**
 * Get rating statistics for a user, venue, or seller
 */
export const getRatingStats = async (
    userId: string,
    userType: 'user' | 'venue' | 'seller' = 'user'
): Promise<RatingStats | null> => {
    try {
        let statsRef;
        if (userType === 'venue') statsRef = doc(db, 'venues', userId, 'stats', 'ratings');
        else if (userType === 'seller') statsRef = doc(db, 'sellers', userId, 'stats', 'ratings');
        else statsRef = doc(db, 'users', userId, 'stats', 'ratings');
        const statsDoc = await getDoc(statsRef);

        if (statsDoc.exists()) {
            return statsDoc.data() as RatingStats;
        }

        // If no stats exist, calculate them
        return await calculateRatingStats(userId, userType);
    } catch (error) {
        logger.error('Error getting rating stats:', error);
        return null;
    }
};

/**
 * Calculate and update rating statistics
 */
export const updateRatingStats = async (
    userId: string,
    userType: 'user' | 'venue' | 'seller' = 'user'
): Promise<void> => {
    try {
        const stats = await calculateRatingStats(userId, userType);
        if (!stats) return;

        const statsRef = getRatingStatsRef(userId, userType);
        await setDoc(statsRef, {
            ...stats,
            lastUpdated: new Date().toISOString(),
        }, { merge: true });
    } catch (error) {
        logger.error('Error updating rating stats:', error);
    }
};

function getRatingStatsRef(userId: string, userType: 'user' | 'venue' | 'seller') {
    if (userType === 'venue') return doc(db, 'venues', userId, 'stats', 'ratings');
    if (userType === 'seller') return doc(db, 'sellers', userId, 'stats', 'ratings');
    return doc(db, 'users', userId, 'stats', 'ratings');
}

/**
 * Calculate rating statistics from all ratings
 */
const calculateRatingStats = async (
    userId: string,
    userType: 'user' | 'venue' | 'seller' = 'user'
): Promise<RatingStats | null> => {
    try {
        const ratings = await getRatings(userId, userType);

        if (ratings.length === 0) {
            return {
                userId,
                averageRating: 0,
                totalRatings: 0,
                breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                lastUpdated: new Date().toISOString(),
            };
        }

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalScore = 0;

        ratings.forEach(rating => {
            totalScore += rating.score;
            breakdown[rating.score as keyof typeof breakdown]++;
        });

        const averageRating = totalScore / ratings.length;

        return {
            userId,
            averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
            totalRatings: ratings.length,
            breakdown,
            lastUpdated: new Date().toISOString(),
        };
    } catch (error) {
        logger.error('Error calculating rating stats:', error);
        return null;
    }
};

/**
 * Get ratings for a specific order
 */
export const getOrderRatings = async (orderId: string): Promise<Rating[]> => {
    try {
        const ratingsRef = collection(db, 'ratings');
        const q = query(ratingsRef, where('orderId', '==', orderId));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Record<string, any>),
        })) as Rating[];
    } catch (error) {
        logger.error('Error getting order ratings:', error);
        return [];
    }
};
