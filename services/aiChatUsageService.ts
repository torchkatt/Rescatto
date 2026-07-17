import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { User, UserRole } from '../types';
import { logger } from '../utils/logger';
import type { AIChatPlanTier, AIChatUsage } from './aiChatTypes';
import { AI_CHAT_PLANS } from './aiChatTypes';

/**
 * AI Chat Usage Service
 * 
 * Tracks daily message usage per user and enforces limits based on subscription tier.
 * Usage data stored in Firestore: users/{userId}/aiChatUsage
 */

const USAGE_COLLECTION = 'ai_chat_usage';

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Determine user's AI chat tier based on their role and subscription
 */
export function getUserTier(user: User): AIChatPlanTier {
  // Admin roles get unlimited
  if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(user.role)) {
    return 'admin';
  }

  // Guest users
  if (user.isGuest) {
    return 'guest';
  }

  // Rescatto Pass subscribers
  if (user.rescattoPass?.isActive && user.rescattoPass.status === 'active') {
    if (user.rescattoPass.planId === 'annual') {
      return 'pass_annual';
    }
    return 'pass_monthly';
  }

  // Free tier
  return 'free';
}

/**
 * Get remaining messages for today
 */
export async function getRemainingMessages(userId: string, user: User): Promise<{
  remaining: number;
  used: number;
  limit: number;
  tier: AIChatPlanTier;
  canSend: boolean;
}> {
  const tier = getUserTier(user);
  const plan = AI_CHAT_PLANS[tier];
  const today = getTodayString();

  try {
    const usageRef = doc(db, USAGE_COLLECTION, userId);
    const usageSnap = await getDoc(usageRef);

    if (!usageSnap.exists()) {
      return {
        remaining: plan.dailyLimit === Infinity ? Infinity : plan.dailyLimit,
        used: 0,
        limit: plan.dailyLimit,
        tier,
        canSend: true,
      };
    }

    const usage = usageSnap.data() as AIChatUsage;

    // Reset if new day
    if (usage.lastMessageDate !== today) {
      return {
        remaining: plan.dailyLimit === Infinity ? Infinity : plan.dailyLimit,
        used: 0,
        limit: plan.dailyLimit,
        tier,
        canSend: true,
      };
    }

    const remaining = plan.dailyLimit === Infinity ? Infinity : Math.max(0, plan.dailyLimit - (usage.messagesToday || 0));
    return {
      remaining,
      used: usage.messagesToday || 0,
      limit: plan.dailyLimit,
      tier,
      canSend: remaining > 0,
    };
  } catch (error) {
    logger.error('aiChatUsage: error getting usage', error);
    // Fail open — allow sending if we can't check
    return {
      remaining: Infinity,
      used: 0,
      limit: Infinity,
      tier,
      canSend: true,
    };
  }
}

/**
 * Increment message count for a user
 */
export async function incrementMessageCount(userId: string, user: User): Promise<void> {
  const tier = getUserTier(user);
  const today = getTodayString();

  try {
    const usageRef = doc(db, USAGE_COLLECTION, userId);
    const usageSnap = await getDoc(usageRef);

    if (!usageSnap.exists()) {
      await setDoc(usageRef, {
        messagesToday: 1,
        lastMessageDate: today,
        totalMessages: 1,
        tier,
        userId,
      });
    } else {
      const usage = usageSnap.data() as AIChatUsage;
      if (usage.lastMessageDate !== today) {
        // Reset for new day
        await setDoc(usageRef, {
          messagesToday: 1,
          lastMessageDate: today,
          totalMessages: (usage.totalMessages || 0) + 1,
          tier,
          userId,
        });
      } else {
        // Increment existing count
        await updateDoc(usageRef, {
          messagesToday: increment(1),
          totalMessages: increment(1),
          tier,
        });
      }
    }
  } catch (error) {
    logger.error('aiChatUsage: error incrementing count', error);
    // Non-critical — don't block the message
  }
}

/**
 * Check if user can send a message (wrapper that includes increment)
 */
export async function checkAndIncrementMessage(userId: string, user: User): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  tier: AIChatPlanTier;
  error?: string;
}> {
  const { remaining, used, limit, tier, canSend } = await getRemainingMessages(userId, user);

  if (!canSend) {
    const plan = AI_CHAT_PLANS[tier];
    return {
      allowed: false,
      remaining: 0,
      used,
      limit,
      tier,
      error: `Has alcanzado el límite de ${used} mensajes de hoy.${tier === 'free' ? ' ¡Activa Rescatto Pass para obtener más!' : ''}`,
    };
  }

  await incrementMessageCount(userId, user);
  return {
    allowed: true,
    remaining: remaining === Infinity ? Infinity : remaining - 1,
    used: used + 1,
    limit,
    tier,
  };
}
