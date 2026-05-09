import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AvatarProps {
  src?: string;
  name?: string;               // genera iniciales si no hay src
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean | 'emerald' | 'white' | 'red';
  status?: 'online' | 'offline' | 'away';
  className?: string;
}

const sizeStyles = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const ringStyles = {
  emerald: 'ring-2 ring-emerald-500 ring-offset-2',
  white: 'ring-2 ring-white ring-offset-2',
  red: 'ring-2 ring-red-500 ring-offset-2',
};

const statusStyles = {
  online: 'bg-emerald-500',
  offline: 'bg-gray-400',
  away: 'bg-amber-500',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  ring,
  status,
  className,
}) => {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className={cn('relative inline-block', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-full overflow-hidden bg-gray-100 font-black text-gray-500 border border-gray-200',
        sizeStyles[size],
        ring === true ? ringStyles.emerald : ring && ringStyles[ring as keyof typeof ringStyles]
      )}>
        {src ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      
      {status && (
        <span className={cn(
          'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
          size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
          statusStyles[status]
        )} />
      )}
    </div>
  );
};
