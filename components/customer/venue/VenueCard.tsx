import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Venue, RatingStats } from '../../../types';
import { Card } from '../common/Card';
import { Star, Heart, Flame, TrendingUp, Zap } from 'lucide-react';
import { getRatingStats } from '../../../services/ratingService';
import { Countdown } from '../common/Countdown';
import { calculateDistance } from '../../../services/locationService';
import { useFavorites } from '../../../hooks/useFavorites';

interface VenueCardProps {
    venue: Venue;
    userLocation?: { lat: number; lng: number };
    soonestExpiry?: string; // ISO — soonest product expiry within 3h for this venue
    totalStock?: number;    // Total units available across all products
    isTrending?: boolean;   // Venue has many orders recently
    hasDynamicPricing?: boolean; // At least one product has active dynamic (dropping) price
    onClick?: (venue: Venue) => void;
}

// ── Deal Score: 0-100 combining discount + stock urgency + time urgency ────────
function computeDealScore(venue: Venue, soonestExpiry?: string, totalStock?: number): number {
    let score = 0;

    // Stock urgency: low stock = higher score
    if (totalStock !== undefined) {
        if (totalStock <= 2) score += 40;
        else if (totalStock <= 5) score += 25;
        else if (totalStock <= 10) score += 10;
    }

    // Time urgency: expiring soon = higher score
    if (soonestExpiry) {
        const msLeft = new Date(soonestExpiry).getTime() - Date.now();
        const hoursLeft = msLeft / (1000 * 60 * 60);
        if (hoursLeft <= 1) score += 45;
        else if (hoursLeft <= 2) score += 30;
        else if (hoursLeft <= 4) score += 15;
    }

    // Rating boost
    if (venue.rating >= 4.5) score += 15;
    else if (venue.rating >= 4.0) score += 8;

    return Math.min(100, score);
}

export const VenueCard: React.FC<VenueCardProps> = ({
    venue, userLocation, soonestExpiry, totalStock, isTrending, hasDynamicPricing, onClick
}) => {
    const navigate = useNavigate();
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
    const { isFavorite, toggleFavorite } = useFavorites();
    const isFav = isFavorite(venue.id);

    const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
        : null;

    const dealScore = computeDealScore(venue, soonestExpiry, totalStock);
    const isHotDeal = dealScore >= 60;
    const isLowStock = totalStock !== undefined && totalStock <= 3;

    useEffect(() => {
        getRatingStats(venue.id, 'venue').then(stats => {
            setRatingStats(stats);
        });
    }, [venue.id]);

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavorite(venue.id);
    };

    const handleClick = () => {
        if (onClick) onClick(venue);
        else navigate(`/app/venue/${venue.id}`);
    };

    const isOpen = () => {
        if (!venue.closingTime) return true;
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const [closingHours, closingMinutes] = venue.closingTime.split(':').map(Number);

        if (currentHours < closingHours) return true;
        if (currentHours === closingHours && currentMinutes < closingMinutes) return true;
        return false;
    };

    const openStatus = isOpen();

    return (
        <Card
            className="group relative flex flex-col h-full transition-all duration-300 transform hover:!scale-105 hover:!shadow-2xl hover:z-10 border border-transparent hover:border-emerald-500/30 overflow-hidden"
            onClick={handleClick}
        >
            <div className="relative h-48 -mx-4 -mt-4 mb-4 overflow-hidden">
                {/* Image Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />

                {/* Favorite Button Overlay */}
                <button
                    onClick={handleFavoriteClick}
                    className={`absolute top-2 right-2 z-20 p-2 rounded-full shadow-md transition-all active:scale-90 ${isFav ? 'bg-white text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                        }`}
                >
                    <Heart
                        size={18}
                        className={`transition-all duration-300 ${isFav ? 'fill-current scale-110' : ''}`}
                    />
                </button>

                {/* Trending Badge — top right corner */}
                {isTrending && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-black shadow-lg animate-pulse">
                        <Flame size={11} />
                        Trending
                    </div>
                )}

                {/* Hot Deal badge — shown when dealScore is high but not trending */}
                {isHotDeal && !isTrending && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-black shadow-lg">
                        <Zap size={11} />
                        ¡Oferta hot!
                    </div>
                )}

                <img
                    src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/600`}
                    alt={venue.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                />

                {/* Distance Badge — shifts down when urgency countdown is shown */}
                {distance !== null && (
                    <div className={`absolute ${soonestExpiry ? 'top-10' : (isTrending || isHotDeal) ? 'top-10' : 'top-2'} left-2 z-20 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1 transition-all`}>
                        <span className="text-emerald-600">📍</span> {distance} km
                    </div>
                )}

                {/* Urgency countdown — shown only when a product expires within 3h */}
                {soonestExpiry && (
                    <div className="absolute top-2 left-2 z-20">
                        <Countdown targetTime={soonestExpiry} showIcon />
                    </div>
                )}

                {/* Low stock badge — bottom left */}
                {isLowStock && (
                    <div className="absolute bottom-10 left-2 z-20 bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md flex items-center gap-1">
                        🔥 ¡Solo {totalStock} disponibles!
                    </div>
                )}

                {/* Dynamic pricing badge — shown when at least 1 product has dropping price */}
                {hasDynamicPricing && !isLowStock && (
                    <div className="absolute bottom-10 left-2 z-20 bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md flex items-center gap-1 animate-pulse">
                        ⬇️ Precio bajando
                    </div>
                )}

                {/* Rating Badge (Bottom Left, shifts up if low stock) */}
                {(ratingStats?.averageRating ?? 0) > 0 && (
                    <div className={`absolute ${isLowStock ? 'bottom-6' : 'bottom-2'} left-2 z-20 flex items-center gap-1 text-white font-bold text-sm`}>
                        <Star size={16} className="text-yellow-400 fill-current" />
                        <span>{ratingStats?.averageRating.toFixed(1)}</span>
                        <span className="text-gray-300 text-xs font-normal">({ratingStats?.totalRatings})</span>
                    </div>
                )}

                {/* Logo Overlay (Bottom Right) */}
                {venue.logoUrl && (
                    <div className="absolute -bottom-4 right-4 z-20 w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white mb-6">
                        <img src={venue.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="mb-2">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">
                            {venue.name}
                        </h3>
                        {/* Deal score indicator */}
                        {dealScore >= 40 && (
                            <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-600">{dealScore}%</span>
                            </div>
                        )}
                    </div>
                    {(venue.businessType || (venue.categories && venue.categories.length > 0)) && (
                        <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mt-0.5">
                            {venue.businessType || venue.categories?.[0]}
                        </p>
                    )}
                </div>

                <div className="text-sm text-gray-500 mb-3 space-y-1">
                    <p className="flex items-center gap-1 truncate">
                        <span className="text-gray-400">📍</span>
                        {venue.address}
                        {venue.city && <span className="text-gray-400">• {venue.city}</span>}
                    </p>
                </div>

                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1.5 ${openStatus
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${openStatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {openStatus ? `Abierto • Cierra ${venue.closingTime}` : `Cerrado • Abre ${venue.closingTime}`}
                    </div>
                </div>
            </div>
        </Card>
    );
};
