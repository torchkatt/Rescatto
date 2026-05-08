import React from 'react';
import { Venue } from '../../types';
import { MapPin, Star, Clock, Heart, Navigation, Phone } from 'lucide-react';

interface VenueMobilePreviewProps {
    venue: Venue;
}

export const VenueMobilePreview: React.FC<VenueMobilePreviewProps> = ({ venue }) => {
    // Colors
    const brandColor = venue.brandColor || '#10b981'; // Emerald-500 default

    return (
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden font-sans border border-gray-100 max-w-[320px] mx-auto select-none relative">
            {/* Mobile Status Bar Simulation */}
            <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center text-[10px] font-medium z-20 relative">
                <span>9:41</span>
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-white opacity-20"></div>
                    <div className="w-3 h-3 rounded-full bg-white opacity-20"></div>
                    <div className="w-4 h-3 rounded-[2px] border border-white opacity-40 relative">
                        <div className="absolute inset-0.5 bg-white"></div>
                    </div>
                </div>
            </div>

            {/* App Overlay Buttons */}
            <div className="absolute top-10 left-4 z-20">
                <div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm text-gray-900">
                    <Navigation size={16} className="rotate-180" />
                </div>
            </div>

            <div className="absolute top-10 right-4 z-20 flex gap-2">
                <div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm text-gray-900">
                    <Heart size={16} />
                </div>
            </div>


            {/* Header Image & Info */}
            <div className="relative h-56 w-full">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                <img
                    src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/600`}
                    alt={venue.name}
                    className="w-full h-full object-cover"
                />

                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 text-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <div
                                className="text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block shadow-sm uppercase tracking-wide"
                                style={{ backgroundColor: brandColor }}
                            >
                                {venue.businessType || venue.categories?.[0] || 'Restaurante'}
                            </div>
                            <h3 className="font-bold text-2xl leading-tight shadow-black drop-shadow-md mb-1">{venue.name}</h3>
                            <p className="text-gray-200 text-xs flex items-center gap-1">
                                <MapPin size={12} /> {venue.address}
                                {venue.city && <span>• {venue.city}</span>}
                            </p>
                        </div>

                        {/* Logo in Header */}
                        {venue.logoUrl && (
                            <div className="w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white shrink-0">
                                <img src={venue.logoUrl} alt="Logo" loading="lazy" className="w-full h-full object-cover" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Section */}
            <div className="px-5 py-4 space-y-4">

                {/* Stats Row */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-1.5">
                        <Star size={18} className="text-yellow-400 fill-current" />
                        <span className="font-bold text-gray-900">4.8</span>
                        <span className="text-xs text-gray-400">(120+)</span>
                    </div>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock size={16} />
                        <span className="text-xs font-medium">{venue.closingTime}</span>
                    </div>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <div className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                        Abierto
                    </div>
                </div>

                {/* Offer Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-gray-900 text-sm">Ofertas del Día</h4>
                        <span className="text-xs text-gray-400 font-medium">Ver todo</span>
                    </div>

                    <div className="border border-gray-100 rounded-xl p-3 flex gap-3 items-center bg-gray-50/50 hover:bg-white transition-colors shadow-sm">
                        <div className="w-14 h-14 bg-gray-200 rounded-lg shrink-0 overflow-hidden">
                            <img src={`https://picsum.photos/seed/${venue.id}food/200`} className="w-full h-full object-cover" loading="lazy" alt="food" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-gray-800 text-xs truncate">Pack Sorpresa Mediano</h5>
                            <p className="text-[10px] text-gray-500 truncate">3-4 items variados</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="font-bold text-gray-900 text-sm">$12.000</span>
                                <span className="text-xs text-gray-400 line-through">$24.000</span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: brandColor }}>
                            +
                        </div>
                    </div>

                    {venue.phone && (
                        <div className="flex gap-2 text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded-lg justify-center items-center">
                            <Phone size={12} />
                            <span>Contacto: {venue.phone}</span>
                        </div>
                    )}

                </div>

                <button
                    className="w-full text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200/50 text-sm mt-2 active:scale-95 transition-transform"
                    style={{ backgroundColor: brandColor }}
                >
                    Reservar Pack
                </button>
            </div>

            {/* Bottom Nav Simulation */}
            <div className="border-t border-gray-100 p-3 flex justify-around items-center">
                <div className="flex flex-col items-center gap-1 text-gray-400">
                    <div className="w-5 h-5 rounded bg-gray-200"></div>
                </div>
                <div className="flex flex-col items-center gap-1" style={{ color: brandColor }}>
                    <div className="w-5 h-5 rounded bg-current opacity-20"></div>
                </div>
                <div className="flex flex-col items-center gap-1 text-gray-400">
                    <div className="w-5 h-5 rounded bg-gray-200"></div>
                </div>
            </div>
        </div>
    );
};
