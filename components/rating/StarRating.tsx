import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showCount?: boolean;
    count?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
    value,
    onChange,
    readonly = false,
    size = 'md',
    showCount = false,
    count = 0,
}) => {
    const [hoverValue, setHoverValue] = React.useState<number>(0);

    const sizes = {
        sm: 16,
        md: 20,
        lg: 28,
    };

    const starSize = sizes[size];

    const handleClick = (rating: number) => {
        if (!readonly && onChange) {
            onChange(rating);
        }
    };

    const handleMouseEnter = (rating: number) => {
        if (!readonly) {
            setHoverValue(rating);
        }
    };

    const handleMouseLeave = () => {
        setHoverValue(0);
    };

    const getStarColor = (index: number) => {
        const displayValue = hoverValue || value;
        return index <= displayValue ? 'text-yellow-400' : 'text-gray-300';
    };

    return (
        <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => handleClick(index)}
                        onMouseEnter={() => handleMouseEnter(index)}
                        onMouseLeave={handleMouseLeave}
                        disabled={readonly}
                        className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                            }`}
                    >
                        <Star
                            size={starSize}
                            className={`${getStarColor(index)} ${index <= (hoverValue || value) ? 'fill-current' : ''
                                }`}
                        />
                    </button>
                ))}
            </div>

            {showCount && count > 0 && (
                <span className="text-sm text-gray-500 ml-1">
                    ({count})
                </span>
            )}

            {!readonly && value > 0 && (
                <span className="text-sm font-medium text-gray-700 ml-2">
                    {value.toFixed(1)}
                </span>
            )}
        </div>
    );
};

export default StarRating;
