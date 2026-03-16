import React, { useEffect, useState, useMemo } from 'react';
import { AuditLogStats } from './AuditLogStats';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    startAfter,
    getCountFromServer
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AuditLog } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Shield, Search, Calendar, User, Activity, Trash2, Download, X, AlertCircle, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
import { cacheService } from '../../services/cacheService';
import { adminService } from '../../services/adminService';
import { logger } from '../../utils/logger';

// --- CONSTANTS ---

// 1. Action Categories (High Level)
const ACTION_CATEGORIES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    'USER': { label: 'Gestión Usuarios', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <User size={14} /> },
    'VENUE': { label: 'Gestión Negocios', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: <Activity size={14} /> },
    'ORDER': { label: 'Operaciones', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: <Calendar size={14} /> },
    'SYSTEM': { label: 'Sistema', color: 'bg-gray-50 text-gray-700 border-gray-100', icon: <Shield size={14} /> },
    'AUTH': { label: 'Seguridad', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <Shield size={14} /> },
    'DELETE': { label: 'Eliminar', color: 'bg-red-50 text-red-700 border-red-100', icon: <Trash2 size={14} /> },
};

const getCategory = (action: string) => {
    if (action.includes('DELETE')) return ACTION_CATEGORIES['DELETE'];
    if (action.includes('USER')) return ACTION_CATEGORIES['USER'];
    if (action.includes('VENUE')) return ACTION_CATEGORIES['VENUE'];
    if (action.includes('ORDER')) return ACTION_CATEGORIES['ORDER'];
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return ACTION_CATEGORIES['AUTH'];
    return ACTION_CATEGORIES['SYSTEM'];
};

const IGNORED_ACTIONS = ['SYSTEM_PING', 'BATCH_READ', 'AUTOMATED_TASK'];
const ENTITY_CACHE_KEY_PREFIX = 'audit_entity_';

// CSV Export Helpers
const toInitials = (name: string) =>
    name.split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3) || '???';

const maskIp = (ip: string) => {
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip.slice(0, 6) + '***';
};

