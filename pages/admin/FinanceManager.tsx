import React, { useEffect, useState, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';
import { Order, OrderStatus } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DollarSign, Search, Calendar, CreditCard, TrendingUp, RotateCw, Store } from 'lucide-react';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAdminTable } from '../../hooks/useAdminTable';

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
    let start = new Date(now);
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
        default: break;
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
    const { showToast } = useToast();
    const [globalStats, setGlobalStats] = useState<FinanceStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

    const table = useAdminTable<Order>({
        fetchFn: (size, cursor, term) => adminService.getOrdersPaginated(size, cursor),
        initialPageSize: 20
    });

    const { isReadyForBackend, refreshClaims } = useAuth();

    const loadGlobalStats = async () => {
        if (!isReadyForBackend) {
            setStatsLoading(false);
            return;
        }
        
        const startTime = Date.now();
        setStatsLoading(true);
        try {
            const fns = getFunctions();
            const getFinanceStatsFn = httpsCallable(fns, 'getFinanceStats');
            const { startDate, endDate } = getPeriodDates(selectedPeriod);
            const result = await getFinanceStatsFn({ startDate, endDate });
            setGlobalStats(result.data as FinanceStats);
        } catch (error: any) {
            logger.error('Error loading global finance stats:', error);
            if (error?.code === 'permission-denied') {
                logger.warn('FinanceManager: Acceso denegado. Intentando refrescar permisos del Búnker...');
                refreshClaims();
            }
            showToast('error', 'Error al cargar estadísticas financieras');
            setGlobalStats(null);
        } finally {
            // Aseguramos que la animación dure al menos 800ms para que sea visible y satisfactoria
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 800 - elapsed);
            setTimeout(() => setStatsLoading(false), remaining);
        }
    };

    useEffect(() => {
        loadGlobalStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPeriod, isReadyForBackend]);

    // orders load replaced by table hook

    // goToPage replaced by table.onPageChange


    const columns = useMemo<Column<Order>[]>(() => [
        { 
            header: 'ID', 
            accessor: (order) => <span className="font-mono text-xs text-gray-500">{(order.id || '').slice(0, 8)}...</span>,
            sortable: true,
            sortKey: 'id'
        },
        { 
            header: 'Fecha', 
            accessor: (order) => (
                <div className="text-xs">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}<br />
                    <span className="text-gray-400">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ''}</span>
                </div>
            ),
            sortable: true,
            sortKey: 'createdAt'
        },
        { header: 'Cliente', accessor: 'customerName', sortable: true },
        { 
            header: 'Total', 
            accessor: (order) => formatCOP(order.subtotal || 0), 
            className: 'text-right',
            sortable: true,
            sortKey: 'subtotal'
        },
        { 
            header: 'Comisión', 
            accessor: (order) => <span className="text-emerald-600 font-bold">+{formatCOP(order.platformFee || 0)}</span>, 
            className: 'text-right bg-emerald-50/20',
            sortable: true,
            sortKey: 'platformFee'
        },
        { 
            header: 'Al Negocio', 
            accessor: (order) => <span className="text-blue-600 font-bold">{formatCOP(order.venueEarnings || 0)}</span>, 
            className: 'text-right bg-blue-50/20',
            sortable: true,
            sortKey: 'venueEarnings'
        },
        { 
            header: 'Estado', 
            accessor: (order) => (
                <div className="flex justify-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        order.status === OrderStatus.COMPLETED || order.status === OrderStatus.PAID
                            ? 'bg-green-100 text-green-700'
                            : order.status === OrderStatus.MISSED || order.status === OrderStatus.DISPUTED
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                    }`}>{order.status}</span>
                </div>
            ),
            sortable: true,
            sortKey: 'status'
        }
    ], []);

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
                        className="bg-white border border-gray-200 text-gray-600 p-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="Refrescar estadísticas"
                    >
                        <RotateCw size={18} className={`${statsLoading ? 'animate-spin text-emerald-600' : 'transition-transform group-hover:rotate-180 duration-500'}`} />
                    </button>
                </div>
            </div>

            {/* Global Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-emerald-900/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Ingresos Plataforma</p>
                            {statsLoading
                                ? <div className="h-9 w-32 bg-gray-800 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{formatCOP(globalStats?.totalPlatformFee || 0)}</h3>
                            }
                            <p className="text-xs text-gray-500 mt-1">Comisión 10% de ventas brutas</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={24} /></div>
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-blue-900/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-blue-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Ganancias Negocios</p>
                            {statsLoading
                                ? <div className="h-9 w-32 bg-gray-800 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{formatCOP(globalStats?.totalVenueEarnings || 0)}</h3>
                            }
                            <p className="text-xs text-gray-500 mt-1">90% de ventas brutas acumuladas</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><CreditCard size={24} /></div>
                    </div>
                </div>

                <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-purple-900/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-purple-500 rounded-r-xl" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Pedidos Completados</p>
                            {statsLoading
                                ? <div className="h-9 w-20 bg-gray-800 animate-pulse rounded-lg mt-2" />
                                : <h3 className="text-3xl font-bold text-white mt-2">{globalStats?.totalOrders || 0}</h3>
                            }
                            <p className="text-xs text-gray-500 mt-1">
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
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Search size={18} className="text-emerald-500" />
                        Historial de Operaciones
                    </h3>
                </div>

                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar por ID..."
                    initialPageSize={table.pageSize}
                    isLoading={table.isLoading}
                    manualPagination
                    totalItems={table.totalItems}
                    currentPage={table.currentPage}
                    onPageChange={table.onPageChange}
                    onPageSizeChange={table.onPageSizeChange}
                    searchTerm={table.searchTerm}
                    onSearchChange={table.setSearchTerm}
                    isSearching={table.isSearching}
                    exportable
                    exportFilename="rescatto_ordenes_finanzas"
                    exportTransformer={(o) => ({
                        id: o.id,
                        venueName: o.venueName,
                        total: o.subtotal,
                        platformFee: o.platformFee || 0,
                        venueEarnings: (o.subtotal - (o.platformFee || 0)),
                        status: o.status,
                        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('es-CO') : ''
                    })}
                />
            </div>
        </div>
    );
};
