import React, { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/adminService';
import { AuditLog } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Shield, Search, Download, Trash2, Calendar, User, Activity, FileText, ChevronRight, X, RotateCw, Filter, AlertCircle, Info } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { logger } from '../../utils/logger';
import MobileDrawer from '../../components/common/MobileDrawer';
import { Tooltip } from '../../components/common/Tooltip';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAdminTable } from '../../hooks/useAdminTable';
import { db } from '../../services/firebase';
import { collection, doc, getDoc, getCountFromServer } from 'firebase/firestore';
import { cacheService } from '../../services/cacheService';

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
    const [entityNames, setEntityNames] = useState<Record<string, string>>({});
    const [totalLogCount, setTotalLogCount] = useState(0);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const table = useAdminTable<AuditLog>({
        fetchFn: async (size, cursor, term) => {
            const result = await adminService.getAuditLogsPaginated(size, cursor);
            const newLogs = result.data as AuditLog[];
            await resolveEntityNames(newLogs);

            let filtered = newLogs;
            if (selectedCategory !== 'ALL') {
                const targetLabel = ACTION_CATEGORIES[selectedCategory].label;
                filtered = filtered.filter(log => getCategory(log.action).label === targetLabel);
            }
            if (dateRange.start || dateRange.end) {
                filtered = filtered.filter(log => {
                    let matchesDate = true;
                    const logDate = new Date(log.timestamp);
                    if (dateRange.start) matchesDate = matchesDate && logDate >= new Date(dateRange.start);
                    if (dateRange.end) {
                        const endDate = new Date(dateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        matchesDate = matchesDate && logDate <= endDate;
                    }
                    return matchesDate;
                });
            }
            if (term) {
                const low = term.toLowerCase();
                filtered = filtered.filter(log =>
                    log.action.toLowerCase().includes(low) ||
                    (entityNames[log.performedBy] || '').toLowerCase().includes(low) ||
                    (log.targetId && (entityNames[log.targetId] || '').toLowerCase().includes(low))
                );
            }

            return { ...result, data: filtered };
        },
        countFn: async () => {
            const logsRef = collection(db, 'audit_logs');
            const countSnap = await getCountFromServer(logsRef);
            setTotalLogCount(countSnap.data().count);
            return countSnap.data().count;
        },
        initialPageSize: 50,
        dependencies: [selectedCategory, dateRange]
    });

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
            case 'USER_UPDATED': {
                const changes = Object.keys(details).filter(k => !['updatedAt'].includes(k)).join(', ');
                return <span>Actualizó el perfil de {B(targetName, log.targetId)} ({changes})</span>;
            }
            case 'USER_CONVERTED': return <span>Convirtió la cuenta de invitado de {B(details.fullName || targetName, log.targetId)} en permanente</span>;
            case 'VENUE_CREATED': return <span>Creó la sede {B(targetName || details.name, log.targetId)}</span>;
            case 'VENUE_UPDATED': return <span>Modificó la configuración de {B(targetName, log.targetId)}</span>;
            case 'VENUE_DELETED': return <span>Eliminó la sede {B(targetName, log.targetId)}</span>;
            case 'CATEGORY_CREATED': return <span>Creó la categoría {B(details.name)}</span>;
            case 'CATEGORY_UPDATED': return <span>Actualizó la categoría {B(targetName, log.targetId)}</span>;
            case 'CATEGORY_DELETED': return <span>Eliminó la categoría {B(targetName, log.targetId)}</span>;
            case 'ORDER_STATUS_CHANGE': return <span>Cambió el estado del pedido {B(targetName, log.targetId)} a {B(details.status)}</span>;
            case 'LOGIN': {
                const method = details.method === 'google' ? 'Google' :
                    details.method === 'apple' ? 'Apple' :
                        details.method === 'facebook' ? 'Facebook' :
                            details.method === 'guest' ? 'Invitado' : 'Email';
                return <span>Inició sesión exitosamente vía {B(method)}</span>;
            }
            case 'LOGOUT': return <span>Cerró su sesión</span>;
            case 'SYSTEM_SEED_CATEGORIES': return <span>Cargó las etiquetas predeterminadas del sistema ({details.count} categorías)</span>;
            case 'SETTINGS_UPDATE': return <span>Modificó configuraciones globales</span>;
            default:
                if (log.targetCollection) return <span>Operación sobre {log.targetCollection}: {B(targetName || log.targetId || '', log.targetId)}</span>;
                return <span>{log.action} - {JSON.stringify(details)}</span>;
        }
    };

    const columns = [
        {
            header: 'Fecha',
            accessor: 'timestamp' as keyof any,
            sortable: true,
            render: (value: any, item: any) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-black text-gray-900 text-[11px] tracking-tight">{new Date(item.timestamp).toLocaleDateString()}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
            )
        },
        {
            header: 'Categoría',
            accessor: 'category' as keyof any,
            render: (value: any, item: any) => {
                const cat = getCategory(item.action);
                return (
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${cat.color}`}>
                        <span className="opacity-70">{cat.icon}</span>
                        {cat.label}
                    </span>
                );
            }
        },
        {
            header: 'Actor',
            accessor: 'actorName' as keyof any,
            render: (value: any, item: any) => {
                const name = entityNames[item.performedBy] || (item.performedBy.includes('@') ? item.performedBy : 'Usuario');
                return (
                    <div className="flex items-center gap-4 py-1">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-emerald-500/20 border-2 border-white">
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black text-gray-900 text-sm tracking-tight leading-none mb-1">
                                {name}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">
                                {item.metadata?.ip || item.ipAddress || 'IP: N/A'}
                            </span>
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Evento / Descripción',
            accessor: 'action' as keyof any,
            render: (value: any, item: any) => (
                <div className="text-gray-700 text-sm font-medium leading-relaxed max-w-md">
                    {generateHumanDescription(item)}
                </div>
            )
        }
    ];

    const renderDrawer = () => {
        if (!selectedLog) return null;

        return (
            <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedLog(null)}>
                <div className="w-full sm:max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto transform transition-transform animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <Activity className="text-emerald-600" size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Detalle del Evento</h3>
                        </div>
                        <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">ID del Evento</span>
                                <span className="font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 select-all text-xs">{selectedLog.id}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Fecha y Hora</span>
                                <span className="font-bold text-gray-800">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Categoría</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getCategory(selectedLog.action).color}`}>
                                    {getCategory(selectedLog.action).label}
                                </span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <User size={16} className="text-emerald-600" /> Actor y Origen
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Identidad</p>
                                    <p className="font-bold text-gray-900 truncate" title={entityNames[selectedLog.performedBy]}>
                                        {entityNames[selectedLog.performedBy] || selectedLog.performedBy}
                                    </p>
                                </div>
                                <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Dirección IP</p>
                                    <p className="font-mono font-bold text-gray-900">{selectedLog.metadata?.ip || 'N/A'}</p>
                                </div>
                                <div className="sm:col-span-2 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">User Agent / Dispositivo</p>
                                    <p className="font-mono text-xs text-gray-600 break-all leading-relaxed">{selectedLog.metadata?.userAgent || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {selectedLog.targetId && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                    <AlertCircle size={16} className="text-orange-500" /> Recurso Afectado
                                </h4>
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] text-gray-400 font-black uppercase">Colección</span>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-100 uppercase tracking-widest">{selectedLog.targetCollection}</span>
                                    </div>
                                    <p className="font-bold text-gray-900 text-lg">
                                        {entityNames[selectedLog.targetId] || selectedLog.targetId}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                <Info size={16} className="text-blue-500" /> Payload Técnico
                            </h4>
                            <div className="bg-slate-900 rounded-2xl p-5 overflow-x-auto border border-slate-800 shadow-2xl group relative">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(selectedLog.details, null, 2));
                                    }}
                                    className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Copiar JSON"
                                >
                                    <Download size={14} />
                                </button>
                                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (table.isLoading && table.data.length === 0) return <LoadingSpinner fullPage />;

    return (
        <div className="relative overflow-x-hidden flex flex-col gap-4 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mt-2 bg-gradient-to-br from-emerald-900/80 to-slate-900/90 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-emerald-600 rounded-[2rem] shadow-2xl shadow-emerald-500/40 active:scale-95 transition-all cursor-pointer border border-emerald-400/20">
                        <Shield className="text-white" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">Auditoría & Seguridad</h1>
                        <p className="text-[10px] text-emerald-400/80 font-black uppercase tracking-[0.4em] flex items-center gap-2">
                            <Activity size={10} className="fill-emerald-400 animate-pulse" />
                            Búnker de Seguridad · {totalLogCount} eventos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                    <button
                        onClick={() => table.reload()}
                        disabled={table.isLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white font-bold text-xs shadow-xl transition-all active:scale-95 disabled:opacity-50 group"
                    >
                        <RotateCw size={14} className={table.isLoading ? 'animate-spin' : 'transition-transform group-hover:rotate-180 duration-500'} />
                        Refrescar
                    </button>
                </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border border-gray-50 flex flex-col gap-8">
                <div className="flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <Calendar size={16} className="text-emerald-500" />
                            <h3 className="font-black text-gray-900 uppercase tracking-widest text-[10px] shrink-0">Filtrar por Fecha</h3>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-2.5 shadow-inner hover:bg-white transition-colors w-fit">
                            <input type="date" className="text-xs bg-transparent border-none focus:ring-0 text-gray-700 outline-none font-bold" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
                            <span className="text-gray-300 text-xs font-black">→</span>
                            <input type="date" className="text-xs bg-transparent border-none focus:ring-0 text-gray-700 outline-none font-bold" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setSelectedCategory('ALL')}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 ${selectedCategory === 'ALL' ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-105 z-10' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm hover:shadow-md'}`}
                        >
                            <span>Todas</span>
                        </button>
                        <div className="w-[2px] h-6 bg-gray-100 mx-2 shrink-0 rounded-full" />
                        {Object.entries(ACTION_CATEGORIES).map(([id, cat]) => (
                            <button
                                key={id}
                                onClick={() => setSelectedCategory(cat.label)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 ${selectedCategory === cat.label ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-105 z-10' : `bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm hover:shadow-md`}`}
                            >
                                <span className={selectedCategory === cat.label ? 'text-white' : 'opacity-70'}>{cat.icon}</span>
                                <span>{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar en logs cargados..."
                    isLoading={table.isLoading}
                    manualPagination
                    totalItems={table.totalItems}
                    currentPage={table.currentPage}
                    onPageChange={table.onPageChange}
                    onPageSizeChange={table.onPageSizeChange}
                    searchTerm={table.searchTerm}
                    onSearchChange={table.setSearchTerm}
                    isSearching={table.isSearching}
                    onRowClick={(log) => setSelectedLog(log)}
                    exportable
                    exportFilename="rescatto_audit_logs"
                    exportTransformer={(log) => {
                        const actorName = entityNames[log.performedBy] || log.performedBy;
                        const targetName = log.targetId ? (entityNames[log.targetId] || log.targetId) : '';
                        const category = getCategory(log.action).label;

                        return {
                            timestamp: new Date(log.timestamp).toLocaleString('es-CO'),
                            category,
                            action: log.action,
                            actor: actorName,
                            target: targetName,
                            ip: maskIp(log.metadata?.ip || '0.0.0.0'),
                            details: JSON.stringify(log.details || {})
                        };
                    }}
                />
            </div>

            {renderDrawer()}
        </div>
    );
};
