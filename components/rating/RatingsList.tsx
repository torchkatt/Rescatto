import React from 'react';
import { Rating } from '../../types';
import { StarRating } from './StarRating';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface RatingsListProps {
    ratings: Rating[];
    loading?: boolean;
}

export const RatingsList: React.FC<RatingsListProps> = ({ ratings, loading = false }) => {
    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-4 h-24" />
                ))}
            </div>
        );
    }

    if (ratings.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No hay calificaciones aún</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {ratings.map((rating) => (
                <div
                    key={rating.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                <span className="text-emerald-700 font-semibold text-sm">
                                    {rating.fromUserId.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <StarRating value={rating.score} readonly size="sm" />
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatDistanceToNow(new Date(rating.createdAt), {
                                        addSuffix: true,
                                        locale: es,
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Comment */}
                    {rating.comment && (
                        <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                            {rating.comment}
                        </p>
                    )}

                    {/* Context Badge */}
                    <div className="flex gap-2 mt-3">
                        {rating.venueId && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                Restaurante
                            </span>
                        )}
                        {rating.driverId && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                Conductor
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RatingsList;
