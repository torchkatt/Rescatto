import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: number; // percentage
    subtitle?: string;
    iconColor?: string;
    iconBgColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    subtitle,
    iconColor = 'text-emerald-600',
    iconBgColor = 'bg-emerald-100',
}) => {
    const getTrendIcon = () => {
        if (!trend) return <Minus size={16} className="text-gray-400" />;
        if (trend > 0) return <TrendingUp size={16} className="text-green-600" />;
        return <TrendingDown size={16} className="text-red-600" />;
    };

    const getTrendColor = () => {
        if (!trend) return 'text-gray-500';
        if (trend > 0) return 'text-green-600';
        return 'text-red-600';
    };

    const formatTrend = () => {
        if (!trend) return 'Sin cambios';
        const sign = trend > 0 ? '+' : '';
        return `${sign}${trend.toFixed(1)}%`;
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className={`${iconBgColor} p-3 rounded-lg`}>
                    <Icon className={iconColor} size={24} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 ${getTrendColor()} text-sm font-semibold`}>
                        {getTrendIcon()}
                        <span>{formatTrend()}</span>
                    </div>
                )}
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-1">{value}</h3>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            {subtitle && (
                <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
        </div>
    );
};

export default MetricCard;
