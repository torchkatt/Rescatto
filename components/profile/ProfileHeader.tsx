import React, { useRef, useState } from 'react';
import { User, UserRole } from '../../types';
import { Shield, Award, Camera, Loader2 } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, auth, db } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { logger } from '../../utils/logger';

interface ProfileHeaderProps {
    user: User;
    onEditAvatar?: () => void; // kept for backward compat but no longer required
}

const getRoleConfig = (role: UserRole) => {
    switch (role) {
        case UserRole.SUPER_ADMIN:
            return { label: 'Super Admin', color: 'bg-purple-100 text-purple-700 border-purple-200', gradient: 'from-purple-500 to-indigo-600' };
        case UserRole.ADMIN:
            return { label: 'Administrador', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', gradient: 'from-indigo-500 to-blue-600' };
        case UserRole.VENUE_OWNER:
            return { label: 'Dueño de Sede', color: 'bg-blue-100 text-blue-700 border-blue-200', gradient: 'from-blue-500 to-cyan-600' };
        case UserRole.KITCHEN_STAFF:
            return { label: 'Personal de Cocina', color: 'bg-orange-100 text-orange-700 border-orange-200', gradient: 'from-orange-500 to-amber-600' };
        case UserRole.DRIVER:
            return { label: 'Conductor', color: 'bg-amber-100 text-amber-700 border-amber-200', gradient: 'from-amber-500 to-yellow-600' };
        case UserRole.CUSTOMER:
            return { label: 'Cliente Rescatto', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', gradient: 'from-emerald-500 to-teal-600' };
        default:
            return { label: 'Usuario', color: 'bg-gray-100 text-gray-700 border-gray-200', gradient: 'from-gray-500 to-slate-600' };
    }
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
    const roleConfig = getRoleConfig(user.role);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const { showToast } = useToast();

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !auth.currentUser) return;

        // Validaciones
        if (!file.type.startsWith('image/')) {
            showToast('error', 'Solo se permiten imágenes (JPG, PNG, WebP).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('error', 'La imagen no puede superar los 5 MB.');
            return;
        }

        // Preview optimista
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setUploading(true);

        try {
            // Upload a Firebase Storage: avatars/{userId}/{timestamp}.{ext}
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `avatars/${user.id}/${Date.now()}.${ext}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);

            // 1. Actualizar Firebase Auth profile
            await updateProfile(auth.currentUser, { photoURL: downloadUrl });

            // 2. Persistir en Firestore
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, { avatarUrl: downloadUrl });

            showToast('success', '¡Foto de perfil actualizada! 📸');
        } catch (error) {
            logger.error('ProfileHeader: error uploading avatar', error);
            setPreviewUrl(null); // revertir preview
            showToast('error', 'No se pudo guardar la foto. Intenta de nuevo.');
        } finally {
            setUploading(false);
            // Liberar object URL
            URL.revokeObjectURL(objectUrl);
            // Reset input para permitir subir el mismo archivo de nuevo
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const avatarSrc = previewUrl ?? user.avatarUrl;

    return (
        <div className="relative mb-20">
            {/* Banner Background */}
            <div className={`h-48 w-full rounded-3xl bg-gradient-to-r ${roleConfig.gradient} relative overflow-hidden shadow-sm`}>
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>

            {/* Avatar & Main Info Card - Floating Over Banner */}
            <div className="absolute -bottom-16 left-6 md:left-10 flex items-end">
                <div className="relative group">
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-full p-2 shadow-xl ring-4 ring-white/50">
                        {avatarSrc ? (
                            <img
                                src={avatarSrc}
                                alt={user.fullName}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <div className={`w-full h-full rounded-full bg-gradient-to-br ${roleConfig.gradient} flex items-center justify-center text-white text-5xl font-bold`}>
                                {user.fullName.charAt(0).toUpperCase()}
                            </div>
                        )}

                        {/* Upload overlay */}
                        <button
                            onClick={handleAvatarClick}
                            disabled={uploading}
                            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                            title="Cambiar foto de perfil"
                        >
                            {uploading ? (
                                <Loader2 size={28} className="text-white animate-spin" />
                            ) : (
                                <Camera size={28} className="text-white" />
                            )}
                        </button>
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* Verification Badge */}
                    {user.isVerified && (
                        <div className="absolute bottom-4 right-4 bg-blue-500 text-white p-1.5 rounded-full border-4 border-white shadow-sm" title="Cuenta Verificada">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                    )}
                </div>

                <div className="mb-4 ml-4 md:ml-6 pb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 drop-shadow-sm bg-white/50 backdrop-blur-sm px-2 rounded-lg inline-block">
                        {user.fullName}
                    </h1>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${roleConfig.color} shadow-sm`}>
                            <Shield size={12} />
                            {roleConfig.label}
                        </span>

                        {user.impact?.level && (
                            <Tooltip text={`Nivel de Impacto: ${user.impact.level}`}>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-amber-500 text-white border border-yellow-300 shadow-sm flex items-center gap-1.5">
                                    <Award size={12} />
                                    {user.impact.level}
                                </span>
                            </Tooltip>
                        )}

                        <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-white/50 rounded-lg backdrop-blur-sm">
                            Miembro desde {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
