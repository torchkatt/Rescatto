import React from 'react';
import { Logo } from '../../common/Logo';

export const LoadingSpinner: React.FC<{
    size?: 'xs' | 'sm' | 'md' | 'lg',
    color?: string,
    fullPage?: boolean,
    className?: string
}> = ({ size = 'md', color, fullPage = false, className = '' }) => {
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
        <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
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
            <div role="status" aria-live="polite" aria-busy="true" className="flex-1 flex items-center justify-center min-h-[60vh] w-full">
                {spinner}
                <span className="sr-only">Cargando...</span>
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

// ─── Home skeleton ────────────────────────────────────────────────────────────

const CategorySkeleton = () => (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-6">
        {[1, 2, 3, 4, 5].map(i => (
            <Bone key={i} className="px-10 py-5 rounded-full whitespace-nowrap" />
        ))}
    </div>
);

const DealCardSkeleton = () => (
    <div className="w-[280px] shrink-0 bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <Bone className="w-full h-40 rounded-none" />
        <div className="p-5 space-y-3">
            <Bone className="w-3/4 h-5 rounded-full" />
            <div className="flex justify-between items-center">
                <Bone className="w-20 h-6 rounded-full" />
                <Bone className="w-10 h-5 rounded-full" />
            </div>
            <Bone className="w-1/2 h-3 rounded-full" />
        </div>
    </div>
);

const ListItemSkeleton = () => (
    <div className="flex items-center gap-4 bg-white p-3 rounded-[1.5rem] border border-gray-100 shadow-sm">
        <Bone className="w-24 h-24 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-3">
            <Bone className="w-3/4 h-5 rounded-full" />
            <Bone className="w-1/2 h-3 rounded-full" />
            <div className="flex justify-between items-center">
                <Bone className="w-20 h-6 rounded-full" />
                <Bone className="w-12 h-6 rounded-full" />
            </div>
        </div>
    </div>
);

export const HomeSkeletonLoader: React.FC = () => (
    <div className="pb-32 bg-white min-h-screen">
        {/* Premium Header Skeleton */}
        <header className="px-6 pt-8 pb-4 bg-white">
            <div className="flex items-center justify-between mb-6">
                <Bone className="w-40 h-10 rounded-full" />
                <Bone className="w-11 h-11 rounded-full" />
            </div>

            <div className="mb-6 space-y-2">
                <Bone className="w-48 h-10 rounded-full" />
                <Bone className="w-64 h-6 rounded-full" />
            </div>
        </header>

        {/* Categories Bar Skeleton */}
        <CategorySkeleton />

        <div className="space-y-10 mt-6">
            {/* Featured Deals Section */}
            <div>
                <div className="px-6 flex items-center justify-between mb-5">
                    <Bone className="w-44 h-8 rounded-full" />
                    <Bone className="w-16 h-4 rounded-full" />
                </div>
                <div className="flex gap-6 overflow-x-auto no-scrollbar px-6 pb-6">
                    {[1, 2, 3].map(i => <DealCardSkeleton key={i} />)}
                </div>
            </div>

            {/* Ending Soon Section */}
            <div className="px-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <Bone className="w-8 h-8 rounded-lg" />
                        <Bone className="w-36 h-8 rounded-full" />
                        <Bone className="w-16 h-5 rounded-md" />
                    </div>
                    <Bone className="w-16 h-4 rounded-full" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <ListItemSkeleton key={i} />)}
                </div>
            </div>

            {/* All Places Grid Header */}
            <div className="px-6">
                <Bone className="w-32 h-8 rounded-full mb-5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                            <Bone className="w-full h-48 rounded-none" />
                            <div className="p-4 space-y-3">
                                <Bone className="w-3/4 h-5 rounded-full" />
                                <Bone className="w-1/2 h-3.5 rounded-full" />
                                <div className="flex gap-2">
                                    <Bone className="w-20 h-6 rounded-full" />
                                    <Bone className="w-24 h-6 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
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
        <div role="status" aria-live="polite" aria-busy="true" className="min-h-screen flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm fixed inset-0 z-[9999]">
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
