import React, { ButtonHTMLAttributes } from 'react';
import { LoadingSpinner } from './Loading';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    children,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

    const variants = {
        primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
        secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
        outline: 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-500',
        ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <div className="mr-2">
                    <LoadingSpinner
                        size={size === 'sm' ? 'xs' : 'sm'}
                        color="currentColor"
                    />
                </div>
            )}
            {children}
        </button>
    );
};
