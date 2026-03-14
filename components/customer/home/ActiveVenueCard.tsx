import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Venue } from '../../../types';
import { MapPin, Clock, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { calculateDistance } from '../../../services/locationService';

interface ActiveVenueCardProps {
    venue: Venue;
    productCount?: number;
    userLocation?: { lat: number; lng: number };
    isDesktop?: boolean;
}

export const ActiveVenueCard: React.FC<ActiveVenueCardProps> = ({ 
    venue, 
    productCount = 0, 
    userLocation,
    isDesktop
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const distance = userLocation 
        ? calculateDistance(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
        : null;

    if (isDesktop) {
        return (
            <div 
                onClick={() => navigate(`/app/venue/${venue.id}`)}
                className="w-full h-48 bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1 transition-all duration-500 cursor-pointer group flex gap-5 overflow-hidden"
            >
                {/* Image Section */}
                <div className="w-40 h-full rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 relative">
                    <img 
                        src={venue.imageUrl || venue.logoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'} 
                        alt={venue.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg">
                        <Clock size={12} className="text-emerald-400" />
                        {venue.closingTime}
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                        <div className="flex items-start justify-between mb-1.5">
                            <div className="min-w-0 flex-1">
                                <h3 className="font-black text-brand-dark text-xl leading-none group-hover:text-emerald-700 transition-colors truncate">
                                    {venue.name}
                                </h3>
                                <p className="text-xs text-gray-400 font-bold mt-1.5 truncate opacity-80">{venue.address}</p>
                            </div>
                            {distance !== null && (
                                <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 uppercase tracking-tighter whitespace-nowrap ml-2">
                                    {distance.toFixed(1)} km
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-accent-light text-brand-accent rounded-xl text-[10px] font-black border border-brand-accent/10">
                                <ShoppingBag size={14} />
                                <span>{t('products_available', { count: productCount })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                        <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/venue/${venue.id}`); }}
                            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black transition-all active:scale-[0.98] shadow-md shadow-emerald-700/10 flex items-center justify-center gap-2"
                        >
                            {t('view_products')}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/venue/${venue.id}`); }}
                            className="h-11 px-5 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 rounded-2xl text-[11px] font-black transition-all border border-gray-100 flex items-center justify-center"
                        >
                             {t('view_venue')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={() => navigate(`/app/venue/${venue.id}`)}
            className="flex-shrink-0 w-72 bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
            <div className="flex gap-4">
                {/* Image Container */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0 relative">
                    <img 
                        src={venue.imageUrl || venue.logoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'} 
                        alt={venue.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-lg text-[8px] font-black text-white flex items-center gap-1">
                        <Clock size={10} />
                        {venue.closingTime}
                    </div>
                </div>

                {/* Info Container */}
                <div className="flex flex-col justify-between py-1 min-w-0 flex-1">
                    <div>
                        <h3 className="font-black text-brand-dark text-base truncate leading-none mb-1.5">
                            {venue.name}
                        </h3>
                        
                        {distance !== null && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                <MapPin size={10} className="text-emerald-500" />
                                <span>{distance.toFixed(1)} km</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black border border-emerald-100">
                            <ShoppingBag size={12} />
                            <span>{t('products_available', { count: productCount })}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
