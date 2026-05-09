import React, { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LoadingSpinner } from './Loading';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-black transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 rounded-xl shadow-md shadow-emerald-500/20',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-500 rounded-xl',
    outline: 'border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-500 rounded-xl',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 rounded-xl',
    icon: 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50 rounded-full shadow-sm',
  };

  const sizes = {
    sm: variant === 'icon' ? 'p-2' : 'px-3 py-1.5 text-sm',
    md: variant === 'icon' ? 'p-3' : 'px-4 py-2 text-base',
    lg: variant === 'icon' ? 'p-4' : 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner
          size={size === 'sm' ? 'xs' : 'sm'}
          color="currentColor"
          className={children ? 'mr-2' : ''}
        />
      ) : (
        leftIcon && <span className={cn('flex-shrink-0', children ? 'mr-2' : '')}>{leftIcon}</span>
      )}
      
      {children}
      
      {!isLoading && rightIcon && (
        <span className={cn('flex-shrink-0', children ? 'ml-2' : '')}>{rightIcon}</span>
      )}
    </button>
  );
};
