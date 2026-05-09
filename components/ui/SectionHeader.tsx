import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronRight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string | number;      // pill verde: "35 disponibles"
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  size?: 'sm' | 'md' | 'lg';   // default: 'md'
  className?: string;
}

const titleStyles = {
  sm: 'text-base font-black',
  md: 'text-xl font-black tracking-tight',
  lg: 'text-2xl font-black tracking-tight',
};

const badgeStyles = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
};

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  action,
  size = 'md',
  className,
}) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (action?.onClick) {
      action.onClick();
    } else if (action?.href) {
      navigate(action.href);
    }
  };

  return (
    <div className={cn('flex flex-col gap-1 mb-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-emerald-600 flex-shrink-0">{icon}</span>}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className={cn('text-gray-900 truncate', titleStyles[size])}>
              {title}
            </h2>
            {badge !== undefined && (
              <span className={cn(
                'bg-emerald-100 text-emerald-700 font-black rounded-full whitespace-nowrap',
                badgeStyles[size]
              )}>
                {badge}
              </span>
            )}
          </div>
        </div>

        {action && (
          <button
            onClick={handleAction}
            className="flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 font-black text-sm whitespace-nowrap transition-colors group"
          >
            {action.label}
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs text-gray-400 font-black uppercase tracking-widest">
          {subtitle}
        </p>
      )}
    </div>
  );
};
