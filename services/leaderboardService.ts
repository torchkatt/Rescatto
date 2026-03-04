import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from '../utils/logger';

export interface LeaderboardEntry {
    userId: string;
    fullName: string;
    avatarUrl?: string;
    city?: string;
    level: 'NOVICE' | 'HERO' | 'GUARDIAN';
    totalRescues: number;
    co2Saved: number;
    points: number;
    streak?: number;
}

const LEVEL_CONFIG = {
    NOVICE: { emoji: '🌱', label: 'Novato' },
    HERO: { emoji: '⚡', label: 'Héroe' },
    GUARDIAN: { emoji: '🏆', label: 'Guardián' },
};

export const leaderboardService = {
    /**
     * Returns top rescuers for a given city, ordered by totalRescues DESC.
     * Falls back to global ranking if city is not provided.
     */
    getTopRescuers: async (city?: string, topN = 10): Promise<LeaderboardEntry[]> => {
        try {
            const usersRef = collection(db, 'users');
            let q;

            if (city) {
                q = query(
                    usersRef,
                    where('city', '==', city),
                    where('impact.totalRescues', '>', 0),
                    orderBy('impact.totalRescues', 'desc'),
                    limit(topN)
                );
            } else {
                q = query(
                    usersRef,
                    where('impact.totalRescues', '>', 0),
                    orderBy('impact.totalRescues', 'desc'),
                    limit(topN)
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => {
                const data = d.data() as Record<string, any>;
                const impact = data.impact || {};
                return {
                    userId: d.id,
                    fullName: data.fullName || 'Rescatador',
                    avatarUrl: data.avatarUrl,
                    city: data.city,
                    level: (impact.level || 'NOVICE') as 'NOVICE' | 'HERO' | 'GUARDIAN',
                    totalRescues: impact.totalRescues || 0,
                    co2Saved: impact.co2Saved || 0,
                    points: impact.points || 0,
                    streak: data.streak?.current,
                };
            });
        } catch (error) {
            logger.error('leaderboardService.getTopRescuers error:', error);
            return [];
        }
    },

    getLevelConfig: (level: 'NOVICE' | 'HERO' | 'GUARDIAN') => LEVEL_CONFIG[level] || LEVEL_CONFIG.NOVICE,
};
