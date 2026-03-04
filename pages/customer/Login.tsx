import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/customer/common/Button';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { logger } from '../../utils/logger';

const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Correo o contraseña incorrectos.';
        case 'auth/email-already-in-use':
            return 'Este correo ya está registrado.';
        case 'auth/weak-password':
            return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos fallidos. Intenta más tarde.';
        default:
            return 'Error al autenticar. Intenta nuevamente.';
    }
};

const CustomerLogin: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { success } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'register') {
                await authService.register(email, password, fullName, UserRole.CUSTOMER, {
                    invitedBy: referralCode ? referralCode.toUpperCase().trim() : undefined
                });
                success('¡Cuenta creada! Revisa tu correo para el enlace de verificación. 📧');
            } else {
                await authService.login(email, password);
            }
            navigate('/');
        } catch (err: any) {
            logger.error(err);
            setError(getErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setError('Ingresa tu correo para recuperar la contraseña.'); return; }
        setLoading(true);
        setError('');
        try {
            await authService.resetPassword(email);
            success('📧 Te enviamos un correo para restablecer tu contraseña.');
            setMode('login');
        } catch (err: any) {
            setError(getErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'apple' | 'facebook') => {
        setError('');
        setLoading(true);
        try {
            if (provider === 'google') await authService.loginWithGoogle();
            else if (provider === 'apple') await authService.loginWithApple();
            else if (provider === 'facebook') await authService.loginWithFacebook();
        } catch (err: any) {
            logger.error(err);
            setError(getErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const titleMap = {
        login: '¡Hola de nuevo!',
        register: 'Crear una cuenta',
        forgot: 'Recuperar contraseña',
    };
    const subtitleMap = {
        login: 'Ingresa tus credenciales para continuar.',
        register: 'Completa tus datos para comenzar a rescatar comida.',
        forgot: 'Te enviaremos un enlace para crear una nueva contraseña.',
    };

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left panel — hero image */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop"
                        alt="Food Background"
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 to-black/40" />
                </div>
                <div className="relative z-10 p-12 flex flex-col justify-between h-full text-white">
                    <div className="flex items-center gap-3">
                        <Logo size="md" className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 shadow-none" iconColor="#34d399" />
                        <span className="text-2xl font-bold tracking-tight">Rescatto</span>
                    </div>
                    <div className="mb-12">
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Salva comida.<br />
                            <span className="text-emerald-400">Ayuda al planeta.</span>
                        </h1>
                        <p className="text-lg text-gray-300 max-w-md leading-relaxed">
                            Únete a nuestra comunidad y descubre deliciosas ofertas de tus restaurantes favoritos mientras reduces el desperdicio de alimentos.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>© 2025 Rescatto</span>
                        <div className="w-1 h-1 bg-gray-600 rounded-full" />
                        <span>Privacidad</span>
                        <div className="w-1 h-1 bg-gray-600 rounded-full" />
                        <span>Términos</span>
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50/50">
                <div className="max-w-md w-full">
                    {/* Mobile logo */}
                    <div className="inline-flex lg:hidden items-center gap-2 mb-6 justify-center bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        <Logo size="sm" textColor="text-gray-900" />
                        <span className="font-bold text-gray-900">Rescatto</span>
                    </div>

                    <div className="text-center lg:text-left mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{titleMap[mode]}</h2>
                        <p className="text-gray-500">{subtitleMap[mode]}</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── Forgot password form ── */}
                    {mode === 'forgot' && (
                        <form onSubmit={handleForgotPassword} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700 ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail size={18} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                        placeholder="tu@email.com"
                                        required
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-base font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                                isLoading={loading}
                            >
                                Enviar enlace de recuperación
                            </Button>
                            <button
                                type="button"
                                onClick={() => { setMode('login'); setError(''); }}
                                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
                            >
                                ← Volver al inicio de sesión
                            </button>
                        </form>
                    )}

                    {/* ── Login / Register form ── */}
                    {mode !== 'forgot' && (
                        <>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {mode === 'register' && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Nombre Completo</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User size={18} className="text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={e => setFullName(e.target.value)}
                                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                                placeholder="Ej: Juan Pérez"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {mode === 'register' && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Código de Referido (Opcional)</label>
                                        <input
                                            type="text"
                                            value={referralCode}
                                            onChange={e => setReferralCode(e.target.value)}
                                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-emerald-50 text-emerald-900 font-bold tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
                                            placeholder="Ej: A1B2C3"
                                            maxLength={6}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Correo Electrónico</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                            placeholder="tu@email.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Contraseña</label>
                                        {mode === 'login' && (
                                            <button
                                                type="button"
                                                onClick={() => { setMode('forgot'); setError(''); }}
                                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                            >
                                                ¿Olvidaste tu contraseña?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-base font-bold shadow-lg shadow-emerald-200 hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
                                    isLoading={loading}
                                >
                                    {mode === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                    {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { window.location.hash = '#/app'; }}
                                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3.5 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    Explorar sin cuenta
                                </button>
                            </form>

                            <div className="my-8 flex items-center">
                                <div className="flex-1 border-t border-gray-200" />
                                <span className="px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">O continúa con</span>
                                <div className="flex-1 border-t border-gray-200" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => handleSocialLogin('google')}
                                    className="flex items-center justify-center py-2.5 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('apple')}
                                    className="flex items-center justify-center py-2.5 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleSocialLogin('facebook')}
                                    className="flex items-center justify-center py-2.5 border border-gray-200 rounded-xl shadow-sm bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                </button>
                            </div>

                            <p className="mt-8 text-center text-sm text-gray-500">
                                {mode === 'register' ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
                                <button
                                    type="button"
                                    onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
                                    className="ml-2 font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                                >
                                    {mode === 'register' ? 'Inicia Sesión' : 'Regístrate'}
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerLogin;
