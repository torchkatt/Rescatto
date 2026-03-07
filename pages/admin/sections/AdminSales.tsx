import React, { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import {
    getRevenueMetrics,
    getTopProducts,
    getDailyRevenueTrends,
    getDateRangePresets,
} from '../../../services/analyticsService';
import { RevenueChart } from '../../../components/analytics/RevenueChart';
import { TopProductsChart } from '../../../components/analytics/TopProductsChart';
import { LoadingSpinner } from '../../../components/customer/common/Loading';
import * as Papa from 'papaparse';
import { logger } from '../../../utils/logger';
import { formatCOP } from '../../../utils/formatters';

type Period = 'today' | 'last7Days' | 'last30Days';

const PERIOD_LABELS: Record<Period, string> = {
    today: 'Hoy',
    last7Days: '7 días',
    last30Days: '30 días',
};

export const AdminSales: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('last7Days');
    const [revenueMetrics, setRevenueMetrics] = useState<any>(null);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);

    useEffect(() => {
        loadData(true);
    }, [selectedPeriod]);

    const loadData = async (initial = false) => {
        if (initial) setLoading(true);
        else setRefreshing(true);
        try {
            const presets = getDateRangePresets();
            const dateRange = presets[selectedPeriod];
            const [revenue, products, trends] = await Promise.all([
                getRevenueMetrics('all', dateRange),
                getTopProducts('all', dateRange, 10),
                getDailyRevenueTrends('all', dateRange),
            ]);
            setRevenueMetrics(revenue);
            setTopProducts(products);
            setDailyTrends(trends);
        } catch (error) {
            logger.error('Error loading admin sales:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const exportToCSV = () => {
        if (!dailyTrends.length) return;
        const csv = Papa.unparse(dailyTrends);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ventas_plataforma_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 className="text-emerald-600" />
                    Ventas & Analytics Global
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map(period => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    selectedPeriod === period
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {PERIOD_LABELS[period]}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => loadData(false)}
                        disabled={refreshing}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                        title="Refrescar datos"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin text-emerald-600' : 'text-gray-500'} />
                    </button>
                    <button
                        onClick={exportToCSV}
                        disabled={!dailyTrends.length}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium text-sm"
                    >
                        <Download size={16} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            {revenueMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500 rounded-r-xl" />
                        <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Ingresos Totales</p>
                        <p className="text-3xl font-bold text-gray-800">{formatCOP(revenueMetrics.totalRevenue)}</p>
                        {revenueMetrics.revenueGrowth !== undefined && (
                            <p className={`text-xs mt-1 font-medium ${revenueMetrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {revenueMetrics.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(revenueMetrics.revenueGrowth).toFixed(1)}% vs período anterior
                            </p>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-2 bg-blue-500 rounded-r-xl" />
                        <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Comisión Plataforma (10%)</p>
                        <p className="text-3xl font-bold text-gray-800">
                            {formatCOP(Math.round(revenueMetrics.totalRevenue * 0.1))}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{revenueMetrics.totalOrders} pedidos en el período</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-2 bg-purple-500 rounded-r-xl" />
                        <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Ticket Promedio</p>
                        <p className="text-3xl font-bold text-gray-800">
                            {formatCOP(Math.round(revenueMetrics.averageOrderValue))}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{topProducts.length} productos únicos vendidos</p>
                    </div>
                </div>
            )}

            {/* Revenue Trend Chart */}
            <RevenueChart data={dailyTrends} />

            {/* Top Products */}
            <TopProductsChart data={topProducts} />
        </div>
    );
};
