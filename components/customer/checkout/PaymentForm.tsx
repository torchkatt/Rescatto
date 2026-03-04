import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { LoadingSpinner } from '../common/Loading';
import { useAuth } from '../../../context/AuthContext';
import { logger } from '../../../utils/logger';
import { getWompiSignature } from '../../../services/paymentService';

// Wompi Widget Interface
declare global {
    interface Window {
        WidgetCheckout: any;
    }
}

interface PaymentFormProps {
    amount: number;
    onSuccess: (transactionId: string) => void;
    onError: (error: string) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ amount, onSuccess, onError }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const openWompiWidget = async () => {
        setLoading(true);
        try {
            const reference = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

            // Fetch integrity signature from backend (never compute on client)
            const sigData = await getWompiSignature(reference, amount, 'COP');

            const launchWidget = () => {
                const checkout = new window.WidgetCheckout({
                    currency: sigData.currency,
                    amountInCents: sigData.amountInCents,
                    reference: sigData.reference,
                    publicKey: sigData.publicKey,
                    signature: { integrity: sigData.signature },
                    redirectUrl: window.location.origin + '/payment/result',
                    customerData: {
                        email: user?.email || 'cliente@rescatto.com',
                        fullName: user?.fullName || 'Cliente Rescatto',
                        phoneNumber: user?.phone ? user.phone.replace(/\D/g, '') : '573000000000',
                        phoneNumberPrefix: '+57',
                    },
                });

                checkout.open((result: any) => {
                    const transaction = result.transaction;
                    logger.log('Transaction result:', transaction);

                    if (transaction.status === 'APPROVED') {
                        onSuccess(transaction.id);
                    } else if (transaction.status === 'DECLINED') {
                        onError('El pago fue rechazado por el banco.');
                    } else {
                        onError('Ocurrió un error en la pasarela de pagos.');
                    }
                    setLoading(false);
                });
            };

            if (!window.WidgetCheckout) {
                const script = document.createElement('script');
                script.src = 'https://checkout.wompi.co/widget.js';
                script.async = true;
                script.onload = launchWidget;
                script.onerror = () => {
                    onError('No se pudo cargar el widget de pago. Verifica tu conexión.');
                    setLoading(false);
                };
                document.body.appendChild(script);
            } else {
                launchWidget();
            }
        } catch (error) {
            logger.error('Error opening Wompi widget:', error);
            onError('Error al iniciar el pago. Intenta nuevamente.');
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="bg-white p-6 rounded-xl border border-gray-100 mb-6 text-center">
                <img
                    src="https://logos-world.net/wp-content/uploads/2022/11/Wompi-Logo.png"
                    alt="Wompi"
                    className="h-12 mx-auto mb-4 object-contain"
                />
                <p className="text-sm text-gray-500 mb-6">
                    Paga seguro con <strong>Nequi, Bancolombia, PSE</strong> o Tarjetas de Crédito.
                </p>

                <button
                    onClick={openWompiWidget}
                    disabled={loading}
                    className="w-full bg-[#2C2A29] text-white font-bold py-4 px-6 rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {loading ? (
                        <LoadingSpinner size="sm" color="white" />
                    ) : (
                        <>
                            <Lock size={20} />
                            Pagar ${amount.toLocaleString('es-CO')} COP
                        </>
                    )}
                </button>
            </div>

            <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                <Lock size={12} /> Pagos protegidos y encriptados por Wompi Bancolombia
            </p>
        </div>
    );
};
