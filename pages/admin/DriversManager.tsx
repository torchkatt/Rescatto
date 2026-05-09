import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { useAdminTable } from '../../hooks/useAdminTable';
import { User, UserRole, OrderStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import MobileDrawer from '../../components/common/MobileDrawer';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { 
    Truck, Search, RefreshCw, CheckCircle, XCircle, Star, 
    Phone, MapPin, Package, DollarSign, Eye, UserCheck, UserX, ChevronDown, RotateCw
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DataTable, Column } from '../../components/common/DataTable';

interface DriverRow extends User {
    totalDeliveries: number;
    totalEarnings: number;
    activeDeliveries: number;
    avgRating?: number;
}

const PAGE_SIZE = 20;

async function fetchDriverStats(driverUser: User): Promise<DriverRow> {
    try {
        const ordersRef = collection(db, 'orders');
        const snap = await getDocs(query(ordersRef, where('driverId', '==', driverUser.id)));
        const orders = snap.docs.map(d => d.data());
        const completed = orders.filter(o => o.status === OrderStatus.COMPLETED);
        const active = orders.filter(o =>
            o.status === OrderStatus.DRIVER_ASSIGNED || o.status === OrderStatus.IN_TRANSIT
        );
        return {
            ...driverUser,
            totalDeliveries: completed.length,
            totalEarnings: completed.reduce((s, o) => s + (o.deliveryFee || 0), 0),
            activeDeliveries: active.length,
        };
    } catch {
        return { ...driverUser, totalDeliveries: 0, totalEarnings: 0, activeDeliveries: 0 };
    }
}

export const DriversManager: React.FC = () => {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'unverified'>('all');
    const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const table = useAdminTable<DriverRow>({
        fetchFn: async (size, cursor, term) => {
            const result = await adminService.getDriversPaginated(size, cursor, term);
            const enriched = await Promise.all(result.data.map(fetchDriverStats));
            
            // Apply status filter if searching (since getDriversPaginated doesn't handle status filter yet)
            let data = enriched;
            if (filterStatus === 'verified') data = data.filter(d => d.isVerified);
            if (filterStatus === 'unverified') data = data.filter(d => !d.isVerified);
            
            return { ...result, data };
        },
        countFn: () => adminService.getDriversCount(),
        initialPageSize: 20,
        dependencies: [filterStatus]
    });

    const handleVerify = async (driver: DriverRow, verify: boolean) => {
        if (!currentUser) return;
        const confirmed = await confirm({
            title: verify ? 'Verificar conductor' : 'Quitar verificación',
            message: verify
                ? `¿Verificar a ${driver.fullName}? Esto le permite operar como conductor activo.`
                : `¿Quitar verificación de ${driver.fullName}?`,
            confirmLabel: verify ? 'Verificar' : 'Quitar',
            variant: verify ? 'info' : 'warning',
        });
        if (!confirmed) return;
        try {
            await adminService.verifyUser(driver.id, verify, currentUser.id);
            toast.success(verify ? 'Conductor verificado' : 'Verificación removida');
            table.setData(prev =>
                prev.map(d => d.id === driver.id ? { ...d, isVerified: verify } : d)
            );
            if (selectedDriver?.id === driver.id) {
                setSelectedDriver(prev => prev ? { ...prev, isVerified: verify } : prev);
            }
        } catch (err) {
            logger.error('Error verificando conductor:', err);
            toast.error('Error al actualizar estado del conductor');
        }
    };

    const openDetail = (driver: DriverRow) => {
        setSelectedDriver(driver);
        setDrawerOpen(true);
    };

    const totalStats = useMemo(() => ({
        total: table.data.length,
        verified: table.data.filter(d => d.isVerified).length,
        active: table.data.filter(d => d.activeDeliveries > 0).length,
        totalDeliveries: table.data.reduce((s, d) => s + d.totalDeliveries, 0),
        totalEarnings: table.data.reduce((s, d) => s + d.totalEarnings, 0),
    }), [table.data]);

    if (table.isLoading && table.data.length === 0) return (
        <div className="flex justify-center items-center h-96">
            <LoadingSpinner />
        </div>
    );

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
                        <Truck className="text-emerald-600" size={28} />
                        Conductores
                    </h1>
                </div>
                <button
                    onClick={() => table.reload()}
                    disabled={table.isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={16} />
                    Actualizar
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Total', value: totalStats.total, icon: <Truck size={16} />, color: 'bg-gray-100 text-gray-700' },
                    { label: 'Verificados', value: totalStats.verified, icon: <CheckCircle size={16} />, color: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Activos ahora', value: totalStats.active, icon: <Package size={16} />, color: 'bg-blue-50 text-blue-700' },
                    { label: 'Entregas totales', value: totalStats.totalDeliveries, icon: <Star size={16} />, color: 'bg-purple-50 text-purple-700' },
                    { label: 'Ganancias pagadas', value: formatCOP(totalStats.totalEarnings), icon: <DollarSign size={16} />, color: 'bg-amber-50 text-amber-700' },
                ].map(stat => (
                    <div key={stat.label} className={`rounded-xl p-3 ${stat.color} border border-current/10`}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                            {stat.icon}
                            <span className="text-[10px] font-bold uppercase tracking-wide">{stat.label}</span>
                        </div>
                        <p className="text-lg font-extrabold">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="search"
                        placeholder="Buscar por nombre, email, ciudad..."
                        value={table.searchTerm}
                        onChange={e => table.setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                    />
                </div>
                <div className="flex gap-2">
                    {['all', 'verified', 'unverified'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as any)}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                filterStatus === status
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-105 z-10'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm'
                            }`}
                        >
                            {status === 'all' ? 'Todos' : status === 'verified' ? 'Verificados' : 'Pendientes'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
                <DataTable
                    columns={[
                        {
                            header: 'Conductor',
                            accessor: 'fullName' as keyof DriverRow,
                            sortable: true,
                            render: (value: string, driver: DriverRow) => (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden shadow-lg shadow-emerald-500/20">
                                        {driver.avatarUrl
                                            ? <img src={driver.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            : value?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">{value}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{driver.email}</span>
                                    </div>
                                </div>
                            )
                        },
                        {
                            header: 'Ciudad',
                            accessor: 'city' as keyof DriverRow,
                            sortable: true,
                            className: 'hidden sm:table-cell font-medium text-gray-600'
                        },
                        {
                            header: 'Estado',
                            accessor: 'isVerified' as keyof DriverRow,
                            sortable: true,
                            render: (value: boolean) => value
                                ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100"><CheckCircle size={12} />Verificado</span>
                                : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-100"><XCircle size={12} />Pendiente</span>
                        },
                        {
                            header: 'Entregas',
                            accessor: 'totalDeliveries' as keyof DriverRow,
                            sortable: true,
                            className: 'text-right font-black text-gray-700'
                        },
                        {
                            header: 'Activas',
                            accessor: 'activeDeliveries' as keyof DriverRow,
                            sortable: true,
                            className: 'text-right',
                            render: (value: number) => value > 0
                                ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest animate-pulse border border-blue-100">{value} Activa{value > 1 ? 's' : ''}</span>
                                : <span className="text-gray-300 font-medium">—</span>
                        },
                        {
                            header: 'Ganancias',
                            accessor: 'totalEarnings' as keyof DriverRow,
                            sortable: true,
                            className: 'text-right font-black text-emerald-600',
                            render: (value: number) => formatCOP(value)
                        },
                        {
                            header: 'Acciones',
                            accessor: 'id' as keyof DriverRow,
                            className: 'text-right',
                            render: (id: string, driver: DriverRow) => (
                                <div className="flex justify-end gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openDetail(driver); }}
                                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    {driver.isVerified
                                        ? <button onClick={(e) => { e.stopPropagation(); handleVerify(driver, false); }} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"><UserX size={18} /></button>
                                        : <button onClick={(e) => { e.stopPropagation(); handleVerify(driver, true); }} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"><UserCheck size={18} /></button>}
                                </div>
                            )
                        }
                    ]}
                    data={table.data}
                    placeholder="Buscar por nombre, email, ciudad..."
                    initialPageSize={table.pageSize}
                    manualPagination
                    totalItems={table.totalItems}
                    currentPage={table.currentPage}
                    onPageChange={table.onPageChange}
                    onPageSizeChange={table.onPageSizeChange}
                    searchTerm={table.searchTerm}
                    onSearchChange={table.setSearchTerm}
                    isSearching={table.isSearching}
                    isLoading={table.isLoading}
                    onRowClick={(item) => openDetail(item)}
                    exportable
                    exportFilename="rescatto_conductores"
                    exportTransformer={(d) => ({
                        fullName: d.fullName || '',
                        email: d.email || '',
                        city: d.city || '',
                        isVerified: d.isVerified ? 'Verificado' : 'Pendiente',
                        totalDeliveries: d.totalDeliveries,
                        totalEarnings: d.totalEarnings,
                        activeDeliveries: d.activeDeliveries
                    })}
                />
            </div>



            {/* Detail Drawer */}
            <MobileDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={selectedDriver?.fullName || 'Conductor'}
            >
                {selectedDriver && (
                    <div className="space-y-5 p-1">
                        {/* Avatar + estado */}
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-extrabold text-2xl shrink-0 overflow-hidden">
                                {selectedDriver.avatarUrl
                                    ? <img src={selectedDriver.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    : selectedDriver.fullName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-extrabold text-lg text-gray-900">{selectedDriver.fullName}</h3>
                                <p className="text-sm text-gray-500">{selectedDriver.email}</p>
                                <div className="mt-1">
                                    {selectedDriver.isVerified
                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><CheckCircle size={11} />Conductor verificado</span>
                                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><XCircle size={11} />Pendiente de verificación</span>}
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="space-y-2">
                            {[
                                { icon: <Phone size={14} />, label: 'Teléfono', value: selectedDriver.phone || 'No registrado' },
                                { icon: <MapPin size={14} />, label: 'Ciudad', value: selectedDriver.city || 'No registrada' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                                    <span className="text-gray-400">{item.icon}</span>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{item.label}</p>
                                        <p className="text-sm font-semibold text-gray-700">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                <Package size={18} className="mx-auto text-emerald-600 mb-1" />
                                <p className="text-2xl font-extrabold text-emerald-700">{selectedDriver.totalDeliveries}</p>
                                <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Completadas</p>
                            </div>
                            <div className={`rounded-xl p-3 text-center ${selectedDriver.activeDeliveries > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <Truck size={18} className={`mx-auto mb-1 ${selectedDriver.activeDeliveries > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                <p className={`text-2xl font-extrabold ${selectedDriver.activeDeliveries > 0 ? 'text-blue-700' : 'text-gray-500'}`}>{selectedDriver.activeDeliveries}</p>
                                <p className={`text-[10px] font-semibold uppercase tracking-wide ${selectedDriver.activeDeliveries > 0 ? 'text-blue-600' : 'text-gray-400'}`}>En curso</p>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <DollarSign size={18} className="mx-auto text-amber-600 mb-1" />
                                <p className="text-sm font-extrabold text-amber-700">{formatCOP(selectedDriver.totalEarnings)}</p>
                                <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">Ganado</p>
                            </div>
                        </div>

                        {/* Miembro desde */}
                        {selectedDriver.createdAt && (
                            <p className="text-xs text-gray-400 text-center">
                                Miembro desde {new Date(selectedDriver.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        )}

                        {/* Acción */}
                        <div className="pt-2">
                            {selectedDriver.isVerified ? (
                                <button
                                    onClick={() => handleVerify(selectedDriver, false)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors active:scale-95"
                                >
                                    <UserX size={16} /> Quitar verificación
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleVerify(selectedDriver, true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors active:scale-95"
                                >
                                    <UserCheck size={16} /> Verificar conductor
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </MobileDrawer>
        </div>
    );
};

export default DriversManager;
