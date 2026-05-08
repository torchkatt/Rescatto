import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { logger } from '../utils/logger';

export const ReloadPrompt: React.FC = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            // Service worker registered successfully
        },
        onRegisterError(error) {
            logger.log('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 p-5 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl border-2 border-white/50 rounded-2xl shadow-blue-200/50 shadow-2xl w-auto max-w-md animate-in slide-in-from-right-4 duration-500 transform hover:scale-105 transition-all">
            {/* Inner gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-10 rounded-2xl pointer-events-none"></div>

            <div className="flex items-center gap-5 relative z-10">
                {/* Icon with white glow background */}
                <div className="flex-shrink-0 bg-white/90 p-2.5 rounded-xl shadow-lg text-blue-600">
                    <RefreshCw size={24} strokeWidth={2.5} className={needRefresh ? 'animate-spin-slow' : ''} />
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-blue-900 leading-tight mb-0.5">
                        {offlineReady ? '¡App Lista Offline!' : 'Mejora Disponible'}
                    </h3>
                    <p className="text-sm text-blue-800/80 font-medium leading-snug mb-3">
                        {offlineReady
                            ? 'Rescatto funcionará incluso sin internet.'
                            : 'Actualiza ahora para obtener las últimas funciones.'}
                    </p>

                    <div className="flex gap-2">
                        {needRefresh ? (
                            <button
                                onClick={() => updateServiceWorker(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-200 transition-all active:scale-95"
                            >
                                ACTUALIZAR AHORA
                            </button>
                        ) : null}
                        <button
                            onClick={close}
                            className={`px-4 py-2 ${needRefresh ? 'bg-white/50 hover:bg-white/80 text-blue-700' : 'bg-blue-600 text-white'} rounded-xl text-xs font-black transition-all active:scale-95`}
                        >
                            {needRefresh ? 'DESPUÉS' : '¡GENIAL!'}
                        </button>
                    </div>
                </div>

                <button
                    onClick={close}
                    className="p-1.5 hover:bg-white/50 rounded-lg transition-all text-blue-800/50 hover:text-blue-900 hover:rotate-90"
                >
                    <X size={18} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
};
