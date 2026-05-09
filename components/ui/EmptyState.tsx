import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '../customer/common/Button';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EmptyStateProps {
  icon?: string | React.ReactNode;   // emoji o ReactNode
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';        // default: 'md'
  className?: string;
}

const iconSizes = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-7xl',
};

const paddingStyles = {
  sm: 'py-6',
  md: 'py-12',
  lg: 'py-24 min-h-[50vh]',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center px-6',
      paddingStyles[size],
      className
    )}>
      {icon && (
        <div className={cn('mb-4 text-gray-300', iconSizes[size])}>
          {typeof icon === 'string' ? (
            <span role="img" aria-label="empty state icon">{icon}</span>
          ) : (
            icon
          )}
        </div>
      )}
      
      <h3 className={cn(
        'font-black text-gray-900 mb-2',
        size === 'lg' ? 'text-2xl' : 'text-lg'
      )}>
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-gray-500 max-w-xs mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              className="font-black px-8"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
              className="font-black text-gray-500"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
