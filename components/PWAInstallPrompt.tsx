import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Check if app is already installed
            if (!window.matchMedia('(display-mode: standalone)').matches) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] p-5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-xl border-2 border-white/50 rounded-2xl shadow-emerald-200/50 shadow-2xl z-50 animate-in slide-in-from-bottom-10 md:slide-in-from-right-4 duration-500 transform hover:scale-[1.02] transition-all">
            {/* Inner gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-10 rounded-2xl pointer-events-none"></div>

            <div className="flex flex-col gap-4 relative z-10">
                <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-white/90 rounded-xl flex items-center justify-center shadow-lg text-emerald-600">
                            <span className="text-2xl animate-bounce">🚀</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900 text-lg leading-tight">Instala la App Pro</h3>
                            <p className="text-sm text-emerald-800/80 font-medium leading-snug">
                                Acceso instantáneo y mejor rendimiento en tu escritorio.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsVisible(false)} className="p-1.5 hover:bg-white/50 rounded-lg transition-all text-emerald-800/50 hover:text-emerald-900 hover:rotate-90">
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="flex gap-3 mt-1">
                    <button
                        onClick={handleInstallClick}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all active:scale-95 group"
                    >
                        <Download size={16} strokeWidth={3} className="group-hover:animate-bounce" />
                        INSTALAR AHORA
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="px-5 py-3 bg-white/50 hover:bg-white/80 text-emerald-700 rounded-xl text-xs font-black transition-all active:scale-95"
                    >
                        PUDO SER LUEGO
                    </button>
                </div>
            </div>
        </div>
    );
};
