import React from 'react';
import { Star } from 'lucide-react';
import { RatingStats } from '../../types';
import { StarRating } from './StarRating';

interface RatingDisplayProps {
    stats: RatingStats | null;
    showBreakdown?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export const RatingDisplay: React.FC<RatingDisplayProps> = ({
    stats,
    showBreakdown = false,
    size = 'md',
}) => {
    if (!stats || stats.totalRatings === 0) {
        return (
            <div className="flex items-center gap-2 text-gray-400">
                <Star size={20} />
                <span className="text-sm">Sin calificaciones</span>
            </div>
        );
    }

    const getPercentage = (count: number) => {
        return (count / stats.totalRatings) * 100;
    };

    return (
        <div className="space-y-3">
            {/* Main Rating */}
            <div className="flex items-center gap-3">
                <StarRating
                    value={stats.averageRating}
                    readonly
                    size={size}
                    showCount
                    count={stats.totalRatings}
                />
                <div className="text-sm text-gray-600">
                    <span className="font-bold text-2xl text-gray-800">
                        {stats.averageRating.toFixed(1)}
                    </span>
                    <span className="text-gray-500"> / 5.0</span>
                </div>
            </div>

            {/* Breakdown */}
            {showBreakdown && (
                <div className="space-y-2 pt-2">
                    {[5, 4, 3, 2, 1].map((rating) => {
                        const count = stats.breakdown[rating as keyof typeof stats.breakdown];
                        const percentage = getPercentage(count);

                        return (
                            <div key={rating} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 w-8">
                                    {rating} ⭐
                                </span>
                                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-yellow-400 h-full transition-all duration-300"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 w-12 text-right">
                                    {count} ({percentage.toFixed(0)}%)
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RatingDisplay;
