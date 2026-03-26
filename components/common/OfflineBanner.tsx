import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[var(--z-toast,60)] bg-gray-900 text-white text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-lg">
            <WifiOff size={16} className="flex-shrink-0" />
            <span>Sin conexión — los cambios se guardarán cuando vuelvas a estar en línea</span>
        </div>
    );
};
