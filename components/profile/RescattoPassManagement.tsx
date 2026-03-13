import React, { useState } from 'react';
import { User, RescattoPass } from '../../types';
import { Zap, Check, CreditCard, Star, ShieldCheck, Truck, TrendingUp, Loader2 } from 'lucide-react';
import { formatCOP } from '../../utils/formatters';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';

interface Props {
  user: User;
}

export const RescattoPassManagement: React.FC<Props> = ({ user }) => {
  const { showToast, success } = useToast();
  const [loading, setLoading] = useState(false);
  const pass = user.rescattoPass;

  const handleSubscribe = async (planId: 'monthly' | 'annual') => {
    setLoading(true);
    try {
      const createSessionFn = httpsCallable(functions, 'createStripeCheckoutSession');
      const result: any = await createSessionFn({ 
        planId,
        successUrl: `${window.location.origin}/perfil?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/perfil?status=cancel`
      });

      if (result.data?.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      logger.error('Subscription error:', err);
      showToast('error', 'Error al iniciar el pago. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Truck className="text-emerald-500" size={20} />,
      title: 'Envíos Gratis Ilimitados',
      desc: 'En todos tus pedidos sin monto mínimo.'
    },
    {
      icon: <Star className="text-amber-500" size={20} />,
      title: 'Ofertas Exclusivas',
      desc: 'Acceso anticipado a Packs Sorpresa premium.'
    },
    {
      icon: <TrendingUp className="text-blue-500" size={20} />,
      title: 'Multiplicador de Impacto',
      desc: 'Gana 10% más puntos en cada rescate.'
    }
  ];

  if (pass?.isActive && pass.status === 'active') {
    return (
      <div className="space-y-6">
        {/* Active Plan Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap size={120} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 bg-white/20 w-fit px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
              <ShieldCheck size={14} />
              Miembro Activo
            </div>
            
            <h3 className="text-3xl font-black mb-1">Rescatto Pass</h3>
            <p className="text-emerald-100 opacity-80 mb-6">Plan {pass.planId === 'monthly' ? 'Mensual' : 'Anual'}</p>
            
            <div className="flex items-center justify-between border-t border-white/20 pt-6">
              <div>
                <p className="text-xs uppercase opacity-60 font-bold mb-1">Próxima Renovación</p>
                <p className="text-lg font-bold">{new Date(pass.expiresAt).toLocaleDateString()}</p>
              </div>
              <button className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95">
                Gestionar Pago
              </button>
            </div>
          </div>
        </div>

        {/* Benefits List */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <h4 className="font-black text-gray-900 mb-6">Tus Beneficios Activos</h4>
          <div className="space-y-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-4">
                <div className="bg-gray-50 p-3 rounded-2xl shrink-0">
                  {b.icon}
                </div>
                <div>
                  <h5 className="font-bold text-gray-900">{b.title}</h5>
                  <p className="text-sm text-gray-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
            <button className="text-gray-400 text-sm font-bold hover:text-red-500 transition-colors">
                Cancelar Suscripción
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-black text-gray-900">Únete a la elite del rescate</h3>
        <p className="text-gray-500">Ahorra más, rescata más y obtén beneficios premium.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Plan */}
        <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 hover:border-emerald-500 transition-all group relative cursor-pointer shadow-sm hover:shadow-xl hover:shadow-emerald-100/50">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-xl font-black text-gray-900">Mensual</h4>
              <p className="text-gray-500 text-sm">Flexibilidad total</p>
            </div>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black text-gray-900">{formatCOP(14900)}</span>
            <span className="text-gray-400 font-bold ml-1">/ mes</span>
          </div>
          <button 
            onClick={() => handleSubscribe('monthly')}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Suscribirme'}
          </button>
        </div>

        {/* Annual Plan */}
        <div className="bg-emerald-50 rounded-3xl p-8 border-2 border-emerald-500 relative shadow-xl shadow-emerald-100">
          <div className="absolute -top-4 right-8 bg-emerald-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
            ¡Mejor Valor!
          </div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-xl font-black text-emerald-900">Anual</h4>
              <p className="text-emerald-700 text-sm">2 meses gratis</p>
            </div>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black text-emerald-900">{formatCOP(149000)}</span>
            <span className="text-emerald-700 font-bold ml-1">/ año</span>
          </div>
          <button 
            onClick={() => handleSubscribe('annual')}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Ahorrar ahora'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-100">
        <h4 className="font-black text-gray-900 mb-8 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" /> Por qué unirse a Rescatto Pass
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {benefits.map((b, i) => (
            <div key={i} className="space-y-3">
              <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center">
                {b.icon}
              </div>
              <h5 className="font-bold text-gray-900 leading-tight">{b.title}</h5>
              <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        La suscripción se renueva automáticamente. Puedes cancelar en cualquier momento.
      </p>
    </div>
  );
};
