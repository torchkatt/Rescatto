import React, { useEffect, useState, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { adminService } from '../../services/adminService';
import { Order, OrderStatus } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DollarSign, Search, Calendar, CreditCard, TrendingUp, RotateCw, Store, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type Period = 'today' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
    today: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    year: 'Este año',
};

const toYMD = (d: Date): string => d.toISOString().slice(0, 10);

const getPeriodDates = (period: Period) => {
    const now = new Date();
    let start: Date;
    switch (period) {
        case 'today': {
            start = new Date(now); start.setHours(0, 0, 0, 0); break;
        }
        case 'week': {
            start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); break;
        }
        case 'month': {
            start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        }
        case 'year': {
            start = new Date(now.getFullYear(), 0, 1); break;
        }
    }
    return { startDate: toYMD(start), endDate: toYMD(now) };
};

interface FinanceStats {
    totalRevenue: number;
    totalPlatformFee: number;
    totalVenueEarnings: number;
    totalOrders: number;
    averageOrderValue: number;
    topVenues: Array<{ venueId: string; revenue: number; orders: number; platformFee: number }>;
}

export const FinanceManager: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [globalStats, setGlobalStats] = useState<FinanceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        loadGlobalStats();
    }, [selectedPeriod]);

    useEffect(() => {
        loadOrdersTable();
    }, []);

    const loadGlobalStats = async () => {
        setStatsLoading(true);
        try {
            const fns = getFunctions();
            const getFinanceStatsFn = httpsCallable(fns, 'getFinanceStats');
            const { startDate, endDate } = getPeriodDates(selectedPeriod);
            const result = await getFinanceStatsFn({ startDate, endDate });
            setGlobalStats(result.data as FinanceStats);
        } catch (error) {
            logger.error('Error loading global finance stats:', error);
            setGlobalStats(null);
        } finally {
            setStatsLoading(false);
        }
    };

    const loadOrdersTable = async () => {
        setLoading(true);
        try {
            const result = await adminService.getOrdersPaginated(20);
            setOrders(result.data);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (error) {
            logger.error('Error loading finance orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = useMemo(() =>
        orders.filter(order =>
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.venueId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [orders, searchTerm]
    );

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filteredOrders.length % pageSize === 0;

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) {
            setLoadingMore(true);
            try {
                const result = await adminService.getOrdersPaginated(pageSize, lastDoc);
                setOrders(prev => [...prev, ...result.data]);
                setLastDoc(result.lastDoc);
                setHasMore(result.hasMore);
            } catch (error) {
                logger.error('Error loading more orders:', error);
            } finally {
                setLoadingMore(false);
            }
        }
        setCurrentPage(target);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    const getPageNumbers = () => {
        const delta = 2;
        const pages: (number | '...')[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    return (
        <div className="space-y-8 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="text-emerald-600" />
                        Finanzas & Comisiones
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Estadísticas reales de la plataforma por período.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setSelectedPeriod(p)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    selectedPeriod === p
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={loadGlobalStats}
                        disabled={statsLoading}
                        className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
                        title="Refrescar estadísticas"
                    >
                        <RotateCw size={18} className={statsLoading ? 'animate-spin text-emerald-600' : ''} />
                    </button>
                </div>
            </div>

            {/* Global Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Ingresos Plataforma</p>
                            {statsLoading
                                ? <div className="h-9 w-32 bg-gray-100 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{formatCOP(globalStats?.totalPlatformFee || 0)}</h3>
                            }
                            <p className="text-xs text-gray-400 mt-1">Comisión 10% de ventas brutas</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={24} /></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-blue-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Ganancias Negocios</p>
                            {statsLoading
                                ? <div className="h-9 w-32 bg-gray-100 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{formatCOP(globalStats?.totalVenueEarnings || 0)}</h3>
                            }
                            <p className="text-xs text-gray-400 mt-1">90% de ventas brutas acumuladas</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><CreditCard size={24} /></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-purple-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Pedidos Completados</p>
                            {statsLoading
                                ? <div className="h-9 w-20 bg-gray-100 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{globalStats?.totalOrders || 0}</h3>
                            }
                            <p className="text-xs text-gray-400 mt-1">
                                Ticket promedio: {formatCOP(Math.round(globalStats?.averageOrderValue || 0))}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><Calendar size={24} /></div>
                    </div>
                </div>
            </div>

            {/* Top Venues */}
            {!statsLoading && globalStats?.topVenues && globalStats.topVenues.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                        <Store size={18} className="text-emerald-600" />
                        <h3 className="font-bold text-gray-800">Top Negocios por Ventas</h3>
                        <span className="text-xs text-gray-400 ml-auto">{PERIOD_LABELS[selectedPeriod]}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {globalStats.topVenues.map((venue, idx) => (
                            <div key={venue.venueId} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                        idx === 0 ? 'bg-yellow-400 text-white' :
                                        idx === 1 ? 'bg-gray-400 text-white' :
                                        idx === 2 ? 'bg-amber-600 text-white' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>{idx + 1}</span>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm font-mono">{venue.venueId.slice(0, 16)}...</p>
                                        <p className="text-xs text-gray-500">{venue.orders} pedidos</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-600">{formatCOP(venue.revenue)}</p>
                                    <p className="text-xs text-gray-400">Comisión: {formatCOP(venue.platformFee)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-800">Historial de Órdenes</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 sm:flex-none sm:w-64">
                            <Search className="text-gray-400 shrink-0" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por ID, negocio o cliente..."
                                className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-500">Filas:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-emerald-400"
                            >
                                {PAGE_SIZE_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4 text-right bg-emerald-50/50">Total</th>
                                    <th className="p-4 text-right bg-emerald-50 text-emerald-700">Comisión</th>
                                    <th className="p-4 text-right bg-blue-50 text-blue-700">Al Negocio</th>
                                    <th className="p-4 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {paginatedOrders.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">No se encontraron pedidos.</td></tr>
                                ) : (
                                    paginatedOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}...</td>
                                            <td className="p-4 text-gray-600 text-xs">
                                                {new Date(order.createdAt).toLocaleDateString()}<br />
                                                <span className="text-gray-400">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                            </td>
                                            <td className="p-4 font-medium text-gray-800 text-sm">{order.customerName}</td>
                                            <td className="p-4 text-right font-medium text-gray-800 bg-emerald-50/30">{formatCOP(order.subtotal || 0)}</td>
                                            <td className="p-4 text-right font-bold text-emerald-600 bg-emerald-50/50">+{formatCOP(order.platformFee || 0)}</td>
                                            <td className="p-4 text-right font-bold text-blue-600 bg-blue-50/50">{formatCOP(order.venueEarnings || 0)}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    order.status === OrderStatus.COMPLETED || order.status === OrderStatus.PAID
                                                        ? 'bg-green-100 text-green-700'
                                                        : order.status === OrderStatus.MISSED || order.status === OrderStatus.DISPUTED
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                }`}>{order.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && filteredOrders.length > 0 && (
                    <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 shrink-0">
                            {loadingMore ? 'Cargando...' : (
                                <>Mostrando <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredOrders.length)}</span> de <span className="font-semibold text-gray-700">{filteredOrders.length}{hasMore ? '+' : ''}</span> pedidos</>
                            )}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => goToPage(1)}
                                disabled={safePage === 1 || loadingMore}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Primera página"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => goToPage(safePage - 1)}
                                disabled={safePage === 1 || loadingMore}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Página anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            {getPageNumbers().map((page, idx) =>
                                page === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm select-none">…</span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page as number)}
                                        disabled={loadingMore}
                                        className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                                            page === safePage
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => goToPage(safePage + 1)}
                                disabled={(safePage >= totalPages && !hasMore) || loadingMore}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Página siguiente"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => goToPage(totalPages)}
                                disabled={(safePage >= totalPages && !hasMore) || loadingMore}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Última página"
                            >
                                <ChevronsRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
