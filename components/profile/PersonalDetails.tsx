import React, { useState } from 'react';
import { User } from '../../types';
import { User as UserIcon, Mail, Phone, MapPin, Save, X } from 'lucide-react';
import { Button } from '../customer/common/Button';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { PhoneInput } from '../customer/common/PhoneInput';

interface PersonalDetailsProps {
    user: User;
    onSave: (data: Partial<User>) => Promise<void>;
}

export const PersonalDetails: React.FC<PersonalDetailsProps> = ({ user, onSave }) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: user.fullName || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            setIsEditing(false);
        } catch (error) {
            logger.error('Error saving profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            fullName: user.fullName || '',
            phone: user.phone || '',
            address: user.address || '',
            city: user.city || '',
        });
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{t('prof_personal_info')}</h2>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-emerald-600 hover:text-emerald-700 text-base font-bold px-4 py-3 rounded-xl transition-all border border-gray-100 hover:border-emerald-100 active:scale-95"
                    >
                        {t('prof_edit')}
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <UserIcon size={16} className="text-gray-400" />
                            {t('login_fullname')}
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base outline-none font-medium"
                            />
                        ) : (
                            <div className="bg-gray-50 px-4 py-2 rounded-lg text-gray-800 border border-gray-100 min-h-[42px] flex items-center">
                                {user.fullName}
                            </div>
                        )}
                    </div>

                    {/* Email (Read Only) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Mail size={16} className="text-gray-400" />
                            {t('login_email')}
                        </label>
                        <div className="bg-gray-50 px-4 py-2 rounded-lg text-gray-500 border border-gray-100 min-h-[42px] flex items-center justify-between">
                            <span>{user.email}</span>
                            <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-medium">{t('prof_blocked')}</span>
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Phone size={16} className="text-gray-400" />
                            {t('prof_phone')}
                        </label>
                        {isEditing ? (
                            <PhoneInput
                                value={formData.phone}
                                onChange={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                                placeholder="+57 300 123 4567"
                            />
                        ) : (
                            <div className={`bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 min-h-[42px] flex items-center ${!user.phone ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                                {user.phone || t('prof_unspecified')}
                            </div>
                        )}
                    </div>

                    {/* City */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400" />
                            {t('prof_city')}
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="Ej. Bogotá"
                                className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base outline-none font-medium"
                            />
                        ) : (
                            <div className={`bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 min-h-[42px] flex items-center ${!user.city ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                                {user.city || t('prof_unspecified')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Address (Full Width) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" />
                        {t('prof_address_full')}
                    </label>
                    {isEditing ? (
                        <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Calle 123 #45-67, Barrio..."
                            className="w-full px-4 py-3 border border-gray-100 bg-gray-50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-base outline-none font-medium resize-none"
                        />
                    ) : (
                        <div className={`bg-gray-50 px-4 py-3 rounded-lg border border-gray-100 min-h-[80px] ${!user.address ? 'text-gray-400 italic flex items-center' : 'text-gray-800'}`}>
                            {user.address || t('prof_unspecified')}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {isEditing && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCancel}
                            disabled={loading}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                        >
                            {t('prof_cancel')}
                        </Button>
                        <Button
                            type="submit"
                            isLoading={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                        >
                            {t('prof_save_changes')}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
};
