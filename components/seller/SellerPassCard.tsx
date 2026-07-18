import React, { useState, useEffect } from 'react';
import { UserRole, SellerPassPlan } from '../../types';
import { sellerPassService } from '../../services/sellerPassService';
import { useAuth } from '../../context/AuthContext';
import { formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { CheckCircle, Crown, ArrowUp, ArrowDown, Loader2, Clock } from 'lucide-react';

interface Props {
  sellerId: string;
}

export const SellerPassCard: React.FC<Props> = ({ sellerId }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentPlan, setCurrentPlan] = useState<SellerPassPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const availablePlans = sellerPassService.getAvailablePlans();

  // Solo visible para VENUE_OWNER
  if (user?.role !== UserRole.VENUE_OWNER) return null;

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      setLoading(true);
      try {
        const plan = await sellerPassService.getCurrentPlan(sellerId);
        setCurrentPlan(plan);
      } catch (e) {
        logger.error('SellerPassCard getCurrentPlan error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  const handlePlanChange = async (planId: 'seller_pass_monthly' | 'seller_pass_annual') => {
    setUpgrading(planId);
    try {
      const result = await sellerPassService.upgradePlan(sellerId, planId);
      if (result.success && result.plan) {
        setCurrentPlan(result.plan);
        showToast('success', `Plan actualizado a ${result.plan.name}`);
      } else {
        showToast('error', result.error || 'No se pudo cambiar el plan.');
      }
    } catch (e: any) {
      logger.error('SellerPassCard handlePlanChange error:', e);
      showToast('error', 'Error al cambiar el plan. Intenta de nuevo.');
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando plan...</span>
        </div>
      </div>
    );
  }

  const isFree = !currentPlan;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-800">Seller Pass</h3>
      </div>

      {/* Plan actual */}
      <div className="mb-4">
        <span className="text-sm text-gray-500">Plan actual</span>
        <div className="flex items-center gap-2 mt-1">
          {isFree ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              <Clock className="w-4 h-4" />
              Plan Gratuito
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
              <Crown className="w-4 h-4" />
              {currentPlan.name}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mb-5">
        <span className="text-sm text-gray-500">Beneficios</span>
        <ul className="mt-2 space-y-1.5">
          {availablePlans[0].features.map((feature) => {
            const hasFeature = !isFree && currentPlan!.features.includes(feature);
            return (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle
                  className={`w-4 h-4 flex-shrink-0 ${
                    hasFeature ? 'text-green-500' : 'text-gray-300'
                  }`}
                />
                <span className={hasFeature ? 'text-gray-800' : 'text-gray-400'}>
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Planes disponibles */}
      <div className="space-y-3">
        <span className="text-sm text-gray-500">Planes disponibles</span>
        {availablePlans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isCurrent ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{plan.name}</span>
                  {isCurrent && (
                    <span className="text-xs text-amber-600 font-medium">• Actual</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {formatCOP(plan.price)} / {plan.period === 'monthly' ? 'mes' : 'año'}
                </span>
              </div>
              <button
                onClick={() => handlePlanChange(plan.id)}
                disabled={isCurrent || upgrading === plan.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {upgrading === plan.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isCurrent ? (
                  <ArrowDown className="w-3.5 h-3.5" />
                ) : currentPlan?.price && plan.price > currentPlan.price ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
                {isCurrent ? 'Actual' : 'Cambiar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
