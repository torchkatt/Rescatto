import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Link2, Unlink, Mail, Chrome, Apple, Check } from 'lucide-react';
import { Button } from '../customer/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

// Provider display names and icons
const PROVIDERS: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  'password':    { name: 'Correo / Contraseña', icon: <Mail size={18} />, color: 'bg-amber-100 text-amber-600' },
  'google.com':  { name: 'Google',              icon: <Chrome size={18} />, color: 'bg-blue-100 text-blue-600' },
  'apple.com':   { name: 'Apple',               icon: <Apple size={18} />, color: 'bg-gray-900 text-white' },
  'facebook.com':{ name: 'Facebook',            icon: <Check size={18} />, color: 'bg-indigo-100 text-indigo-600' },
};

export const SecuritySettings: React.FC = () => {
    const { t } = useTranslation();
    const { logout } = useAuth();
    const { showToast } = useToast();

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Account Linking State
    const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
    const [linkingLoading, setLinkingLoading] = useState<string | null>(null);
    const [showLinkEmail, setShowLinkEmail] = useState(false);
    const [linkEmail, setLinkEmail] = useState('');
    const [linkPassword, setLinkPassword] = useState('');

    // Load current linked providers
    useEffect(() => {
        setLinkedProviders(authService.getLinkedProviders());
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            showToast('error', t('prof_pass_min_6') || 'La nueva contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('error', t('prof_pass_no_match') || 'Las contraseñas no coinciden');
            return;
        }

        if (!currentPassword) {
            showToast('error', t('prof_pass_need_current') || 'Debes ingresar tu contraseña actual');
            return;
        }

        setLoading(true);
        try {
            await authService.reauthenticate(currentPassword);
            await authService.changePassword(newPassword);
            showToast('success', t('prof_pass_success') || 'Contraseña actualizada correctamente');
            setNewPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
        } catch (error: any) {
            logger.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showToast('error', t('prof_pass_wrong') || 'La contraseña actual es incorrecta.');
            } else if (error.code === 'auth/requires-recent-login') {
                showToast('error', t('prof_pass_recent_login') || 'Por seguridad, debes volver a iniciar sesión para cambiar tu contraseña.');
                logout();
            } else {
                showToast('error', t('security_error_generic', { message: error.message }) || `Error: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // ─── Account Linking Handlers ───

    const handleLinkGoogle = async () => {
        setLinkingLoading('google.com');
        try {
            const providers = await authService.linkGoogle();
            setLinkedProviders(providers);
            showToast('success', '✅ Cuenta de Google vinculada. Ahora ambos métodos de inicio comparten la misma información.');
        } catch (error: any) {
            if (error.code === 'auth/credential-already-in-use') {
                showToast('error', 'Esta cuenta de Google ya está vinculada a otro usuario.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup — not an error
            } else {
                showToast('error', error.message || 'Error al vincular Google');
            }
        } finally {
            setLinkingLoading(null);
        }
    };

    const handleLinkApple = async () => {
        setLinkingLoading('apple.com');
        try {
            const providers = await authService.linkApple();
            setLinkedProviders(providers);
            showToast('success', '✅ Cuenta de Apple vinculada.');
        } catch (error: any) {
            if (error.code !== 'auth/popup-closed-by-user') {
                showToast('error', error.message || 'Error al vincular Apple');
            }
        } finally {
            setLinkingLoading(null);
        }
    };

    const handleLinkEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkEmail || !linkPassword) return;
        setLinkingLoading('password');
        try {
            const providers = await authService.linkEmail(linkEmail, linkPassword);
            setLinkedProviders(providers);
            setShowLinkEmail(false);
            setLinkEmail('');
            setLinkPassword('');
            showToast('success', '✅ Correo vinculado. Ahora puedes iniciar sesión con email además de tu método actual.');
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                showToast('error', 'Este correo ya está registrado. Usa una cuenta diferente.');
            } else {
                showToast('error', error.message || 'Error al vincular correo');
            }
        } finally {
            setLinkingLoading(null);
        }
    };

    const handleUnlink = async (providerId: string) => {
        setLinkingLoading(providerId);
        try {
            const providers = await authService.unlinkProvider(providerId);
            setLinkedProviders(providers);
            showToast('success', `Método de inicio desvinculado.`);
        } catch (error: any) {
            showToast('error', error.message || 'Error al desvincular');
        } finally {
            setLinkingLoading(null);
        }
    };

    const availableToLink = ['google.com', 'apple.com', 'password'].filter(p => !linkedProviders.includes(p));

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                    <Lock size={20} className="text-rose-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{t('prof_security_title') || 'Seguridad de la Cuenta'}</h2>
            </div>

            <div className="max-w-md">
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('prof_current_password') || 'Contraseña Actual'}</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-base outline-none font-medium"
                            placeholder={t('prof_current_password') || "Tu contraseña actual"}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('prof_new_password') || 'Nueva Contraseña'}</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-base outline-none font-medium"
                            placeholder={t('prof_min_chars') || "Mínimo 6 caracteres"}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('prof_confirm_password') || 'Confirmar Nueva Contraseña'}</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-base outline-none font-medium"
                            placeholder={t('prof_repeat_pass') || "Repite la contraseña"}
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            isLoading={loading}
                            disabled={!newPassword || !confirmPassword}
                            className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl"
                        >
                            {t('prof_update_pass') || 'Actualizar Contraseña'}
                        </Button>
                    </div>
                </form>

                {/* ─── Account Linking ─── */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <Link2 size={16} className="text-emerald-600" />
                        Métodos de inicio de sesión vinculados
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                        Vincula varios métodos para acceder desde cualquier dispositivo con la misma cuenta.
                        Tus datos, pedidos y preferencias se sincronizan automáticamente.
                    </p>

                    {/* Current providers */}
                    <div className="space-y-2 mb-4">
                        {linkedProviders.map(pid => {
                            const info = PROVIDERS[pid] || { name: pid, icon: <Link2 size={18} />, color: 'bg-gray-100 text-gray-600' };
                            return (
                                <div key={pid} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${info.color}`}>
                                            {info.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{info.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Vinculado ✓</p>
                                        </div>
                                    </div>
                                    {linkedProviders.length > 1 && (
                                        <button
                                            onClick={() => handleUnlink(pid)}
                                            disabled={linkingLoading === pid}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
                                        >
                                            {linkingLoading === pid ? '...' : 'Desvincular'}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Available to link */}
                    {availableToLink.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Agregar método</p>

                            {availableToLink.includes('google.com') && (
                                <button
                                    onClick={handleLinkGoogle}
                                    disabled={linkingLoading === 'google.com'}
                                    className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all active:scale-[0.99] disabled:opacity-30"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Chrome size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 flex-1 text-left">
                                        {linkingLoading === 'google.com' ? 'Vinculando...' : 'Vincular Google'}
                                    </span>
                                </button>
                            )}

                            {availableToLink.includes('apple.com') && (
                                <button
                                    onClick={handleLinkApple}
                                    disabled={linkingLoading === 'apple.com'}
                                    className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-[0.99] disabled:opacity-30"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white">
                                        <Apple size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 flex-1 text-left">
                                        {linkingLoading === 'apple.com' ? 'Vinculando...' : 'Vincular Apple'}
                                    </span>
                                </button>
                            )}

                            {availableToLink.includes('password') && !showLinkEmail && (
                                <button
                                    onClick={() => setShowLinkEmail(true)}
                                    className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-amber-200 hover:bg-amber-50/50 transition-all active:scale-[0.99]"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                                        <Mail size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 flex-1 text-left">
                                        Vincular Correo y Contraseña
                                    </span>
                                </button>
                            )}

                            {showLinkEmail && (
                                <form onSubmit={handleLinkEmail} className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                                    <input
                                        type="email"
                                        value={linkEmail}
                                        onChange={e => setLinkEmail(e.target.value)}
                                        placeholder="tu@correo.com"
                                        className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"
                                        required
                                    />
                                    <input
                                        type="password"
                                        value={linkPassword}
                                        onChange={e => setLinkPassword(e.target.value)}
                                        placeholder="Contraseña (mín. 6 caracteres)"
                                        className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"
                                        minLength={6}
                                        required
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={linkingLoading === 'password'}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                                        >
                                            {linkingLoading === 'password' ? 'Vinculando...' : 'Vincular'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowLinkEmail(false); setLinkEmail(''); setLinkPassword(''); }}
                                            className="px-4 text-sm font-bold text-gray-500 hover:text-gray-700"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">{t('prof_active_sessions') || 'Sesiones Activas'}</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        {t('prof_security_compromised') || 'Si crees que tu cuenta ha sido comprometida, puedes cerrar sesión en todos los dispositivos.'}
                    </p>
                    <button
                        onClick={logout}
                        className="text-red-600 hover:text-red-700 text-sm font-bold flex items-center gap-2 hover:bg-red-50 px-4 py-3 rounded-xl transition-all border border-gray-100 hover:border-red-100 w-full sm:w-auto justify-center active:scale-95"
                    >
                        <LogOut size={16} />
                        {t('prof_logout_device') || 'Cerrar Sesión en este dispositivo'}
                    </button>
                </div>
            </div>
        </div>
    );
};
