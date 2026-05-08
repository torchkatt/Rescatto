import React from 'react';
import { X, Share, MoreVertical, Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PWANotificationProps {
    onClose: () => void;
}

export const PWANotification: React.FC<PWANotificationProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Notification Card */}
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500">
                {/* Accent Top Bar */}
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-emerald-50 p-3 rounded-2xl">
                            <Smartphone className="text-emerald-600" size={32} />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900 leading-tight">
                            {t('pwa_install_title')} <br />
                            <span className="text-emerald-600">{t('pwa_install_subtitle')}</span>
                        </h3>

                        <p className="text-slate-600 text-sm leading-relaxed">
                            {t('pwa_install_desc')}
                        </p>

                        {/* Instructions Box */}
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('pwa_instructions')}</p>

                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                    {isIOS ? <Share size={16} className="text-blue-500" /> : <MoreVertical size={16} className="text-slate-600" />}
                                </div>
                                <p className="text-sm text-slate-700 font-medium">
                                    {isIOS
                                        ? t('pwa_ios_share')
                                        : t('pwa_android_menu')}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                    <Download size={16} className="text-emerald-500" />
                                </div>
                                <p className="text-sm text-slate-700 font-medium">
                                    {t('pwa_add_home').split('"').map((text, i) => (
                                        i === 1 ? <span key={i} className="text-emerald-600 font-bold">&ldquo;{text}&rdquo;</span> : text
                                    ))}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onClose}
                        className="mt-8 w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                        <CheckCircle2 size={20} />
                        {t('pwa_understood')}
                    </button>
                </div>
            </div>
        </div>
    );
};
