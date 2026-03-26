import React, { useState } from 'react';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { Bell, BellOff, X, Zap, Star, Clock } from 'lucide-react';
import { messagingService } from '../../../services/messagingService';
import { logger } from '../../../utils/logger';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'rescatto_notif_asked';

export const hasAskedForNotifications = () =>
    localStorage.getItem(STORAGE_KEY) !== null;

interface Props {
    userId: string;
    onClose: () => void;
}

export const NotificationPermissionModal: React.FC<Props> = ({ userId, onClose }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    useEscapeKey(onClose);

    const handleAllow = async () => {
        setLoading(true);
        try {
            await messagingService.requestPermissionAndSaveToken(userId);
            localStorage.setItem(STORAGE_KEY, 'granted');
        } catch (err) {
            logger.error('NotificationPermissionModal: error requesting permission', err);
            localStorage.setItem(STORAGE_KEY, 'error');
        } finally {
            setLoading(false);
            onClose();
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'dismissed');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDismiss} />

            {/* Sheet */}
            <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
                {/* Dismiss */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-10"
                >
                    <X size={18} className="text-gray-400" />
                </button>

                {/* Header gradient */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 flex flex-col items-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                        <Bell size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-black text-center">{t('perm_title')}</h2>
                    <p className="text-emerald-100 text-sm text-center mt-1">
                        {t('perm_subtitle')}
                    </p>
                </div>

                {/* Benefits */}
                <div className="p-6 space-y-3">
                    <Benefit icon={<Zap size={16} className="text-yellow-500" />} text={t('perm_benefit_1')} />
                    <Benefit icon={<Clock size={16} className="text-orange-500" />} text={t('perm_benefit_2')} />
                    <Benefit icon={<Star size={16} className="text-purple-500" />} text={t('perm_benefit_3')} />
                </div>

                {/* Mock notification preview */}
                <div className="mx-6 mb-5 bg-gray-100 rounded-2xl p-3 flex items-start gap-3">
                    <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-lg">🍱</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-800">Rescatto · {t('perm_now')}</p>
                        <p className="text-xs text-gray-600">{t('perm_mock_body')}</p>
                    </div>
                </div>

                {/* CTA buttons */}
                <div className="px-6 pb-8 space-y-2">
                    <button
                        onClick={handleAllow}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                    >
                        <Bell size={18} />
                        {loading ? t('perm_btn_activating') : t('perm_btn_allow')}
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="w-full text-gray-400 font-medium py-2 rounded-2xl hover:text-gray-600 transition-colors text-sm flex items-center justify-center gap-1"
                    >
                        <BellOff size={14} />
                        {t('perm_btn_dismiss')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Benefit: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
    <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {icon}
        </div>
        <p className="text-sm text-gray-700">{text}</p>
    </div>
);
