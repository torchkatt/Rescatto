import React, { useState } from 'react';
import { UserPlus, X, Eye, EyeOff, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';

interface GuestConversionBannerProps {
    /** Contexto donde aparece el banner para personalizar el mensaje */
    context?: 'checkout' | 'post-order';
}

export const GuestConversionBanner: React.FC<GuestConversionBannerProps> = ({ context = 'checkout' }) => {
    const { user, convertGuestToUser } = useAuth();
    const { success, error } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!user?.isGuest || dismissed) return null;

    const handleLoginRedirect = () => {
        // Redirect to login, including current path for post-login return
        const currentPath = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?redirect=${currentPath}`);
    };

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim() || password.length < 6) {
            error('Completa todos los campos. La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            await convertGuestToUser(email.trim(), password, fullName.trim());
            success('¡Cuenta creada! Tus pedidos y puntos están guardados. 🎉');
            setOpen(false);
        } catch (err: any) {
            logger.error('GuestConversionBanner: convert error', err);
            if (err.code === 'auth/email-already-in-use') {
                error('Ese correo ya tiene una cuenta. Inicia sesión en su lugar.');
            } else {
                error('No se pudo crear la cuenta. Intenta nuevamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const headline = context === 'post-order'
        ? '¡Guarda tu pedido! Crea una cuenta gratis'
        : 'Estás comprando como invitado';

    const subtext = context === 'post-order'
        ? 'Crea tu cuenta para rastrear este pedido, acumular puntos y pedir de nuevo fácilmente.'
        : 'Crea tu cuenta gratis para guardar tus pedidos, acumular puntos y obtener beneficios exclusivos.';

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-full shrink-0">
                        <UserPlus size={18} className="text-amber-700" />
                    </div>
                    <div>
                        <p className="font-bold text-amber-900 text-sm">{headline}</p>
                        <p className="text-xs text-amber-700 mt-0.5">{subtext}</p>
                    </div>
                </div>
                <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
                    <X size={16} />
                </button>
            </div>

            {!open ? (
                <div className="mt-3 space-y-2">
                    <button
                        onClick={() => setOpen(true)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-all active:scale-95 shadow-sm"
                    >
                        Crear cuenta gratis
                    </button>
                    <button
                        onClick={handleLoginRedirect}
                        className="w-full bg-white border border-amber-300 text-amber-700 text-sm font-bold py-2.5 px-4 rounded-lg hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                        <LogIn size={16} />
                        Ya tengo cuenta, iniciar sesión
                    </button>
                </div>
            ) : (
                <form onSubmit={handleConvert} className="mt-3 space-y-2">
                    <input
                        type="text"
                        placeholder="Tu nombre"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        required
                    />
                    <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        required
                    />
                    <div className="relative">
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Contraseña (mín. 6 caracteres)"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full border border-amber-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            required
                            minLength={6}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(p => !p)}
                            className="absolute right-3 top-2.5 text-amber-400 hover:text-amber-600"
                        >
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex-1 border border-amber-300 text-amber-700 text-sm font-medium py-2 rounded-lg hover:bg-amber-100 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-bold py-2 rounded-lg transition-all active:scale-95"
                        >
                            {loading ? 'Guardando...' : 'Crear cuenta'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
