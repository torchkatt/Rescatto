import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface CountdownProps {
    targetTime: string; // ISO string
    onExpire?: () => void;
    variant?: 'normal' | 'warning' | 'critical';
    showIcon?: boolean;
}

export const Countdown: React.FC<CountdownProps> = ({
    targetTime,
    onExpire,
    variant = 'normal',
    showIcon = true
}) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [autoVariant, setAutoVariant] = useState<'normal' | 'warning' | 'critical'>(variant);
    // Ref para evitar que onExpire inline recree el intervalo en cada render
    const onExpireRef = useRef(onExpire);
    useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const target = new Date(targetTime).getTime();
            const now = new Date().getTime();
            const difference = target - now;

            if (difference <= 0) {
                setTimeLeft('Expirado');
                onExpireRef.current?.();
                return;
            }

            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            // Auto-adjust variant based on time remaining
            if (difference <= 5 * 60 * 1000) { // Less than 5 minutes
                setAutoVariant('critical');
            } else if (difference <= 15 * 60 * 1000) { // Less than 15 minutes
                setAutoVariant('warning');
            } else {
                setAutoVariant('normal');
            }

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m`);
            } else if (minutes > 0) {
                setTimeLeft(`${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${seconds}s`);
            }
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetTime]); // onExpire excluido intencionalmente — se accede via ref para evitar loop

    const variantClasses = {
        normal: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        warning: 'bg-orange-100 text-orange-700 border-orange-300',
        critical: 'bg-red-100 text-red-700 border-red-300 animate-pulse',
    };

    const currentVariant = variant === 'normal' ? autoVariant : variant;

    if (timeLeft === 'Expirado') {
        return (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium border border-gray-300">
                <AlertCircle size={12} />
                <span>No disponible</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${variantClasses[currentVariant]}`}>
            {showIcon && <Clock size={12} />}
            <span>{timeLeft}</span>
        </div>
    );
};

export default Countdown;
