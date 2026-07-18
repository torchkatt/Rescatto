import { sellerService } from './sellerService';
import { SELLER_PASS_PLANS, SellerPassPlan } from '../types';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { logger } from '../utils/logger';

/**
 * SellerPassService — gestión de planes de suscripción Seller Pass.
 *
 * Responsabilidades:
 * - Consultar el plan actual de un seller.
 * - Solicitar upgrade/downgrade via Cloud Function.
 * - Listar planes disponibles.
 */

export const sellerPassService = {
  /** Obtiene el plan actual al que está suscrito el seller. */
  async getCurrentPlan(sellerId: string): Promise<SellerPassPlan | null> {
    try {
      const seller = await sellerService.getById(sellerId);
      if (!seller) return null;
      return SELLER_PASS_PLANS.find((p) => p.id === seller.subscription) ?? null;
    } catch (e) {
      logger.error('sellerPassService.getCurrentPlan error:', e);
      return null;
    }
  },

  /**
   * Solicita upgrade/downgrade de plan para el seller.
   * Delega a la Cloud Function `upgradeSellerPlan`.
   */
  async upgradePlan(
    sellerId: string,
    planId: 'seller_pass_monthly' | 'seller_pass_annual'
  ): Promise<{ success: boolean; plan?: SellerPassPlan; error?: string }> {
    try {
      const upgradeFn = httpsCallable<{ sellerId: string; planId: string }, { success: boolean }>(
        functions,
        'upgradeSellerPlan'
      );
      const result = await upgradeFn({ sellerId, planId });
      const plan = SELLER_PASS_PLANS.find((p) => p.id === planId) ?? null;
      return { success: result.data.success, plan: plan ?? undefined };
    } catch (e: any) {
      logger.error('sellerPassService.upgradePlan error:', e);
      return { success: false, error: e?.message ?? 'Error desconocido' };
    }
  },

  /** Retorna todos los planes de Seller Pass disponibles. */
  getAvailablePlans(): SellerPassPlan[] {
    return SELLER_PASS_PLANS;
  },
};
