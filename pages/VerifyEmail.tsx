import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, RefreshCw, LogOut } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { authService } from '../services/authService';

import { Navigate } from 'react-router-dom';
import { logger } from '../utils/logger';

export const VerifyEmail: React.FC = () => {
    const { user, sendVerificationEmail } = useAuth();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    // Auto-dismiss messages after 5 seconds
    useEffect(() => {
        if (error || sent) {
            const timer = setTimeout(() => {
                setError('');
                setSent(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, sent]);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const handleResend = async () => {
        setSending(true);
        setError('');
        try {
            await sendVerificationEmail();
            setSent(true);
        } catch (err: any) {
            logger.error(err);
            if (err.code === 'auth/too-many-requests') {
                setError('Por favor espera unos minutos antes de intentar de nuevo.');
            } else {
                setError('Error al enviar el correo. Inténtalo más tarde.');
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8">
                <Logo size="lg" showText textColor="text-gray-900" />
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                    <Mail size={40} className="text-blue-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-800">Verifica tu correo</h1>

                <p className="text-gray-600">
                    Hola <strong>{user?.fullName}</strong>,<br />
                    Para proteger tu cuenta, necesitamos que verifiques tu dirección de correo electrónico:
                </p>

                <div className="bg-blue-50 p-3 rounded-lg text-blue-800 font-medium">
                    {user?.email}
                </div>

                <p className="text-sm text-gray-500">
                    Revisa tu bandeja de entrada (y spam) para encontrar el enlace de verificación.
                </p>

                {error && (
                    <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                        {error}
                    </div>
                )}

                {sent && (
                    <div className="text-green-600 text-sm bg-green-50 p-2 rounded">
                        ¡Correo enviado! Revisa tu bandeja de entrada.
                    </div>
                )}

                <div className="space-y-3 pt-4">
                    <button
                        onClick={handleResend}
                        disabled={sending || sent}
                        className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors ${sending || sent
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {sending ? <RefreshCw className="animate-spin" size={20} /> : <Mail size={20} />}
                        {sending ? 'Enviando...' : sent ? 'Enviado' : 'Reenviar correo'}
                    </button>

                    <button
                        onClick={() => authService.logout()}
                        className="w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
