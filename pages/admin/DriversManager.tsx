import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { adminService } from '../../services/adminService';
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
    Phone, MapPin, Package, DollarSign, Eye, UserCheck, UserX, X, ChevronDown
} from 'lucide-react';

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

    const [drivers, setDrivers] = useState<DriverRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'unverified'>('all');
    const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [page, setPage] = useState(0);

    const loadDrivers = useCallback(async (initial = false) => {
        if (initial) {
            setLoading(true);
            setDrivers([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const usersRef = collection(db, 'users');
            let q = query(usersRef, where('role', '==', UserRole.DRIVER), limit(PAGE_SIZE));
            if (!initial && lastDoc) {
                q = query(usersRef, where('role', '==', UserRole.DRIVER), startAfter(lastDoc), limit(PAGE_SIZE));
            }
            const snap = await getDocs(q);
            const driverUsers = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
            const newLastDoc = snap.docs[snap.docs.length - 1] ?? null;

            // Load order stats for each driver in this page
            const driverRows = await Promise.all(driverUsers.map(fetchDriverStats));

            // Sort: active first, then by total deliveries desc
            driverRows.sort((a, b) => {
                if (b.activeDeliveries !== a.activeDeliveries) return b.activeDeliveries - a.activeDeliveries;
                return b.totalDeliveries - a.totalDeliveries;
            });

            if (initial) setDrivers(driverRows);
            else setDrivers(prev => [...prev, ...driverRows]);

            setLastDoc(newLastDoc);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch (err) {
            logger.error('Error cargando conductores:', err);
            toast.error('Error al cargar conductores');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [lastDoc]);

    useEffect(() => { loadDrivers(true); }, []);

    const filtered = useMemo(() => {
        let list = drivers;
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(d =>
                d.fullName?.toLowerCase().includes(q) ||
                d.email?.toLowerCase().includes(q) ||
                d.phone?.toLowerCase().includes(q) ||
                d.city?.toLowerCase().includes(q)
            );
        }
        if (filterStatus === 'verified') list = list.filter(d => d.isVerified);
        if (filterStatus === 'unverified') list = list.filter(d => !d.isVerified);
        return list;
    }, [drivers, searchTerm, filterStatus]);

    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

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
            setDrivers(prev =>
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
        total: drivers.length,
        verified: drivers.filter(d => d.isVerified).length,
        active: drivers.filter(d => d.activeDeliveries > 0).length,
        totalDeliveries: drivers.reduce((s, d) => s + d.totalDeliveries, 0),
        totalEarnings: drivers.reduce((s, d) => s + d.totalEarnings, 0),
    }), [drivers]);

    if (loading) return (
        <div className="flex justify-center items-center h-96">
            <LoadingSpinner />
        </div>
    );

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
                        <Truck className="text-emerald-600" size={28} />
                        Conductores
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {drivers.length}{hasMore ? '+' : ''} conductores cargados
                    </p>
                </div>
                <button
                    onClick={() => loadDrivers(true)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={16} />
                    Actualizar
                </button>
            </div>

            {/* Stats Cards */}
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

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="search"
                        placeholder="Buscar por nombre, email, ciudad..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'verified', 'unverified'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => { setFilterStatus(f); setPage(0); }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            {f === 'all' ? 'Todos' : f === 'verified' ? 'Verificados' : 'Sin verificar'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table — desktop */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Conductor</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Ciudad</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Estado</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Entregas</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Activas</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Ganancias</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wide">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-gray-400">
                                        <Truck size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-medium">No se encontraron conductores</p>
                                    </td>
                                </tr>
                            ) : paginated.map(driver => (
                                <tr key={driver.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                                                {driver.avatarUrl
                                                    ? <img src={driver.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                    : driver.fullName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{driver.fullName}</p>
                                                <p className="text-xs text-gray-400 truncate">{driver.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{driver.city || '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        {driver.isVerified
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><CheckCircle size={11} />Verificado</span>
                                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><XCircle size={11} />Pendiente</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{driver.totalDeliveries}</td>
                                    <td className="px-4 py-3 text-right">
                                        {driver.activeDeliveries > 0
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold animate-pulse">{driver.activeDeliveries} activa{driver.activeDeliveries > 1 ? 's' : ''}</span>
                                            : <span className="text-gray-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-700 font-semibold">{formatCOP(driver.totalEarnings)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openDetail(driver)}
                                                title="Ver detalle"
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                            >
                                                <Eye size={15} />
                                            </button>
                                            {driver.isVerified
                                                ? <button onClick={() => handleVerify(driver, false)} title="Quitar verificación" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><UserX size={15} /></button>
                                                : <button onClick={() => handleVerify(driver, true)} title="Verificar conductor" className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"><UserCheck size={15} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (client-side) + Load more (server-side) */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 gap-3 flex-wrap">
                    <span className="text-xs text-gray-500">
                        {filtered.length === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}`} de {filtered.length}{hasMore ? '+' : ''} cargados
                    </span>
                    <div className="flex gap-2">
                        {totalPages > 1 && (
                            <>
                                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">Anterior</button>
                                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors">Siguiente</button>
                            </>
                        )}
                        {hasMore && (
                            <button
                                onClick={() => loadDrivers(false)}
                                disabled={loadingMore}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? <RefreshCw size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                                {loadingMore ? 'Cargando...' : 'Cargar más'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Cards — mobile */}
            <div className="md:hidden space-y-3">
                {paginated.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Truck size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No se encontraron conductores</p>
                    </div>
                ) : paginated.map(driver => (
                    <div key={driver.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                                    {driver.avatarUrl
                                        ? <img src={driver.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        : driver.fullName?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{driver.fullName}</p>
                                    <p className="text-xs text-gray-400 truncate">{driver.email}</p>
                                </div>
                            </div>
                            {driver.isVerified
                                ? <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"><CheckCircle size={10} />Verificado</span>
                                : <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold"><XCircle size={10} />Pendiente</span>}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                            <div className="bg-gray-50 rounded-xl p-2">
                                <p className="text-xs text-gray-500">Entregas</p>
                                <p className="font-extrabold text-gray-800">{driver.totalDeliveries}</p>
                            </div>
                            <div className={`rounded-xl p-2 ${driver.activeDeliveries > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <p className="text-xs text-gray-500">Activas</p>
                                <p className={`font-extrabold ${driver.activeDeliveries > 0 ? 'text-blue-700' : 'text-gray-800'}`}>{driver.activeDeliveries}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-2">
                                <p className="text-xs text-gray-500">Ciudad</p>
                                <p className="font-bold text-gray-700 text-xs truncate">{driver.city || '—'}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => openDetail(driver)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors active:scale-95">
                                <Eye size={13} /> Ver detalle
                            </button>
                            {driver.isVerified
                                ? <button onClick={() => handleVerify(driver, false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors active:scale-95"><UserX size={13} /> Quitar</button>
                                : <button onClick={() => handleVerify(driver, true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors active:scale-95"><UserCheck size={13} /> Verificar</button>}
                        </div>
                    </div>
                ))}

                <div className="flex flex-wrap gap-2 justify-center pt-2">
                    {totalPages > 1 && (
                        <>
                            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 disabled:opacity-40">Anterior</button>
                            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 disabled:opacity-40">Siguiente</button>
                        </>
                    )}
                    {hasMore && (
                        <button
                            onClick={() => loadDrivers(false)}
                            disabled={loadingMore}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                            {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                            {loadingMore ? 'Cargando...' : 'Cargar más'}
                        </button>
                    )}
                </div>
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
