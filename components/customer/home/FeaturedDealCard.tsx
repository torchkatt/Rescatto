import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Venue, RatingStats } from '../../../types';
import { Star, Heart, Clock, ShoppingCart, MapPin, ChevronRight } from 'lucide-react';
import { useFavorites } from '../../../hooks/useFavorites';
import { calculateDistance } from '../../../services/locationService';

interface FeaturedDealCardProps {
    venue: Venue;
    productName?: string;
    discount?: number;
    originalPrice?: number;
    currentPrice?: number;
    expiryTime?: string; // ISO
    boughtToday?: number;
    userLocation?: { lat: number; lng: number };
    ratingStats?: RatingStats | null;
}

export const FeaturedDealCard: React.FC<FeaturedDealCardProps> = ({
    venue,
    productName = "Pack Sorpresa Premium",
    discount = 50,
    originalPrice = 90,
    currentPrice = 45,
    expiryTime,
    boughtToday = 12,
    userLocation,
    ratingStats
}) => {
    const navigate = useNavigate();
    const { isFavorite, toggleFavorite } = useFavorites();
    const isFav = isFavorite(venue.id);

    const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
        : null;

    const formattedDistance = distance !== null 
        ? (distance < 1 ? '0.5 km' : `${distance.toFixed(1)} km`)
        : '0.8 km';

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavorite(venue.id);
    };

    const handleClick = () => {
        navigate(`/app/venue/${venue.id}`);
    };

    return (
        <div 
            onClick={handleClick}
            className="relative flex-shrink-0 w-[280px] sm:w-[320px] bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-gray-200/50 border border-gray-100 cursor-pointer active:scale-[0.98] transition-all group"
        >
            {/* Top Image Section */}
            <div className="relative h-48 sm:h-56">
                <img 
                    src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/600`} 
                    alt={venue.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Badges Overlay */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-500/30">
                        -{discount}%
                    </span>
                </div>

                <button 
                    onClick={handleFavoriteClick}
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white hover:text-red-500 transition-all shadow-lg active:scale-90"
                >
                    <Heart size={20} className={isFav ? 'fill-current text-red-500' : ''} />
                </button>

                {/* Info Text on Image */}
                <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-black text-xl sm:text-2xl drop-shadow-md leading-tight">
                        {venue.name}
                    </h3>
                    <p className="text-white/90 text-sm font-medium line-clamp-1 mt-1">
                        {productName}
                    </p>
                </div>
            </div>

            {/* Bottom Info Section */}
            <div className="p-5 flex flex-col gap-4">
                {/* Stats Row */}
                <div className="flex items-center justify-between text-gray-500">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Star size={18} className="text-amber-400 fill-current" />
                            <span className="text-sm font-black text-gray-900">
                                {ratingStats?.averageRating?.toFixed(1) || '4.8'}
                            </span>
                            <span className="text-[11px] font-bold text-gray-400">
                                ({ratingStats?.totalRatings || '120'})
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MapPin size={16} className="text-emerald-500" />
                            <span className="text-sm font-bold text-gray-700">{formattedDistance}</span>
                        </div>
                    </div>
                </div>

                {/* Price & Action Row */}
                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-900">
                            ${currentPrice.toLocaleString('es-CO')}
                        </span>
                        <span className="text-sm font-bold text-gray-400 line-through">
                            ${originalPrice.toLocaleString('es-CO')}
                        </span>
                    </div>
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        Get Deal
                    </button>
                </div>

                {/* Urgency & Proof Row */}
                <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-2 rounded-xl border border-red-100">
                        <Clock size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Ends in 2 hours</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl border border-gray-200">
                        <ShoppingCart size={14} />
                        <span className="text-[10px] font-black uppercase tracking-tight">{boughtToday} bought today</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
