import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { PersonalDetails } from '../../components/profile/PersonalDetails';
import { SecuritySettings } from '../../components/profile/SecuritySettings';
import { RoleSpecificStats } from '../../components/profile/RoleSpecificStats';
import { ReferralSection } from '../../components/profile/ReferralSection';
import { RescattoPassManagement } from '../../components/profile/RescattoPassManagement';
import { User } from '../../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { LayoutDashboard, User as UserIcon, Lock, TrendingUp, Gift, Zap } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { useConfirm } from '../../context/ConfirmContext';
import { logger } from '../../utils/logger';
import { GuestProfileView } from '../../components/profile/GuestProfileView';

export const UnifiedProfile: React.FC = () => {
    const { user } = useAuth();
    const { showToast, success } = useToast();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<'details' | 'stats' | 'security' | 'referrals' | 'pass'>('details');

    if (!user) {
        return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
    }

    if (user.isGuest) {
        return <GuestProfileView />;
    }

    const handleSaveProfile = async (data: Partial<User>) => {
        try {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                fullName: data.fullName,
                phone: data.phone,
                address: data.address,
                city: data.city || ''
            });
            showToast('success', 'Perfil actualizado exitosamente');
        } catch (error) {
            logger.error('Error updating profile:', error);
            showToast('error', 'Error al actualizar el perfil');
            throw error;
        }
    };

    const handleRedeemPoints = async (rewardId: string) => {
        // Logic copied/adapted from old Profile.tsx
        const rewardCosts: Record<string, number> = {
            'free_shipping': 50,
            'discount_10': 150,
            'free_pack': 150,
            'discount_5k': 50,
            'discount_10k': 90,
            'donation_meal': 100,
        };
        const cost = rewardCosts[rewardId] || 0;

        if ((user.impact?.points || 0) < cost) {
            showToast('error', 'No tienes puntos suficientes.');
            return;
        }

        const confirmed = await confirm({
            title: 'Confirmar Canje',
            message: `¿Estás seguro de que quieres canjear ${cost} puntos?`,
            confirmLabel: 'Canjear',
            variant: 'warning'
        });

        if (!confirmed) return;

        try {
            const redeemFn = httpsCallable(functions, 'redeemPoints');
            await redeemFn({ rewardId });
            success(`¡Canje exitoso! Disfruta tu recompensa.`);
        } catch (err: any) {
            logger.error('Redeem error:', err);
            showToast('error', 'Error al procesar el canje.');
        }
    };

    const handleEditAvatar = () => {
        showToast('info', 'Funcionalidad de subir avatar próximamente.');
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                <ProfileHeader user={user} onEditAvatar={handleEditAvatar} />

                {/* Navigation Tabs */}
                <div className="grid grid-cols-2 sm:flex sm:overflow-x-auto pb-4 mb-6 gap-2 no-scrollbar px-1">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-center leading-tight transition-all whitespace-normal sm:whitespace-nowrap active:scale-95 ${activeTab === 'details'
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <UserIcon size={18} />
                        Información Personal
                    </button>

                    {/* Show Stats tab only for roles that have specific stats implemented */}
                    {(user.role === UserRole.CUSTOMER || user.role === UserRole.DRIVER || user.role === UserRole.VENUE_OWNER || user.role === UserRole.KITCHEN_STAFF) && (
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-center leading-tight transition-all whitespace-normal sm:whitespace-nowrap active:scale-95 ${activeTab === 'stats'
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <TrendingUp size={18} />
                            {user.role === UserRole.CUSTOMER ? 'Mi Impacto y Puntos' :
                                user.role === UserRole.DRIVER ? 'Métricas de Entrega' :
                                    'Estado Operativo'}
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-center leading-tight transition-all whitespace-normal sm:whitespace-nowrap active:scale-95 ${activeTab === 'security'
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Lock size={18} />
                        Seguridad
                    </button>

                    {user.role === UserRole.CUSTOMER && (
                        <button
                            onClick={() => setActiveTab('pass')}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-center leading-tight transition-all whitespace-normal sm:whitespace-nowrap active:scale-95 ${activeTab === 'pass'
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400'
                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100'
                                }`}
                        >
                            <Zap size={18} />
                            Rescatto Pass
                        </button>
                    )}

                    {user.role === UserRole.CUSTOMER && (
                        <button
                            onClick={() => setActiveTab('referrals')}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-center leading-tight transition-all whitespace-normal sm:whitespace-nowrap active:scale-95 ${activeTab === 'referrals'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                                }`}
                        >
                            <Gift size={18} />
                            Mis Referidos
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                    {activeTab === 'details' && (
                        <PersonalDetails user={user} onSave={handleSaveProfile} />
                    )}

                    {activeTab === 'stats' && (
                        <RoleSpecificStats user={user} onRedeem={handleRedeemPoints} />
                    )}

                    {activeTab === 'security' && (
                        <SecuritySettings />
                    )}

                    {activeTab === 'referrals' && user.role === UserRole.CUSTOMER && (
                        <ReferralSection user={user} />
                    )}

                    {activeTab === 'pass' && user.role === UserRole.CUSTOMER && (
                        <RescattoPassManagement user={user} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedProfile;
