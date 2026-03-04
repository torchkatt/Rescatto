import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { ArrowLeft, User, Mail, Phone, MapPin, Edit2, Save, X, Award, Package, LogOut, Leaf, Copy, Share2, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/customer/common/Button';
import { authService } from '../../services/authService';
import { ImpactStats } from '../../components/customer/profile/ImpactStats';
import { UserBadges } from '../../components/customer/profile/UserBadges';
import { UserWallet } from '../../components/customer/profile/UserWallet';
import { Lock } from 'lucide-react';
import { Tooltip } from '../../components/common/Tooltip';
import { EditProfileModal } from '../../components/customer/profile/EditProfileModal';
import { User as UserType } from '../../types';
import { logger } from '../../utils/logger';

export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast, info, success } = useToast();
    const confirm = useConfirm();
    const [showEditModal, setShowEditModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const [password, setPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const handleChangePassword = async () => {
        if (!password || password.length < 6) {
            showToast('error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setChangingPassword(true);
        try {
            await authService.changePassword(password);
            showToast('success', 'Contraseña actualizada correctamente');
            setPassword('');
        } catch (error: any) {
            logger.error(error);
            showToast('error', `Error: ${error.message}`);
        } finally {
            setChangingPassword(false);
        }
    };

    const handleCopyReferral = async () => {
        if (!user?.referralCode) return;
        try {
            await navigator.clipboard.writeText(user.referralCode);
            setCopied(true);
            showToast('success', '¡Código copiado al portapapeles! 📋');
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            showToast('error', 'No se pudo copiar el código.');
        }
    };

    const handleShareReferral = async () => {
        if (!user?.referralCode) return;
        const shareData = {
            title: '¡Únete a Rescatto!',
            text: `Usa mi código de referido ${user.referralCode} al registrarte en Rescatto y ganemos puntos para canjear por increíbles descuentos. 🌱`,
            url: window.location.origin
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                handleCopyReferral();
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                logger.error('Error compartiendo código:', err);
            }
        }
    };

    const handleSaveProfile = async (data: Partial<UserType>) => {
        if (!user) return;

        setSaving(true);
        try {
            const userRef = doc(db, 'users', user.id);
            // Only update allowed fields
            await updateDoc(userRef, {
                fullName: data.fullName,
                phone: data.phone,
                address: data.address,
                city: data.city || '' // Ensure no undefined
            });

            setShowEditModal(false);
            showToast('success', 'Perfil actualizado exitosamente');
        } catch (error) {
            logger.error('Error updating profile:', error);
            showToast('error', 'Error al actualizar el perfil');
        } finally {
            setSaving(false);
        }
    };

    const handleRedeem = async (rewardId: string) => {
        const rewardCosts: Record<string, number> = {
            'free_shipping': 50,
            'discount_10': 150,
            'free_pack': 500
        };
        const cost = rewardCosts[rewardId] || 0;

        if (!user || (user.impact?.points || 0) < cost) {
            showToast('error', 'No tienes puntos suficientes.');
            return;
        }

        const confirmed = await confirm({
            title: 'Confirmar Canje',
            message: `¿Estás seguro de que quieres canjear ${cost} puntos por ${rewardId.replace('_', ' ')}?`,
            confirmLabel: 'Canjear Ahora',
            variant: 'warning'
        });

        if (!confirmed) return;

        setSaving(true);
        try {
            const redeemFn = httpsCallable(functions, 'redeemPoints');
            await redeemFn({ rewardId, cost });
            success(`¡Éxito! Has canjeado ${cost} puntos. El beneficio se aplicará en tu próximo pedido.`);
        } catch (err: any) {
            logger.error('Error redeeming points:', err);
            showToast('error', err.message || 'Error al procesar el canje.');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Cargando perfil...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Tooltip text="Volver al inicio" position="right">
                            <button
                                onClick={() => navigate('/app')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-gray-700 hover:text-gray-900 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 group shadow-sm font-medium"
                            >
                                <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
                                <span>Volver</span>
                            </button>
                        </Tooltip>
                    </div>

                    <div className="flex items-center gap-2">
                        <Tooltip text="Cerrar sesión de forma segura">
                            <button
                                onClick={() => logout()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-medium transition-colors"
                            >
                                <LogOut size={18} />
                                <span className="hidden sm:inline">Cerrar Sesión</span>
                            </button>
                        </Tooltip>
                        <Tooltip text="Editar mis datos personales">
                            <Button
                                onClick={() => setShowEditModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transition-all"
                            >
                                <Edit2 size={18} />
                                Editar Perfil
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Profile Header Card */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-8">
                    {/* Cover Image */}
                    <div className="relative">
                        <div className="h-48 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500"></div>

                        {/* Avatar - Positioned over the cover */}
                        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 sm:left-8 sm:translate-x-0">
                            <div className="relative">
                                <div className="w-40 h-40 bg-white rounded-full p-2 shadow-2xl">
                                    <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-inner">
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="absolute bottom-2 right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-md"></div>
                            </div>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="pt-24 sm:pt-8 pb-8 px-6 sm:px-8 text-center sm:text-left sm:pl-52">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.fullName}</h1>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                                {user.role}
                            </span>
                            <Tooltip text={`Nivel actual: ${user.impact?.level || 'NOVICE'}`}>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 shadow-sm border ${user.impact?.level === 'GUARDIAN' ? 'bg-purple-600 text-white border-purple-400' :
                                    user.impact?.level === 'HERO' ? 'bg-blue-600 text-white border-blue-400' :
                                        'bg-emerald-600 text-white border-emerald-400'
                                    }`}>
                                    <Award size={14} className="animate-bounce" />
                                    {user.impact?.level === 'GUARDIAN' ? 'GUARDIÁN DE LA TIERRA' :
                                        user.impact?.level === 'HERO' ? 'HÉROE DEL PLANETA' :
                                            'RESCATISTA NOVATO'}
                                </span>
                            </Tooltip>
                        </div>
                        <p className="text-gray-500 text-sm">{user.email}</p>
                    </div>
                </div>

                {/* Impact Dashboard Section (UX V2.0) */}
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Leaf className="text-emerald-600" size={20} />
                    Tu Impacto Revolucionario
                </h2>
                <ImpactStats impact={user.impact} />

                {/* Badges Section */}
                <UserBadges
                    badges={user.impact?.badges}
                    totalRescues={user.impact?.totalRescues || 0}
                />

                {/* Wallet Section */}
                <UserWallet
                    points={user.impact?.points || 0}
                    onRedeem={handleRedeem}
                />

                {/* Referral Section: Invita y Gana */}
                {user.referralCode && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl shadow-lg border border-indigo-100 p-8 mt-8 relative overflow-hidden">
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

                        <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
                                <div className="text-center sm:text-left flex-1">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                                        <Users size={14} /> Viralidad
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
                                        Invita amigos y gana <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">50 Puntos</span>
                                    </h2>
                                    <p className="text-gray-600 mb-6 max-w-md">
                                        Comparte tu código único con tus amigos. Cuando se registren en Rescatto usando tu código, ¡Ambos recibirán puntos de impacto!
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1 max-w-[200px] group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-gray-400 font-bold">Rescatto-</span>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                value={user.referralCode}
                                                className="w-full pl-24 pr-4 py-3.5 bg-white border-2 border-indigo-100 rounded-2xl font-black text-indigo-700 text-lg tracking-widest outline-none shadow-sm cursor-text"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleCopyReferral}
                                            className="bg-white hover:bg-gray-50 text-indigo-600 border-2 border-indigo-100 px-6 sm:px-8 py-3.5 rounded-2xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                            {copied ? 'Copiado' : 'Copiar'}
                                        </Button>
                                        <Button
                                            onClick={handleShareReferral}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                                        >
                                            <Share2 size={18} /> Compartir
                                        </Button>
                                    </div>
                                </div>
                                <div className="hidden lg:block w-48 shrink-0 relative">
                                    <img src="https://cdni.iconscout.com/illustration/premium/thumb/refer-a-friend-4437255-3725916.png" alt="Referral Illustration" className="w-full drop-shadow-2xl animate-bounce-slow" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Information Card */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Información Personal</h2>
                        <Button
                            onClick={() => setShowEditModal(true)}
                            variant="secondary"
                            className="bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                            <Edit2 size={16} /> Editar
                        </Button>
                    </div>

                    <div className="space-y-6">
                        {/* Full Name */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <User size={16} className="text-emerald-600" />
                                </div>
                                Nombre Completo
                            </label>
                            <div className="px-5 py-4 bg-gray-50 rounded-xl text-gray-900 font-medium border border-gray-100">
                                {user.fullName}
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Mail size={16} className="text-blue-600" />
                                </div>
                                Correo Electrónico
                            </label>
                            <div className="px-5 py-4 bg-gray-50 rounded-xl text-gray-600 flex items-center justify-between border border-gray-100">
                                <span className="font-medium">{user.email}</span>
                                <span className="text-xs bg-gray-200 px-3 py-1 rounded-full font-bold text-gray-600">
                                    No editable
                                </span>
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Phone size={16} className="text-purple-600" />
                                </div>
                                Teléfono
                            </label>
                            <div className="px-5 py-4 bg-gray-50 rounded-xl text-gray-900 font-medium border border-gray-100">
                                {user?.phone || <span className="text-gray-400 italic">No especificado</span>}
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                                    <MapPin size={16} className="text-rose-600" />
                                </div>
                                Dirección
                            </label>
                            <div className="px-5 py-4 bg-gray-50 rounded-xl text-gray-900 font-medium whitespace-pre-wrap border border-gray-100 min-h-[80px]">
                                {user?.address || <span className="text-gray-400 italic">No especificado</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Lock size={20} className="text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Seguridad</h2>
                    </div>

                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <Button
                            onClick={handleChangePassword}
                            isLoading={changingPassword}
                            disabled={!password}
                            className="bg-gray-900 hover:bg-black text-white px-6"
                        >
                            Actualizar Contraseña
                        </Button>
                    </div>
                </div>
            </div>

            {/* Profile Edit Modal */}
            {showEditModal && user && (
                <EditProfileModal
                    user={user}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleSaveProfile}
                />
            )}
        </div>
    );
};

export default Profile;
