import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import {
    getRevenueMetrics,
    getOrderStatistics,
    getTopProducts,
    getDailyRevenueTrends,
    getDateRangePresets,
    DateRange,
} from '../../services/analyticsService';
import { MetricCard } from '../../components/analytics/MetricCard';
import { DateRangePicker, DateRangePreset } from '../../components/analytics/DateRangePicker';
import { RevenueChart } from '../../components/analytics/RevenueChart';
import { OrdersChart } from '../../components/analytics/OrdersChart';
import { TopProductsChart } from '../../components/analytics/TopProductsChart';
import { DollarSign, ShoppingCart, TrendingUp, Package, Download, BarChart3 } from 'lucide-react';
import * as Papa from 'papaparse';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';

export const Analytics: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7Days');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangePresets().last7Days);

    // Analytics data
    const [revenueMetrics, setRevenueMetrics] = useState<any>(null);
    const [orderStats, setOrderStats] = useState<any>(null);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);

    useEffect(() => {
        if (selectedPreset !== 'custom') {
            const presets = getDateRangePresets();
            setDateRange(presets[selectedPreset]);
        } else if (customStart && customEnd) {
            setDateRange({
                start: new Date(customStart),
                end: new Date(customEnd),
            });
        }
    }, [selectedPreset, customStart, customEnd]);

    useEffect(() => {
        if (user && dateRange) {
            loadAnalytics();
        }
    }, [user?.id, user?.venueId, JSON.stringify(user?.venueIds), user?.role, dateRange]);

    const loadAnalytics = async () => {
        if (!user) return;

        let targetVenues: string | string[];

        if (user.role === UserRole.SUPER_ADMIN) {
            targetVenues = 'all';
        } else if (user.venueIds && user.venueIds.length > 0) {
            targetVenues = user.venueIds;
        } else if (user.venueId) {
            targetVenues = user.venueId;
        } else {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [revenue, orders, products, trends] = await Promise.all([
                getRevenueMetrics(targetVenues, dateRange),
                getOrderStatistics(targetVenues, dateRange),
                getTopProducts(targetVenues, dateRange, 5),
                getDailyRevenueTrends(targetVenues, dateRange),
            ]);

            setRevenueMetrics(revenue);
            setOrderStats(orders);
            setTopProducts(products);
            setDailyTrends(trends);
        } catch (error) {
            logger.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!dailyTrends.length) return;

        const csv = Papa.unparse(dailyTrends);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && !revenueMetrics) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <BarChart3 className="text-emerald-600" />
                        Analytics & Reportes
                    </h1>
                    <p className="text-gray-500 mt-1">Análisis de rendimiento y ventas</p>
                </div>

                <button
                    onClick={exportToCSV}
                    disabled={!dailyTrends.length}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-bold active:scale-95"
                >
                    <Download size={18} />
                    <span className="hidden sm:inline">Exportar CSV</span>
                    <span className="sm:hidden">CSV</span>
                </button>
            </div>

            {/* Date Range Picker */}
            <DateRangePicker
                selectedPreset={selectedPreset}
                onPresetChange={setSelectedPreset}
                customStart={customStart}
                customEnd={customEnd}
                onCustomRangeChange={(start, end) => {
                    setCustomStart(start);
                    setCustomEnd(end);
                }}
            />

            {/* Metric Cards */}
            {revenueMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title="Ingresos Totales"
                        value={formatCOP(revenueMetrics.totalRevenue)}
                        icon={DollarSign}
                        trend={revenueMetrics.revenueGrowth}
                        subtitle="vs período anterior"
                        iconColor="text-emerald-600"
                        iconBgColor="bg-emerald-100"
                    />

                    <MetricCard
                        title="Total de Pedidos"
                        value={revenueMetrics.totalOrders}
                        icon={ShoppingCart}
                        iconColor="text-blue-600"
                        iconBgColor="bg-blue-100"
                    />

                    <MetricCard
                        title="Valor Promedio del Pedido"
                        value={formatCOP(revenueMetrics.averageOrderValue)}
                        icon={TrendingUp}
                        iconColor="text-purple-600"
                        iconBgColor="bg-purple-100"
                    />

                    <MetricCard
                        title="Productos Vendidos"
                        value={topProducts.reduce((sum, p) => sum + p.quantitySold, 0)}
                        icon={Package}
                        iconColor="text-orange-600"
                        iconBgColor="bg-orange-100"
                    />
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2">
                    <RevenueChart data={dailyTrends} />
                </div>

                {/* Orders by Status */}
                {orderStats && <OrdersChart data={orderStats} />}

                {/* Top Products */}
                <TopProductsChart data={topProducts} />
            </div>

            {loading && (
                <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
                    <LoadingSpinner />
                </div>
            )}
        </div>
    );
};

export default Analytics;
