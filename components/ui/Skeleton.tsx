import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SkeletonBlockProps {
  h?: number | string;  // altura: 40 | "100%" | "3rem"
  w?: number | string;  // ancho
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  h,
  w,
  rounded = 'md',
  className,
}) => {
  const style: React.CSSProperties = {
    height: typeof h === 'number' ? `${h}px` : h,
    width: typeof w === 'number' ? `${w}px` : w,
  };

  const roundedStyles = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      style={style}
      className={cn(
        'animate-pulse bg-gray-200',
        roundedStyles[rounded],
        className
      )}
    />
  );
};

interface SkeletonTextProps {
  lines?: number;       // default: 2
  lastLineWidth?: string; // "60%" para parecer párrafo real
  className?: string;
}

const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 2,
  lastLineWidth = '60%',
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {[...Array(lines)].map((_, i) => (
        <SkeletonBlock
          key={i}
          h="1em"
          w={i === lines - 1 ? lastLineWidth : '100%'}
          rounded="md"
        />
      ))}
    </div>
  );
};

interface SkeletonAvatarProps {
  size?: number | string;
  rounded?: 'full' | 'xl';
  className?: string;
}

const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 40,
  rounded = 'full',
  className,
}) => {
  return (
    <SkeletonBlock
      h={size}
      w={size}
      rounded={rounded === 'full' ? 'full' : 'xl'}
      className={className}
    />
  );
};

type SkeletonCardVariant =
  | 'pack-compact'    // ProductSmallCard 192px
  | 'pack-featured'   // PackCard featured 280px
  | 'venue-card'      // VenueCard vertical
  | 'venue-row'       // VenueCard row
  | 'stat'            // StatCard KPI
  | 'section-header'; // SectionHeader

interface SkeletonCardProps {
  variant: SkeletonCardVariant;
  count?: number;      // render N cards
  className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant,
  count = 1,
  className,
}) => {
  const renderItem = (key: number) => {
    switch (variant) {
      case 'pack-compact':
        return (
          <div key={key} className="w-48 space-y-3">
            <SkeletonBlock h={128} w="100%" rounded="xl" />
            <SkeletonText lines={2} lastLineWidth="50%" />
            <SkeletonBlock h={20} w="40%" />
          </div>
        );
      case 'pack-featured':
        return (
          <div key={key} className="w-72 space-y-4">
            <SkeletonBlock h={192} w="100%" rounded="2xl" />
            <SkeletonBlock h={24} w="70%" />
            <SkeletonText lines={1} />
            <div className="flex justify-between items-center">
              <SkeletonBlock h={32} w="40%" />
              <SkeletonBlock h={40} w="30%" rounded="lg" />
            </div>
          </div>
        );
      case 'venue-card':
        return (
          <div key={key} className="space-y-3">
            <SkeletonBlock h={200} w="100%" rounded="2xl" />
            <SkeletonBlock h={24} w="60%" />
            <SkeletonBlock h={16} w="40%" />
          </div>
        );
      case 'venue-row':
        return (
          <div key={key} className="flex gap-3 items-center p-3 border rounded-2xl">
            <SkeletonBlock h={80} w={80} rounded="2xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock h={20} w="70%" />
              <SkeletonBlock h={16} w="40%" />
              <div className="flex gap-2">
                <SkeletonBlock h={24} w={60} rounded="full" />
                <SkeletonBlock h={24} w={60} rounded="full" />
              </div>
            </div>
          </div>
        );
      case 'stat':
        return (
          <div key={key} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex justify-between">
              <SkeletonBlock h={20} w="40%" />
              <SkeletonAvatar size={24} />
            </div>
            <SkeletonBlock h={32} w="60%" />
            <SkeletonBlock h={16} w="30%" />
          </div>
        );
      case 'section-header':
        return (
          <div key={key} className="flex justify-between items-end mb-6">
            <div className="space-y-2">
              <SkeletonBlock h={28} w={200} />
              <SkeletonBlock h={16} w={150} />
            </div>
            <SkeletonBlock h={24} w={80} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('grid gap-4', className)}>
      {[...Array(count)].map((_, i) => renderItem(i))}
    </div>
  );
};

export const Skeleton = {
  Block: SkeletonBlock,
  Text: SkeletonText,
  Avatar: SkeletonAvatar,
  Card: SkeletonCard,
};
