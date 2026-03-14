import React, { useState, useEffect } from 'react';
import { User, SubscriptionRequest } from '../../types';
import { Zap, Star, ShieldCheck, Truck, TrendingUp, Loader2, Clock, XCircle } from 'lucide-react';
import { formatCOP } from '../../utils/formatters';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../services/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { SubscriptionPaymentModal } from './SubscriptionPaymentModal';

interface Props {
    user: User;
}

export const RescattoPassManagement: React.FC<Props> = ({ user }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);
    const [pendingRequest, setPendingRequest] = useState<SubscriptionRequest | null>(null);
    const [showModal, setShowModal] = useState(false);
    const pass = user.rescattoPass;

    // Escuchar en tiempo real si hay solicitud pendiente
    useEffect(() => {
        if (!user.id) return;
        const q = query(
            collection(db, 'subscription_requests'),
            where('userId', '==', user.id),
            where('status', 'in', ['pending_payment', 'pending_review']),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const unsub = onSnapshot(q, snap => {
            if (!snap.empty) {
                const doc = snap.docs[0];
                setPendingRequest({ id: doc.id, ...doc.data() } as SubscriptionRequest);
            } else {
                setPendingRequest(null);
            }
        });
        return unsub;
    }, [user.id]);

    const handleSubscribe = async (planId: 'monthly' | 'annual') => {
        setLoading(planId);
        try {
            const createFn = httpsCallable(functions, 'createSubscriptionRequest');
            const result: any = await createFn({ planId });
            setPendingRequest(result.data as SubscriptionRequest);
            setShowModal(true);
        } catch (err: any) {
            logger.error('createSubscriptionRequest error:', err);
            showToast('error', 'Error al crear la solicitud. Intenta de nuevo.');
        } finally {
            setLoading(null);
        }
    };

    const benefits = [
        {
            icon: <Truck className="text-emerald-500" size={20} />,
            title: t('prof_pass_benefit_truck') || 'Envíos Gratis Ilimitados',
            desc: t('prof_pass_benefit_truck_desc') || 'En todos tus pedidos sin monto mínimo.',
        },
        {
            icon: <Star className="text-amber-500" size={20} />,
            title: t('prof_pass_benefit_star') || 'Ofertas Exclusivas',
            desc: t('prof_pass_benefit_star_desc') || 'Acceso anticipado a Packs Sorpresa premium.',
        },
        {
            icon: <TrendingUp className="text-blue-500" size={20} />,
            title: t('prof_pass_benefit_up') || 'Multiplicador de Impacto',
            desc: t('prof_pass_benefit_up_desc') || 'Gana 10% más puntos en cada rescate.',
        },
    ];

    // ── Pass activo ──────────────────────────────────────────────────────────
    if (pass?.isActive && pass.status === 'active') {
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={120} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4 bg-white/20 w-fit px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                            <ShieldCheck size={14} />
                            {t('prof_pass_member_active') || 'Miembro Activo'}
                        </div>
                        <h3 className="text-3xl font-black mb-1">{t('prof_pass') || 'Rescatto Pass'}</h3>
                        <p className="text-emerald-100 opacity-80 mb-6">
                            {pass.planId === 'monthly' ? t('prof_pass_monthly') || 'Plan Mensual' : t('prof_pass_annual') || 'Plan Anual'}
                        </p>
                        <div className="flex items-center justify-between border-t border-white/20 pt-6">
                            <div>
                                <p className="text-xs uppercase opacity-60 font-bold mb-1">
                                    {t('prof_pass_next_renewal') || 'Vence el'}
                                </p>
                                <p className="text-lg font-bold">{new Date(pass.expiresAt).toLocaleDateString('es-CO')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <h4 className="font-black text-gray-900 mb-6">{t('prof_pass_your_benefits') || 'Tus Beneficios Activos'}</h4>
                    <div className="space-y-6">
                        {benefits.map((b, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="bg-gray-50 p-3 rounded-2xl shrink-0">{b.icon}</div>
                                <div>
                                    <h5 className="font-bold text-gray-900">{b.title}</h5>
                                    <p className="text-sm text-gray-500">{b.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Solicitud pendiente ──────────────────────────────────────────────────
    if (pendingRequest) {
        const isPendingReview = pendingRequest.status === 'pending_review';
        return (
            <>
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`rounded-3xl p-6 border-2 ${isPendingReview ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-2xl shrink-0 ${isPendingReview ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                                {isPendingReview
                                    ? <Clock size={24} className="text-amber-600" />
                                    : <Zap size={24} className="text-emerald-600" />
                                }
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-gray-900 text-lg">
                                    {isPendingReview ? 'Pago en verificación' : 'Pago pendiente'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isPendingReview
                                        ? 'Tu comprobante fue recibido. El equipo Rescatto lo verificará en menos de 24h.'
                                        : `Plan ${pendingRequest.planId === 'monthly' ? 'mensual' : 'anual'} · ${formatCOP(pendingRequest.amount)}`
                                    }
                                </p>
                                {!isPendingReview && (
                                    <p className="text-xs font-bold text-emerald-700 mt-2">
                                        Referencia: <span className="tracking-widest">{pendingRequest.referenceCode}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {!isPendingReview && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="w-full mt-5 py-3.5 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                            >
                                Ver instrucciones de pago
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setPendingRequest(null)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors font-bold py-2"
                    >
                        <XCircle size={16} />
                        Cancelar solicitud
                    </button>
                </div>

                {showModal && (
                    <SubscriptionPaymentModal
                        request={pendingRequest}
                        onClose={() => setShowModal(false)}
                        onProofSubmitted={() => setShowModal(false)}
                    />
                )}
            </>
        );
    }

    // ── Selección de plan ────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-black text-gray-900">{t('prof_pass_elite') || 'Únete a la elite del rescate'}</h3>
                <p className="text-gray-500">{t('prof_pass_desc') || 'Ahorra más, rescata más y obtén beneficios premium.'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan Mensual */}
                <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 hover:border-emerald-500 transition-all relative shadow-sm hover:shadow-xl hover:shadow-emerald-100/50">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="text-xl font-black text-gray-900">{t('prof_pass_monthly') || 'Mensual'}</h4>
                            <p className="text-gray-500 text-sm">{t('prof_pass_flex') || 'Flexibilidad total'}</p>
                        </div>
                    </div>
                    <div className="mb-8">
                        <span className="text-4xl font-black text-gray-900">{formatCOP(14900)}</span>
                        <span className="text-gray-400 font-bold ml-1">{t('rpass_monthly_suffix') || '/ mes'}</span>
                    </div>
                    <button
                        onClick={() => handleSubscribe('monthly')}
                        disabled={!!loading}
                        className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading === 'monthly' ? <Loader2 className="animate-spin" size={18} /> : 'Suscribirme'}
                    </button>
                </div>

                {/* Plan Anual */}
                <div className="bg-emerald-50 rounded-3xl p-8 border-2 border-emerald-500 relative shadow-xl shadow-emerald-100">
                    <div className="absolute -top-4 right-8 bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                        {t('rpass_best_value') || '¡Mejor Valor!'}
                    </div>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="text-xl font-black text-emerald-900">{t('prof_pass_annual') || 'Anual'}</h4>
                            <p className="text-emerald-700 text-sm">{t('prof_pass_free_months') || '2 meses gratis'}</p>
                        </div>
                    </div>
                    <div className="mb-8">
                        <span className="text-4xl font-black text-emerald-900">{formatCOP(149000)}</span>
                        <span className="text-emerald-700 font-bold ml-1">{t('rpass_annual_suffix') || '/ año'}</span>
                    </div>
                    <button
                        onClick={() => handleSubscribe('annual')}
                        disabled={!!loading}
                        className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                        {loading === 'annual' ? <Loader2 className="animate-spin" size={18} /> : (t('prof_pass_save_now') || 'Ahorrar ahora')}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-gray-100">
                <h4 className="font-black text-gray-900 mb-8 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600" /> {t('prof_pass_why') || 'Por qué unirse a Rescatto Pass'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {benefits.map((b, i) => (
                        <div key={i} className="space-y-3">
                            <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center">{b.icon}</div>
                            <h5 className="font-bold text-gray-900 leading-tight">{b.title}</h5>
                            <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            <p className="text-center text-xs text-gray-400">
                El pago se realiza por transferencia bancaria BBVA Bre-B. Activación en menos de 24h tras verificación.
            </p>
        </div>
    );
};
