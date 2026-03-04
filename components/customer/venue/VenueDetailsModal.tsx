import React, { useEffect, useState } from 'react';
import { X, Star, MapPin, Clock, Edit, Trash2 } from 'lucide-react';
import { Venue, RatingStats } from '../../../types';
import { getRatingStats } from '../../../services/ratingService';

import { calculateDistance } from '../../../services/locationService';
import { logger } from '../../../utils/logger';

interface VenueDetailsModalProps {
    venue: Venue;
    userLocation?: { lat: number; lng: number };
    onClose: () => void;
    onEdit?: (venue: Venue) => void;
    onDelete?: (venueId: string) => void;
}

export const VenueDetailsModal: React.FC<VenueDetailsModalProps> = ({ venue, userLocation, onClose, onEdit, onDelete }) => {
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);

    const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
        : null;

    useEffect(() => {
        getRatingStats(venue.id, 'venue').then(stats => {
            setRatingStats(stats);
        });

        // Disable body scroll when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [venue.id]);

    const handleEdit = () => {
        if (onEdit) {
            onEdit(venue);
            onClose();
        } else {
            logger.log(`Edit venue: ${venue.name} (${venue.id})`);
            // Fallback default behavior
        }
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(venue.id);
            onClose();
        } else {
            logger.log(`Delete venue: ${venue.name} (${venue.id})`);
            if (confirm(`¿Estás seguro de que deseas eliminar ${venue.name}?`)) {
                logger.log('User confirmed deletion');
                onClose();
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn relative cursor-default"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-colors"
                >
                    <X size={20} className="text-gray-600" />
                </button>

                {/* Hero Image */}
                <div className="h-56 relative">
                    <img
                        src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/600`}
                        alt={venue.name}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

                    <div className="absolute bottom-4 left-4 text-white">
                        <h2 className="text-2xl font-bold mb-1">{venue.name}</h2>
                        {venue.categories && venue.categories.length > 0 && (
                            <div className="flex gap-2">
                                {venue.categories.map((cat, idx) => (
                                    <span key={idx} className="text-xs bg-white/20 px-2 py-0.5 rounded backdrop-blur-md">
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-gray-600">
                                <MapPin size={18} className="text-emerald-600" />
                                <span className="text-sm">
                                    {venue.address}
                                    {distance !== null && <span className="ml-2 font-bold text-emerald-600">({distance} km)</span>}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-600">
                                <Clock size={18} className="text-emerald-600" />
                                <span className="text-sm">Cierra a las {venue.closingTime}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-yellow-400 fill-current" />
                                <span className="font-bold text-gray-900">{ratingStats?.averageRating.toFixed(1) || 'N/A'}</span>
                                <span className="text-sm text-gray-500">({ratingStats?.totalRatings || 0} calificaciones)</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {(onEdit || onDelete) && (
                        <div className="flex gap-3 pt-4 border-t border-gray-100">
                            {onEdit && (
                                <button
                                    onClick={handleEdit}
                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2.5 rounded-xl font-medium hover:bg-blue-100 transition-colors"
                                >
                                    <Edit size={18} />
                                    Editar
                                </button>
                            )}

                            {onDelete && (
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-colors"
                                >
                                    <Trash2 size={18} />
                                    Eliminar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
