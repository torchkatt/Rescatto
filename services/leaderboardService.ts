import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { logger } from '../utils/logger';

export interface LeaderboardEntry {
    userId: string;
    fullName: string;
    avatarUrl?: string;
    city?: string;
    level: 'NOVICE' | 'HERO' | 'GUARDIAN';
    totalRescues: number;
    monthlyRescues?: number;
    weeklyRescues?: number;
    co2Saved: number;
    points: number;
    streak?: number;
}

const LEVEL_CONFIG = {
    NOVICE: { emoji: '🌱', label: 'Novato' },
    HERO: { emoji: '⚡', label: 'Héroe' },
    GUARDIAN: { emoji: '🏆', label: 'Guardián' },
};

export type LeaderboardPeriod = 'all-time' | 'monthly' | 'weekly';

export const leaderboardService = {
    /**
     * Returns top rescuers for a given city and period, ordered by rescues DESC.
     * Updated to use Cloud Function to avoid Permission Denied errors.
     */
    getTopRescuers: async (city?: string, limitCount: number = 10, period: LeaderboardPeriod = 'all-time'): Promise<LeaderboardEntry[]> => {
        try {
            const getLeaderboard = httpsCallable<{ city?: string; limit?: number; period?: string }, { leaderboard: LeaderboardEntry[] }>(
                functions, 
                'getLeaderboard'
            );
            
            const result = await getLeaderboard({ 
                city, 
                limit: limitCount, 
                period 
            });
            
            return result.data.leaderboard;
        } catch (error) {
            logger.error('leaderboardService.getTopRescuers error:', error);
            return [];
        }
    },

    getLevelConfig: (level: 'NOVICE' | 'HERO' | 'GUARDIAN') => LEVEL_CONFIG[level] || LEVEL_CONFIG.NOVICE,

    /**
     * Gets the current user's rank in their city or globally.
     * Updated to use Cloud Function to avoid Permission Denied errors.
     */
    getMyRank: async (userId: string, city?: string, period: LeaderboardPeriod = 'all-time'): Promise<{ rank: number; totalPlayers: number }> => {
        try {
            const getMyLeaderboardRank = httpsCallable<{ city?: string; period?: string }, { rank: number; totalPlayers: number }>(
                functions, 
                'getMyLeaderboardRank'
            );
            
            const result = await getMyLeaderboardRank({ 
                city, 
                period 
            });
            
            return result.data;
        } catch (error) {
            logger.error('leaderboardService.getMyRank error:', error);
            return { rank: 0, totalPlayers: 0 };
        }
    }
};
