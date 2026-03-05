import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Truck, MapPin, Package, CheckCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { User, Order, OrderStatus } from '../../../types';
import { LoadingSpinner } from '../../../components/customer/common/Loading';
import { logger } from '../../../utils/logger';

export const AdminDeliveries: React.FC = () => {
    const [drivers, setDrivers] = useState<User[]>([]);
    const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
    const [completedToday, setCompletedToday] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData(true);
    }, []);

    const loadData = async (initial = false) => {
        if (initial) setLoading(true);
        else setRefreshing(true);
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [driversSnap, activeSnap, completedSnap] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '==', 'DRIVER'))),
                getDocs(query(
                    collection(db, 'orders'),
                    where('status', 'in', [OrderStatus.IN_TRANSIT, OrderStatus.DRIVER_ACCEPTED])
                )),
                getDocs(query(
                    collection(db, 'orders'),
                    where('status', '==', OrderStatus.COMPLETED),
                    where('createdAt', '>=', Timestamp.fromDate(todayStart))
                )),
            ]);

            setDrivers(driversSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
            setActiveDeliveries(activeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
            setCompletedToday(completedSnap.size);
        } catch (error) {
            logger.error('Error loading deliveries data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) return <LoadingSpinner fullPage />;

    const activeDriverIds = new Set(activeDeliveries.map(o => o.driverId).filter(Boolean));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Truck className="text-emerald-600" />
                    Gestión de Domicilios
                </h2>
                <button
                    onClick={() => loadData(false)}
                    disabled={refreshing}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm"
                    title="Refrescar"
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin text-emerald-600' : 'text-gray-500'} />
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-blue-500 rounded-r-xl" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Drivers Registrados</p>
                            <p className="text-3xl font-bold text-gray-800">{drivers.length}</p>
                            <p className="text-xs text-blue-600 mt-1">{activeDriverIds.size} en entrega ahora</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <Truck size={24} />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-orange-500 rounded-r-xl" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Entregas en Curso</p>
                            <p className="text-3xl font-bold text-gray-800">{activeDeliveries.length}</p>
                            <p className="text-xs text-orange-600 mt-1">En tránsito o aceptadas</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
                            <Package size={24} />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500 rounded-r-xl" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Completadas Hoy</p>
                            <p className="text-3xl font-bold text-gray-800">{completedToday}</p>
                            <p className="text-xs text-emerald-600 mt-1">Pedidos finalizados</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Deliveries */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Entregas Activas</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        activeDeliveries.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                        {activeDeliveries.length}
                    </span>
                </div>
                {activeDeliveries.length === 0 ? (
                    <div className="p-12 text-center">
                        <Truck className="mx-auto mb-4 text-gray-200" size={48} />
                        <p className="text-gray-500 font-medium">No hay entregas activas</p>
                        <p className="text-sm text-gray-400 mt-1">Las entregas en curso aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {activeDeliveries.map(order => (
                            <div key={order.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-orange-50 rounded-lg text-orange-600 shrink-0">
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{order.customerName}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                            <MapPin size={10} />
                                            {(order as any).deliveryAddress || 'Dirección no disponible'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                            #{order.id.slice(0, 8)} · ${(order.totalAmount || 0).toLocaleString()} COP
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                    order.status === OrderStatus.IN_TRANSIT
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {order.status === OrderStatus.IN_TRANSIT ? '🛵 En camino' : '✅ Aceptado'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Drivers List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Lista de Repartidores</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{drivers.length}</span>
                </div>
                {drivers.length === 0 ? (
                    <div className="p-12 text-center">
                        <AlertCircle className="mx-auto mb-4 text-gray-200" size={48} />
                        <p className="text-gray-500 font-medium">No hay repartidores registrados</p>
                        <p className="text-sm text-gray-400 mt-1">Los usuarios con rol DRIVER aparecerán aquí automáticamente</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {drivers.map(driver => {
                            const driverActive = activeDeliveries.filter(o => o.driverId === driver.id);
                            const isOnDelivery = driverActive.length > 0;
                            return (
                                <div key={driver.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${
                                            isOnDelivery ? 'from-orange-400 to-orange-600' : 'from-blue-400 to-blue-600'
                                        }`}>
                                            {driver.fullName?.charAt(0)?.toUpperCase() || 'D'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{driver.fullName}</p>
                                            <p className="text-xs text-gray-500">{driver.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        {isOnDelivery ? (
                                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                                <Clock size={10} />
                                                {driverActive.length} entrega{driverActive.length > 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">
                                                Disponible
                                            </span>
                                        )}
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                            driver.isVerified
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {driver.isVerified ? 'Verificado' : 'Sin verificar'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
