import React, { useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { Button } from '../customer/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

export const SecuritySettings: React.FC = () => {
    const { t } = useTranslation();
    const { logout } = useAuth();
    const { showToast } = useToast();

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