const buildCSV = (logs: AuditLog[], entityNames: Record<string, string>, anonymize: boolean) => {
    const headers = ['Fecha', 'Hora', 'Categoría', 'Acción', 'Actor', 'Target', 'Detalles', 'IP'];
    const rows = logs.map(log => {
        const date = new Date(log.timestamp).toLocaleDateString();
        const time = new Date(log.timestamp).toLocaleTimeString();
        const category = getCategory(log.action).label;
        const actorFull = entityNames[log.performedBy] || log.performedBy;
        const targetFull = log.targetId ? (entityNames[log.targetId] || log.targetId) : '';
        const ip = log.metadata?.ip || '';
        const details = JSON.stringify(log.details || {}).replace(/,/g, ';').replace(/\n/g, ' ');

        const actor = anonymize ? toInitials(actorFull) : actorFull;
        const target = anonymize ? (targetFull ? toInitials(targetFull) : '') : targetFull;
        const maskedIp = anonymize ? (ip ? maskIp(ip) : '') : ip;

        return [date, time, category, log.action, actor, target, anonymize ? '' : details, maskedIp].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
};

const exportToCSV = (logs: AuditLog[], entityNames: Record<string, string>, anonymize = false) => {
    const csv = buildCSV(logs, entityNames, anonymize);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const suffix = anonymize ? '_anonimizado' : '';
    link.download = `rescatto_audit_logs${suffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
};

export const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [statsLogs, setStatsLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });

    // UI State
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Entity Cache
    const [entityNames, setEntityNames] = useState<Record<string, string>>({});

    const [totalLogCount, setTotalLogCount] = useState(0);

    // Fetch Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const logsRef = collection(db, 'audit_logs');
                const [snapshot, countSnap] = await Promise.all([
                    getDocs(query(logsRef, orderBy('timestamp', 'desc'), limit(20))),
                    getCountFromServer(logsRef),
                ]);
                const fetchedStatsLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[];
                setStatsLogs(fetchedStatsLogs);
                setTotalLogCount(countSnap.data().count);
            } catch (e) {
                logger.error("Error fetching stats logs", e);
            }
        };
        fetchStats();
    }, []);

    // Fetch Logs
    const fetchLogs = async (isNext = false) => {
        try {
            setLoading(true);
            const result = await adminService.getAuditLogsPaginated(50, isNext ? lastDoc : null);
            const newLogs = result.data as AuditLog[];

            await resolveEntityNames(newLogs);

            if (isNext) {
                setLogs(prev => [...prev, ...newLogs]);
            } else {
                setLogs(newLogs);
            }

            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (error) {
            logger.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const resolveEntityNames = async (logsToResolve: AuditLog[]) => {
        const uniqueIds = new Set<string>();
        const idToCollection: Record<string, string> = {};

        logsToResolve.forEach(log => {
            if (log.performedBy && !log.performedBy.includes('@')) {
                uniqueIds.add(log.performedBy);
                idToCollection[log.performedBy] = 'users';
            }
            if (log.targetId && log.targetCollection) {
                uniqueIds.add(log.targetId);
                idToCollection[log.targetId] = log.targetCollection as string;
            }
        });

        const newNames: Record<string, string> = {};
        await Promise.all(Array.from(uniqueIds).map(async (id) => {
            if (entityNames[id]) return;

            // Check Cache
            const cached = cacheService.get<string>(ENTITY_CACHE_KEY_PREFIX + id);
            if (cached) {
                newNames[id] = cached;
                return;
            }

            // Fetch
            try {
                const collectionName = idToCollection[id];
                if (!collectionName) return;

                const docRef = doc(db, collectionName, id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let name = 'Desconocido';
                    const data = docSnap.data();

                    if (collectionName === 'users') name = data.fullName || data.email;
                    else if (collectionName === 'venues') name = data.name;
                    else if (collectionName === 'products') name = data.name;
                    else if (collectionName === 'orders') name = `Pedido #${id.slice(-6)}`;

                    newNames[id] = name;
                    cacheService.set(ENTITY_CACHE_KEY_PREFIX + id, name, 60);
                } else {
                    newNames[id] = `${collectionName === 'users' ? 'Usuario' : 'Item'} ${id.substring(0, 6)}...`;
                    cacheService.set(ENTITY_CACHE_KEY_PREFIX + id, newNames[id], 60);
                }
            } catch (e) {
                logger.error(`Error resolving ${id}`, e);
                newNames[id] = 'Error de Carga';
            }
        }));

        setEntityNames(prev => ({ ...prev, ...newNames }));
    };

    const generateHumanDescription = (log: AuditLog) => {
        const actorName = entityNames[log.performedBy] || (log.performedBy.includes('@') ? log.performedBy : 'Usuario');
        const targetName = log.targetId ? (entityNames[log.targetId] || log.targetId) : '';
        const details = log.details || {};

        const B = (text: string, fullId?: string) => (
            <span className="font-bold text-gray-900 cursor-help border-b border-dotted border-gray-400" title={fullId || text}>
                {text}
            </span>
        );

        switch (log.action) {
            case 'USER_VERIFIED': return <span>Verificó la identidad de {B(targetName, log.targetId)}</span>;
            case 'USER_CREATED': return <span>Registró al nuevo usuario {B(targetName, log.targetId)}</span>;
            case 'USER_UPDATED':
                const changes = Object.keys(details).filter(k => !['updatedAt'].includes(k)).join(', ');
                return <span>Actualizó el perfil de {B(targetName, log.targetId)} ({changes})</span>;
            case 'USER_CONVERTED': return <span>Convirtió la cuenta de invitado de {B(details.fullName || targetName, log.targetId)} en permanente</span>;
            case 'VENUE_CREATED': return <span>Creó la sede {B(targetName || details.name, log.targetId)}</span>;
            case 'VENUE_UPDATED': return <span>Modificó la configuración de {B(targetName, log.targetId)}</span>;
            case 'VENUE_DELETED': return <span>Eliminó la sede {B(targetName, log.targetId)}</span>;
            case 'CATEGORY_CREATED': return <span>Creó la categoría {B(details.name)}</span>;
            case 'CATEGORY_UPDATED': return <span>Actualizó la categoría {B(targetName, log.targetId)}</span>;
            case 'CATEGORY_DELETED': return <span>Eliminó la categoría {B(targetName, log.targetId)}</span>;
            case 'ORDER_STATUS_CHANGE': return <span>Cambió el estado del pedido {B(targetName, log.targetId)} a {B(details.status)}</span>;
            case 'LOGIN':
                const method = details.method === 'google' ? 'Google' :
                               details.method === 'apple' ? 'Apple' :
                               details.method === 'facebook' ? 'Facebook' :
                               details.method === 'guest' ? 'Invitado' : 'Email';
                return <span>Inició sesión exitosamente vía {B(method)}</span>;
            case 'LOGOUT': return <span>Cerró su sesión</span>;
            case 'SYSTEM_SEED_CATEGORIES': return <span>Cargó las etiquetas predeterminadas del sistema ({details.count} categorías)</span>;
            case 'SETTINGS_UPDATE': return <span>Modificó configuraciones globales</span>;
            default:
                if (log.targetCollection) return <span>Operación sobre {log.targetCollection}: {B(targetName || log.targetId || '', log.targetId)}</span>;
                return <span>{log.action} - {JSON.stringify(details)}</span>;
        }
    };

    const filteredLogs = useMemo(() => logs.filter(log => {
        if (IGNORED_ACTIONS.includes(log.action)) return false;
        const searchLower = searchTerm.toLowerCase();
        const actor = entityNames[log.performedBy] || log.performedBy;
        const target = entityNames[log.targetId || ''] || '';
        const matchesSearch =
            actor.toLowerCase().includes(searchLower) ||
            target.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower);
        const matchesCategory = selectedCategory === 'ALL' || getCategory(log.action).label === selectedCategory;
        let matchesDate = true;
        if (dateRange.start) matchesDate = matchesDate && new Date(log.timestamp) >= new Date(dateRange.start);
        if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && new Date(log.timestamp) <= endDate;
        }
        return matchesSearch && matchesCategory && matchesDate;
    }), [logs, searchTerm, entityNames, selectedCategory, dateRange]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedLogs = filteredLogs.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filteredLogs.length > 0 && filteredLogs.length % pageSize === 0;

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) {
            await fetchLogs(true);
        }
        setCurrentPage(target);
    };

    const handlePageSizeChange = (size: number) => { setPageSize(size); setCurrentPage(1); };

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

    const renderDrawer = () => {
        if (!selectedLog) return null;

        return (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedLog(null)}>
                <div className="w-full sm:max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto transform transition-transform animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="text-emerald-600" />
                            Detalle del Evento
                        </h3>
                        <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Meta Header */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">ID del Evento</span>
                                <span className="font-mono text-gray-700 select-all">{selectedLog.id}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Fecha</span>
                                <span className="font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Categoría</span>
                                <span className={`px-2 py-0.5 rounded text-xs border ${getCategory(selectedLog.action).color}`}>
                                    {getCategory(selectedLog.action).label}
                                </span>
                            </div>
                        </div>

                        {/* Actor & Metadata */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <User size={16} /> Actor y Origen
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <p className="text-xs text-gray-500 mb-1">Usuario</p>
                                    <p className="font-medium truncate" title={entityNames[selectedLog.performedBy]}>
                                        {entityNames[selectedLog.performedBy] || selectedLog.performedBy}
                                    </p>
                                </div>
                                <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <p className="text-xs text-gray-500 mb-1">Dirección IP</p>
                                    <p className="font-mono">{selectedLog.metadata?.ip || 'N/A'}</p>
                                </div>
                                <div className="sm:col-span-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <p className="text-xs text-gray-500 mb-1">User Agent / Dispositivo</p>
                                    <p className="font-mono text-xs text-gray-600 break-all">{selectedLog.metadata?.userAgent || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Target Information */}
                        {selectedLog.targetId && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <AlertCircle size={16} /> Recurso Afectado
                                </h4>
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm shadow-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-gray-500 text-xs">Colección</span>
                                        <span className="font-mono text-xs text-emerald-600">{selectedLog.targetCollection}</span>
                                    </div>
                                    <p className="font-medium">
                                        {entityNames[selectedLog.targetId] || selectedLog.targetId}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Technical Details JSON */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Info size={16} /> Payload Técnico
                            </h4>
                            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-800 shadow-inner">
                                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading && logs.length === 0) return <LoadingSpinner fullPage />;

    return (
        <div className="p-8 max-w-7xl mx-auto relative overflow-x-hidden">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Centro de Auditoría</h1>
                <p className="text-gray-400 mt-2">Monitoreo forense y control de seguridad en tiempo real.</p>
            </div>

            {/* STATS & CHARTS */}
            <AuditLogStats logs={statsLogs} totalCount={totalLogCount} />

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                {/* Table Header */}
                <div className="p-4 border-b bg-gray-50 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-800 shrink-0">Registros de Auditoría</h3>
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 xl:w-72">
                            <Search className="text-gray-400 shrink-0" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar actor, acción, ID..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="text-sm py-2 px-3 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-emerald-400"
                        >
                            <option value="ALL">Todas las Categorías</option>
                            {Object.values(ACTION_CATEGORIES).map(cat => (
                                <option key={cat.label} value={cat.label}>{cat.label}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                            <input type="date" className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 outline-none" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} title="Desde" />
                            <span className="text-gray-400 text-xs">—</span>
                            <input type="date" className="text-sm bg-transparent border-none focus:ring-0 text-gray-600 outline-none" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} title="Hasta" />
                        </div>
                        <button onClick={() => exportToCSV(filteredLogs, entityNames, false)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium rounded-lg hover:bg-emerald-100 transition text-sm" title="Exportar con datos completos">
                            <Download size={14} /><span>CSV</span>
                        </button>
                        <button onClick={() => exportToCSV(filteredLogs, entityNames, true)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition text-sm" title="IPs parciales, nombres como iniciales">
                            <Download size={14} /><span>Anonimizado</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4 w-40 text-left">Fecha</th>
                                <th className="p-4 w-48 text-left">Categoría</th>
                                <th className="p-4 w-56 text-left">Actor (Quién)</th>
                                <th className="p-4 text-left">Evento (Qué pasó)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                                        <div className="bg-gray-50 p-4 rounded-full">
                                            <Search size={24} className="opacity-50" />
                                        </div>
                                        <span>No hay actividad relevante registrada</span>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => {
                                    const category = getCategory(log.action);
                                    const actorName = entityNames[log.performedBy] || (log.performedBy.includes('@') ? log.performedBy : 'Usuario');

                                    return (
                                        <tr key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className="hover:bg-emerald-50/30 transition-colors group cursor-pointer border-l-4 border-l-transparent hover:border-l-emerald-500"
                                        >
                                            <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                                                <div className="font-medium text-gray-700">
                                                    {new Date(log.timestamp).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] opacity-70">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${category.color}`}>
                                                    {category.icon}
                                                    {category.label}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
                                                        {actorName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900 text-sm truncate max-w-[180px]" title={actorName}>
                                                            {actorName}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {log.metadata?.ip ? `IP: ${log.metadata.ip}` : (log.ipAddress || 'IP: N/A')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 text-sm leading-relaxed">
                                                {generateHumanDescription(log)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredLogs.length > 0 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <p className="text-xs text-gray-500">
                                {loading ? 'Cargando...' : <>Mostrando <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredLogs.length)}</span> de <span className="font-semibold text-gray-700">{filteredLogs.length}{hasMore ? '+' : ''}</span></>}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">Filas:</span>
                                <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-emerald-400">
                                    {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => goToPage(1)} disabled={safePage === 1 || loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsLeft size={15} /></button>
                            <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1 || loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={15} /></button>
                            {getPageNumbers().map((page, idx) =>
                                page === '...' ? <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm">…</span> : (
                                    <button key={page} onClick={() => goToPage(page as number)} disabled={loading} className={`min-w-[30px] h-7 px-2 rounded-lg text-xs font-medium transition-colors ${page === safePage ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>{page}</button>
                                )
                            )}
                            <button onClick={() => goToPage(safePage + 1)} disabled={(safePage >= totalPages && !hasMore) || loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={15} /></button>
                            <button onClick={() => goToPage(totalPages)} disabled={(safePage >= totalPages && !hasMore) || loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsRight size={15} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* DRAWER COMPONENT */}
            {renderDrawer()}
        </div>
    );
};
