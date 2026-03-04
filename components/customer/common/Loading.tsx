import React from 'react';
import { Logo } from '../../common/Logo';

export const LoadingSpinner: React.FC<{
    size?: 'xs' | 'sm' | 'md' | 'lg',
    color?: string,
    fullPage?: boolean
}> = ({ size = 'md', color, fullPage = false }) => {
    const sizes = {
        xs: 'w-4 h-4',
        sm: 'w-6 h-6',
        md: 'w-12 h-12',
        lg: 'w-20 h-20',
    };

    const iconSizes = {
        xs: 8,
        sm: 12,
        md: 24,
        lg: 40,
    };

    const spinner = (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative flex items-center justify-center">
                {/* External spinning ring */}
                <div className={`${sizes[size]} border-y-2 border-emerald-500 rounded-full animate-spin`}></div>

                {/* Middle pulsing ring */}
                <div className={`absolute ${sizes[size]} border-x-2 border-emerald-300/30 rounded-full animate-pulse blur-[1px]`}></div>

                {/* Central Logo */}
                <div className="absolute animate-pulse">
                    <Logo
                        size={size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm'}
                        iconColor={color}
                        className="shadow-none border-none bg-transparent"
                    />
                </div>
            </div>
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh] w-full">
                {spinner}
            </div>
        );
    }

    return spinner;
};

// ─── Skeleton primitives ──────────────────────────────────────────────────────

const Bone: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-gray-200 animate-pulse rounded-xl ${className}`} />
);

// ─── Home skeleton ────────────────────────────────────────────────────────────

export const HomeSkeletonLoader: React.FC = () => (
    <div className="pb-20 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Bone className="w-9 h-9 rounded-full" />
                <div className="space-y-1.5">
                    <Bone className="w-20 h-2.5 rounded-full" />
                    <Bone className="w-32 h-3.5 rounded-full" />
                </div>
            </div>
            <Bone className="w-9 h-9 rounded-full" />
        </div>

        <div className="px-4 space-y-6 pt-4">
            {/* Search bar */}
            <Bone className="w-full h-11 rounded-2xl" />
            {/* Flash deals banner */}
            <Bone className="w-full h-20 rounded-2xl" />
            {/* Section header */}
            <div className="flex items-center gap-2">
                <Bone className="w-5 h-5 rounded-md" />
                <Bone className="w-32 h-4 rounded-full" />
            </div>
            {/* Venue cards */}
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <Bone className="w-full h-44 rounded-none" />
                    <div className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <Bone className="w-2/3 h-5 rounded-full" />
                            <Bone className="w-12 h-5 rounded-full" />
                        </div>
                        <Bone className="w-1/2 h-3.5 rounded-full" />
                        <div className="flex gap-2 pt-1">
                            <Bone className="w-16 h-6 rounded-full" />
                            <Bone className="w-20 h-6 rounded-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ─── VenueDetail skeleton ─────────────────────────────────────────────────────

export const VenueDetailSkeletonLoader: React.FC = () => (
    <div className="pb-24 bg-gray-50 min-h-screen">
        {/* Hero image */}
        <Bone className="w-full h-56 rounded-none" />
        <div className="px-4 -mt-6 relative z-10 space-y-5">
            {/* Venue info card */}
            <div className="bg-white rounded-3xl shadow-sm p-4 space-y-3">
                <Bone className="w-3/4 h-6 rounded-full" />
                <Bone className="w-1/2 h-4 rounded-full" />
                <div className="flex gap-2">
                    <Bone className="w-20 h-6 rounded-full" />
                    <Bone className="w-24 h-6 rounded-full" />
                </div>
            </div>
            {/* Section header */}
            <div className="flex items-center gap-2">
                <Bone className="w-5 h-5 rounded-md" />
                <Bone className="w-28 h-4 rounded-full" />
            </div>
            {/* Product cards */}
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex overflow-hidden h-28">
                    <Bone className="w-28 h-full flex-shrink-0 rounded-none" />
                    <div className="flex-1 p-3 space-y-2">
                        <Bone className="w-3/4 h-4 rounded-full" />
                        <Bone className="w-1/2 h-3 rounded-full" />
                        <div className="flex gap-2 mt-2">
                            <Bone className="w-16 h-5 rounded-full" />
                            <Bone className="w-12 h-5 rounded-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Cargando...' }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm fixed inset-0 z-[9999]">
            <div className="relative mb-8">
                {/* Decorative background glow */}
                <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full scale-150"></div>

                <LoadingSpinner size="lg" />
            </div>

            <div className="flex flex-col items-center gap-2">
                <span className="text-xl font-bold text-gray-800 tracking-tight">Rescatto</span>
                <div className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce"></span>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest ml-1">{message}</p>
                </div>
            </div>
        </div>
    );
};
