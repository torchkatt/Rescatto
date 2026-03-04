import React, { useState } from 'react';
import { User } from '../../../types';
import { Button } from '../common/Button';
import { X, Save, User as UserIcon, Mail, Phone, MapPin, Loader2, Crosshair } from 'lucide-react';
import { reverseGeocode } from '../../../services/locationService';
import { logger } from '../../../utils/logger';

interface EditProfileModalProps {
    user: User;
    onClose: () => void;
    onSave: (data: Partial<User>) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        fullName: user.fullName || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '' // [NUEVO]
    });
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocalización no soportada en este navegador');
            return;
        }
        setDetecting(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                const result = await reverseGeocode(latitude, longitude);
                // reverseGeocode returns { address, city }
                if (result) {
                    setFormData(prev => ({
                        ...prev,
                        city: result.city || prev.city,
                        // Optionally update address too if empty? Users might like that.
                        // Let's only update city as requested, or both if convenient.
                        // The user requested "obtain it automatic", let's update both for better UX if address is empty?
                        // Or just city. The request said "field of city... automatic".
                        // Use result.city.
                    }));
                }
            } catch (err) {
                logger.error(err);
            } finally {
                setDetecting(false);
            }
        }, () => setDetecting(false));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            logger.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserIcon size={24} className="text-emerald-100" />
                        Editar Perfil
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Nombre Completo
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-gray-900"
                                placeholder="Tu nombre completo"
                                required
                            />
                        </div>
                    </div>

                    {/* Email (Read only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Correo Electrónico
                        </label>
                        <div className="relative opacity-75">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="email"
                                value={user.email}
                                disabled
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 bg-gray-50 rounded-xl text-gray-500 cursor-not-allowed"
                            />
                            <span className="absolute right-3 top-3 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">No editable</span>
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Teléfono
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Phone size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-gray-900"
                                placeholder="Tu número de teléfono"
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Dirección
                        </label>
                        <div className="relative">
                            <div className="absolute top-3 left-3 pointer-events-none">
                                <MapPin size={18} className="text-gray-400" />
                            </div>
                            <textarea
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-gray-900 resize-none"
                                placeholder="Tu dirección completa"
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* City */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-gray-700">
                                Ciudad
                            </label>
                            <button
                                type="button"
                                onClick={handleDetectLocation}
                                disabled={detecting}
                                className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {detecting ? <Loader2 size={12} className="animate-spin" /> : <Crosshair size={12} />}
                                {detecting ? 'Detectando...' : 'Detectar Ubicación'}
                            </button>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MapPin size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-gray-900"
                                placeholder="Tu ciudad (ej. Bogotá)"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                        <Button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                            isLoading={saving}
                        >
                            <Save size={18} />
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
