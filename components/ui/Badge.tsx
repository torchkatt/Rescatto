import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BadgeIntent =
  | 'discount'        // -35%
  | 'rescue'          // 🍃 Rescate
  | 'trending'        // 🔥 Trending (pulse)
  | 'hot-deal'        // ⚡ ¡Oferta hot!
  | 'low-stock'       // 🔥 ¡Solo 2!
  | 'dynamic-price'   // ⬇️ Precio bajando (pulse)
  | 'distance'        // 📍 1.2 km
  | 'open'            // • Abierto hasta 10pm
  | 'closed'          // • Cerrado
  | 'new'             // Nuevo
  | 'custom';         // override completo via className

interface BadgeProps {
  intent: BadgeIntent;
  size?: 'xs' | 'sm' | 'md';   // default: 'sm'
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const intentStyles: Record<BadgeIntent, string> = {
  discount: 'bg-emerald-500 text-white font-black border-none',
  rescue: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  trending: 'bg-orange-500 text-white animate-pulse border-none',
  'hot-deal': 'bg-[#FF6B35] text-white border-none',
  'low-stock': 'bg-red-600 text-white border-none',
  'dynamic-price': 'bg-[#FF6B35] text-white animate-pulse border-none',
  distance: 'bg-white/90 text-emerald-600 backdrop-blur-sm border-none',
  open: 'bg-emerald-50 text-emerald-700 border-none',
  closed: 'bg-red-50 text-red-700 border-none',
  new: 'bg-blue-500 text-white border-none',
  custom: '',
};

const sizeStyles = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  intent,
  size = 'sm',
  icon,
  pulse,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        intentStyles[intent],
        sizeStyles[size],
        pulse && 'animate-pulse',
        className
      )}
    >
      {intent === 'open' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
      {intent === 'closed' && (
        <span className="h-2 w-2 rounded-full bg-red-500"></span>
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </div>
  );
};
