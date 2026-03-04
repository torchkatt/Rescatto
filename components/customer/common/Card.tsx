import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
    return (
        <div
            className={`bg-white rounded-xl shadow-md p-4 select-none ${className}`}
            onClick={(e) => {
                if (onClick) onClick();
            }}
            style={{
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {children}
        </div>
    );
};
