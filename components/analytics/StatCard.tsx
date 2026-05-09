import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { Card } from '../customer/common/Card';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DeltaProps {
  value: number;               // +12 o -5
  label?: string;              // "vs ayer", "esta semana"
  format?: 'number' | 'currency' | 'percent';
}

const Delta: React.FC<DeltaProps> = ({ value, label, format = 'percent' }) => {
  const isPositive = value >= 0;
  
  const formatValue = (v: number) => {
    const absV = Math.abs(v);
    switch (format) {
      case 'currency':
        return `$${absV.toLocaleString('es-CO')}`;
      case 'percent':
        return `${absV}%`;
      default:
        return absV.toLocaleString('es-CO');
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-1 text-xs font-black',
      isPositive ? 'text-emerald-600' : 'text-red-500'
    )}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>{isPositive ? '+' : '-'}{formatValue(value)}</span>
      {label && <span className="text-gray-400 font-bold ml-1">{label}</span>}
    </div>
  );
};

export interface StatCardProps {
  title: string;
  value: number | string;
  format?: 'number' | 'currency' | 'percent' | 'raw';
  delta?: DeltaProps;
  icon?: React.ReactNode;
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;           // muestra Skeleton.Card variant="stat"
  onClick?: () => void;
  className?: string;
}

const intentStyles = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  format = 'raw',
  delta,
  icon,
  intent = 'default',
  loading,
  onClick,
  className,
}) => {
  if (loading) {
    return <Skeleton.Card variant="stat" className={className} />;
  }

  const formatMainValue = (v: number | string) => {
    if (typeof v === 'string' || format === 'raw') return v;
    
    switch (format) {
      case 'currency':
        return `$${v.toLocaleString('es-CO')}`;
      case 'percent':
        return `${v}%`;
      case 'number':
        return v.toLocaleString('es-CO');
      default:
        return v;
    }
  };

  return (
    <Card
      variant={onClick ? 'interactive' : 'elevated'}
      className={cn('flex flex-col gap-4 overflow-hidden', className)}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-black text-gray-500 uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-black text-gray-900">
            {formatMainValue(value)}
          </h3>
        </div>
        
        {icon && (
          <div className={cn(
            'p-3 rounded-2xl flex items-center justify-center',
            intentStyles[intent]
          )}>
            {icon}
          </div>
        )}
      </div>

      {delta && <Delta {...delta} />}
    </Card>
  );
};
