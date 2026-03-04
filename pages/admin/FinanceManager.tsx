import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { Order, OrderStatus } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DollarSign, Search, Calendar, CreditCard, TrendingUp, AlertCircle, RotateCw } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { logger } from '../../utils/logger';

export const FinanceManager: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState({ totalRevenue: 0, totalEarnings: 0, totalCount: 0 });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Load first page
            const result = await adminService.getOrdersPaginated(20);
            setOrders(result.data);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);

            // In a real optimized app, these stats should come from a separate 'statistics' document
            // updated via Cloud Functions triggers to avoid reading all docs.
            // For now, to stop the bleeding, we will NOT calculate global totals from client side reads
            // unless requested, or we accept that these specific totals cards show "Loaded Data" totals.
            // Let's Calculate totals based on what we have loaded or implement a dedicated stats service later.
            // For THIS fix, I will calculate based on loaded data to prevent the 10k reads.
        } catch (error) {
            logger.error('Error loading finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await adminService.getOrdersPaginated(20, lastDoc);
            setOrders(prev => [...prev, ...result.data]);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (error) {
            logger.error('Error loading more orders:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Calculations (Based on loaded data for now - Cost Safe)
    const totalRevenue = orders.reduce((sum, order) => sum + (order.platformFee || 0), 0);
    const totalVenueEarnings = orders.reduce((sum, order) => sum + (order.venueEarnings || 0), 0);
    const totalOrdersLoaded = orders.length;

    // Filtering (Client side on loaded data)
    const filteredOrders = orders.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.venueId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center w-full">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign className="text-emerald-600" />
                        Finanzas & Comisiones
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Gestión de ingresos, comisiones y pagos a negocios.</p>
                </div>
                <button
                    onClick={() => loadInitialData()}
                    className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center"
                    title="Refrescar finanzas"
                >
                    <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            <div className="bg-yellow-50 text-yellow-800 p-2 rounded-md text-xs mt-2 inline-block border border-yellow-200">
                ⚠️ Mostrando estadísticas de las {totalOrdersLoaded} órdenes cargadas recientemente.
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Ingresos (Cargados)</p>
                            <h3 className="text-3xl font-bold text-gray-800 mt-2">${totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-blue-500"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Pagos Pendientes (Cargados)</p>
                            <h3 className="text-3xl font-bold text-gray-800 mt-2">${totalVenueEarnings.toLocaleString()}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <CreditCard size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-gray-500"></div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Órdenes en Vista</p>
                            <h3 className="text-3xl font-bold text-gray-800 mt-2">{totalOrdersLoaded}</h3>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-gray-600">
                            <Calendar size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar en órdenes cargadas..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4">Pedido ID</th>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Negocio</th>
                                <th className="p-4 text-right bg-emerald-50/50">Total Pedido</th>
                                <th className="p-4 text-right bg-emerald-50 text-emerald-700">Comisión (10%)</th>
                                <th className="p-4 text-right bg-blue-50 text-blue-700">Ganancia Negocio</th>
                                <th className="p-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                                        No se encontraron pedidos.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-500">
                                            {order.id.slice(0, 8)}...
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {new Date(order.createdAt).toLocaleDateString()} <br />
                                            <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="p-4 font-medium text-gray-800">
                                            {order.venueId}
                                        </td>
                                        <td className="p-4 text-right font-medium text-gray-800 bg-emerald-50/30">
                                            ${(order.subtotal || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-bold text-emerald-600 bg-emerald-50/50">
                                            + ${(order.platformFee || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-bold text-blue-600 bg-blue-50/50">
                                            ${(order.venueEarnings || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${order.status === OrderStatus.COMPLETED || order.status === OrderStatus.PAID
                                                ? 'bg-green-100 text-green-700'
                                                : order.status === OrderStatus.MISSED || order.status === OrderStatus.DISPUTED
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More Button */}
                {hasMore && !searchTerm && (
                    <div className="p-4 border-t border-gray-100 flex justify-center">
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loadingMore ? 'Cargando...' : 'Cargar más pedidos'}
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};
