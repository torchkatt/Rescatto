import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, SellerPassPlan } from '../../types';
import { sellerPassService } from '../../services/sellerPassService';
import { sellerService } from '../../services/sellerService';
import { getWompiSignature } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { formatCOP } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle, Crown, Loader2, Clock, CreditCard, AlertCircle } from 'lucide-react';

interface Props {
  sellerId: string;
}

/** Carga el script del widget de Wompi bajo demanda */
let wompiScriptPromise: Promise<void> | null = null;

function loadWompiScript(): Promise<void> {
  if (wompiScriptPromise) return wompiScriptPromise;
  if (typeof window !== 'undefined' && (window as any).WidgetCheckout) {
    wompiScriptPromise = Promise.resolve();
    return wompiScriptPromise;
  }
  wompiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      wompiScriptPromise = null;
      reject(new Error('No se pudo cargar el widget de Wompi.'));
    };
    document.head.appendChild(script);
  });
  return wompiScriptPromise;
}

export const SellerPassCard: React.FC<Props> = ({ sellerId }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentPlan, setCurrentPlan] = useState<SellerPassPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [wompiError, setWompiError] = useState<string | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SellerPassPlan[]>([]);

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      setLoading(true);
      try {
        const plan = await sellerPassService.getCurrentPlan(sellerId);
        setCurrentPlan(plan);

        // Obtener la fecha de expiración directamente del documento seller
        const seller = await sellerService.getById(sellerId);
        if (seller) {
          const expiresAt = (seller as any).subscriptionExpiresAt;
          setSubscriptionExpiresAt(expiresAt || null);
        }
      // Obtener planes disponibles
      const plans = await sellerPassService.getAvailablePlans();
      setAvailablePlans(plans);
    } catch (e) {
        logger.error('SellerPassCard getCurrentPlan error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  /** Abre el widget de pago de Wompi para el plan seleccionado */
  const handleWompiPayment = useCallback(
    async (planId: 'seller_pass_monthly' | 'seller_pass_annual') => {
      setPaymentLoading(true);
      setWompiError(null);

      const plan = availablePlans.find((p) => p.id === planId);
      if (!plan) {
        showToast('error', 'Plan no encontrado.');
        setPaymentLoading(false);
        return;
      }

      try {
        // 1. Obtener firma de integridad del backend
        const reference = `seller_pass_${sellerId}_${Date.now()}`;
        const sig = await getWompiSignature(reference, plan.price, 'COP');

        // 2. Cargar script de Wompi
        await loadWompiScript();

        // 3. Abrir widget de checkout
        const WidgetCheckout = (window as any).WidgetCheckout;
        if (!WidgetCheckout) {
          throw new Error('Widget de Wompi no disponible.');
        }

        const checkout = new WidgetCheckout({
          currency: sig.currency,
          amountInCents: sig.amountInCents,
          reference: sig.reference,
          publicKey: sig.publicKey,
          signature: {
            integrity: sig.signature,
          },
        });

        checkout.open(async (result: any) => {
          const transaction = result?.transaction;

          if (transaction && transaction.status === 'APPROVED') {
            try {
              // 4. Notificar al backend para activar la suscripción
              const createSubscription = httpsCallable<
                { sellerId: string; planId: string; wompiTransactionId: string },
                { success: boolean; expiresAt?: string }
              >(functions, 'createSellerSubscription');

              const cfResult = await createSubscription({
                sellerId,
                planId,
                wompiTransactionId: transaction.id,
              });

              if (cfResult.data.success) {
                setCurrentPlan(plan);
                setSubscriptionExpiresAt(cfResult.data.expiresAt || null);
                showToast('success', `¡Pago exitoso! Tu plan ${plan.name} está activo.`);
              } else {
                showToast(
                  'warning',
                  'El pago fue aprobado pero hubo un problema activando tu suscripción. Contacta soporte.'
                );
              }
            } catch (e: any) {
              logger.error('createSellerSubscription CF error:', e);
              showToast(
                'warning',
                'Pago aprobado, pero no se pudo activar la suscripción. Contacta soporte con tu número de transacción.'
              );
            }
          } else if (transaction && transaction.status === 'DECLINED') {
            showToast('error', 'El pago fue rechazado. Intenta con otro método de pago.');
          } else if (transaction && transaction.status === 'ERROR') {
            showToast('error', 'Ocurrió un error al procesar el pago. Intenta de nuevo.');
          } else {
            // Usuario cerró el widget sin completar
            logger.log('Wompi widget cerrado sin completar la transacción.');
          }

          setPaymentLoading(false);
        });
      } catch (e: any) {
        logger.error('SellerPassCard Wompi payment error:', e);
        setWompiError(e?.message || 'Error al procesar el pago.');
        showToast('error', 'Error al iniciar el pago. Intenta de nuevo.');
        setPaymentLoading(false);
      }
    },
    [sellerId, availablePlans, showToast]
  );

  /** Calcula los días restantes de la suscripción */
  const getDaysRemaining = (): number | null => {
    if (!subscriptionExpiresAt) return null;
    const now = new Date();
    const expires = new Date(subscriptionExpiresAt);
    if (isNaN(expires.getTime())) return null;
    const diffMs = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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

  // Solo visible para VENUE_OWNER
  if (user?.role !== UserRole.VENUE_OWNER) return null;

  const isFree = !currentPlan;
  const daysRemaining = getDaysRemaining();

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

        {/* Estado de suscripción */}
        {!isFree && daysRemaining !== null && (
          <div className="mt-2">
            {daysRemaining > 0 ? (
              <span className="text-xs text-green-600 font-medium">
                {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restante{daysRemaining === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Suscripción vencida
              </span>
            )}
          </div>
        )}
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

      {/* Error de Wompi */}
      {wompiError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{wompiError}</span>
          </div>
        </div>
      )}

      {/* Planes disponibles */}
      <div className="space-y-3">
        <span className="text-sm text-gray-500">Planes disponibles</span>
        {availablePlans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          const isProcessing = paymentLoading && upgrading === plan.id;

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

              {isCurrent ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-500 cursor-not-allowed">
                  Actual
                </span>
              ) : (
                <button
                  onClick={() => {
                    setUpgrading(plan.id);
                    handleWompiPayment(plan.id).finally(() => setUpgrading(null));
                  }}
                  disabled={isProcessing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isProcessing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Pagando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-3.5 h-3.5" />
                      Pagar con Wompi
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
