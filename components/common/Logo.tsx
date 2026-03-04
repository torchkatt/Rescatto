import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    showText?: boolean;
    textColor?: string;
    iconColor?: string;
}

export const Logo: React.FC<LogoProps> = ({
    size = 'md',
    className = '',
    showText = false,
    textColor = 'text-white',
    iconColor = '#059669' // emerald-600
}) => {
    const sizes = {
        sm: { container: 'w-8 h-8 rounded-lg', icon: 16 },
        md: { container: 'w-10 h-10 rounded-xl', icon: 20 },
        lg: { container: 'w-16 h-16 rounded-2xl', icon: 32 },
        xl: { container: 'w-24 h-24 rounded-3xl', icon: 48 },
    };

    const currentSize = sizes[size];

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div
                className={`${currentSize.container} bg-white shadow-lg border border-emerald-100 flex items-center justify-center flex-shrink-0`}
                style={{ color: iconColor }}
            >
                <UtensilsCrossed size={currentSize.icon} />
            </div>
            {showText && (
                <span className={`text-xl font-bold tracking-tight ${textColor}`}>
                    Rescatto
                </span>
            )}
        </div>
    );
};

export default Logo;
