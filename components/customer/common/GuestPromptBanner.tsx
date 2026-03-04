import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn, X } from 'lucide-react';

interface GuestPromptBannerProps {
    /** Nombre de la feature que requiere cuenta (ej. "tus favoritos") */
    featureName: string;
    /** Icono decorativo (emoji o node) */
    icon?: React.ReactNode;
    onDismiss?: () => void;
}

/**
 * Banner que se muestra a usuarios invitados cuando intentan acceder a una
 * funcionalidad que requiere cuenta registrada (Favorites, Impact, etc.).
 * Ofrece acciones para iniciar sesión o registrarse.
 */
export const GuestPromptBanner: React.FC<GuestPromptBannerProps> = ({
    featureName,
    icon = '🌱',
    onDismiss
}) => {
    const navigate = useNavigate();

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden mb-2 animate-in slide-in-from-bottom duration-300">
                {/* Header decorativo */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 pt-6 pb-10 text-white text-center relative">
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <div className="text-5xl mb-3">{typeof icon === 'string' ? icon : ''}</div>
                    {typeof icon !== 'string' && <div className="mb-3">{icon}</div>}
                    <h2 className="text-xl font-bold">Crea tu cuenta Rescatto</h2>
                    <p className="text-sm text-white/80 mt-1">
                        Para guardar {featureName} necesitas tener una cuenta gratuita.
                    </p>
                </div>

                {/* Beneficios */}
                <div className="px-6 -mt-6">
                    <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
                        {[
                            { emoji: '❤️', text: 'Guarda tus restaurantes favoritos' },
                            { emoji: '🏆', text: 'Acumula puntos y canjes con cada pedido' },
                            { emoji: '🔥', text: 'Mantén tu racha de rescates' },
                            { emoji: '📦', text: 'Accede a tu historial de pedidos' },
                        ].map(b => (
                            <div key={b.text} className="flex items-center gap-3 text-sm text-gray-700">
                                <span className="text-xl flex-shrink-0">{b.emoji}</span>
                                <span>{b.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-5 space-y-3">
                    <button
                        onClick={() => navigate('/register')}
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-100"
                    >
                        <UserPlus size={20} />
                        Crear cuenta gratuita
                    </button>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full border-2 border-gray-200 text-gray-700 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:border-gray-300"
                    >
                        <LogIn size={18} />
                        Ya tengo cuenta — Iniciar sesión
                    </button>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
                        >
                            Seguir explorando sin cuenta
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
