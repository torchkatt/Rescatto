import { sellerService } from './sellerService';
import { planService } from './planService';
import { SellerPassPlan } from '../types';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { logger } from '../utils/logger';

/**
 * SellerPassService — gestión de planes de suscripción.
 * Lee planes desde Firestore vía planService (sin valores quemados).
 */
export const sellerPassService = {
  /** Obtiene el plan actual del seller */
  async getCurrentPlan(sellerId: string): Promise<SellerPassPlan | null> {
    try {
      const seller = await sellerService.getById(sellerId);
      if (!seller || !seller.subscription) return null;
      if (seller.subscription === 'free') {
        return await planService.getById('free');
      }
      return await planService.getById(seller.subscription);
    } catch (e) {
      logger.error('sellerPassService.getCurrentPlan error:', e);
      return null;
    }
  },

  /** Solicita upgrade de plan via Cloud Function */
  async upgradePlan(
    sellerId: string,
    planId: string
  ): Promise<{ success: boolean; plan?: SellerPassPlan | null; error?: string }> {
    try {
      const upgradeFn = httpsCallable<{ sellerId: string; planId: string }, { success: boolean }>(
        functions,
        'createSellerSubscription'
      );
      const result = await upgradeFn({ sellerId, planId });
      const plan = await planService.getById(planId);
      return { success: result.data.success, plan };
    } catch (e: any) {
      logger.error('sellerPassService.upgradePlan error:', e);
      return { success: false, error: e?.message ?? 'Error desconocido' };
    }
  },

  /** Retorna todos los planes desde Firestore */
  async getAvailablePlans(): Promise<SellerPassPlan[]> {
    return planService.getAll();
  },
};