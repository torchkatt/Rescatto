import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    text: string;
    children: React.ReactNode;
    delay?: number;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
    text,
    children,
    delay = 300,
    position = 'top'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900',
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 ${positionClasses[position]}`}>
                    {text}
                    <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`} />
                </div>
            )}
        </div>
    );
};
