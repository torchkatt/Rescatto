import React from 'react';
import { Venue } from '../../types';
import { MapPin, Clock, Phone, Star, Building2 } from 'lucide-react';

interface VenueInfoCardProps {
    venue: Venue;
}

export const VenueInfoCard: React.FC<VenueInfoCardProps> = ({ venue }) => {
    // Determine status (mock logic for now, or based on closingTime)
    const isOpen = () => {
        if (!venue.closingTime) return false;
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return currentTime < venue.closingTime;
    };

    const open = isOpen();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
            {/* Cover Image */}
            <div className="h-32 bg-gray-100 relative overflow-hidden">
                {venue.imageUrl ? (
                    <img
                        src={venue.imageUrl}
                        alt={venue.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                        <Building2 size={40} />
                    </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${open ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
                    }`}>
                    {open ? 'Abierto' : 'Cerrado'}
                </div>
            </div>

            {/* Content */}
            <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{venue.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                            {venue.businessType || 'Comercio'}
                            {venue.rating > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-0.5 text-amber-500">
                                        <Star size={10} fill="currentColor" /> {venue.rating}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    {venue.logoUrl && (
                        <div className="w-10 h-10 rounded-lg border border-gray-100 shadow-sm overflow-hidden flex-shrink-0 bg-white">
                            <img src={venue.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>

                <div className="space-y-2 mt-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{venue.address}</span>
                    </div>

                    {venue.closingTime && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock size={16} className="text-gray-400 flex-shrink-0" />
                            <span>Cierra a las {venue.closingTime}</span>
                        </div>
                    )}

                    {venue.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone size={16} className="text-gray-400 flex-shrink-0" />
                            <span>{venue.phone}</span>
                        </div>
                    )}
                </div>

                {/* Categories / Tags */}
                {venue.categories && venue.categories.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        {venue.categories.slice(0, 3).map((cat, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-medium rounded-md border border-gray-100 uppercase tracking-wider">
                                {cat}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
