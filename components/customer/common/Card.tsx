import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CardProps {
  variant?: 'flat' | 'elevated' | 'interactive' | 'glass' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';  // none=0, sm=p-3, md=p-4(actual), lg=p-6
  as?: React.ElementType;                  // div (default) | article | li | section
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  flat: 'bg-white rounded-xl',
  elevated: 'bg-white rounded-xl shadow-md', // default
  interactive: 'bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] cursor-pointer ring-1 ring-transparent hover:ring-emerald-500/20',
  glass: 'bg-white/80 backdrop-blur-md rounded-xl border border-white/20 shadow-sm',
  outline: 'bg-white rounded-xl border border-gray-100 hover:border-emerald-500/30',
};

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  padding = 'md',
  as: Component = 'div',
  children,
  className = '',
  onClick,
}) => {
  return (
    <Component
      className={cn(
        variantStyles[variant],
        paddingStyles[padding],
        'select-none transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
};
