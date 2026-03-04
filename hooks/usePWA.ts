import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';

export const usePWA = () => {
    const { showToast } = useToast();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
            logger.log("PWA Install Prompt captured");
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        const checkInstall = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                || (window.navigator as any).standalone
                || document.referrer.includes('android-app://');

            setIsInstalled(Boolean(isStandalone));

            // If installed, it shouldn't be "installable" via prompt usually
            if (isStandalone) {
                setIsInstallable(false);
            }
        };

        checkInstall();

        // Detect when it gets installed
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
            setShowInstructions(false);
            showToast('success', '¡App instalada correctamente!');
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, [showToast]);

    const installApp = async () => {
        if (!deferredPrompt) {
            if (isInstalled) {
                // If already installed, user might want to refresh or check update
                window.location.reload();
                return;
            }
            // Instead of just a toast, show the premium instructions
            setShowInstructions(true);
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsInstallable(false);
            setIsInstalled(true);
            setShowInstructions(false);
        }
    };

    return { isInstallable, isInstalled, installApp, showInstructions, setShowInstructions };
};
