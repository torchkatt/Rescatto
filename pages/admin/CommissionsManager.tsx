import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { Venue } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import {
    Landmark, Search, AlertTriangle, CheckCircle, TrendingDown,
    RefreshCw, X, ChevronLeft, ChevronRight
} from 'lucide-react';

interface WalletRow {
    venueId: string;
    venueName: string;
    city: string;
    balance: number;
    updatedAt: string;
}

type FilterTab = 'all' | 'debt' | 'credit' | 'settled';

const PAGE_SIZE = 20;

export const CommissionsManager: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [rows, setRows] = useState<WalletRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);

    // Modal state
    const [modalVenue, setModalVenue] = useState<WalletRow | null>(null);
    const [settlementType, setSettlementType] = useState<'DEBT_PAYMENT' | 'PAYOUT'>('DEBT_PAYMENT');
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementDesc, setSettlementDesc] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [venues, wallets] = await Promise.all([
                adminService.getAllVenues(true),
                adminService.getAllWallets(),
            ]);

            const venueMap = new Map<string, Venue>(venues.map(v => [v.id!, v]));

            // Include every venue (with or without wallet)
            const allRows: WalletRow[] = venues.map(v => {
                const w = wallets.find(wallet => wallet.venueId === v.id);
                return {
                    venueId: v.id!,
                    venueName: v.name,
                    city: v.city || '—',
                    balance: w?.balance ?? 0,
                    updatedAt: w?.updatedAt ?? '',
                };
            });

            // Sort by most debt first
            allRows.sort((a, b) => a.balance - b.balance);
            setRows(allRows);
        } catch (e) {
            logger.error('Error cargando billeteras', e);
            toast.error('Error cargando datos de comisiones');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // loadData no tiene dependencias que cambien — también se usa en el botón de refresh y en handleSettle
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        let list = rows;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r => r.venueName.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
        }
        if (filterTab === 'debt') list = list.filter(r => r.balance < 0);
        if (filterTab === 'credit') list = list.filter(r => r.balance > 0);
        if (filterTab === 'settled') list = list.filter(r => r.balance === 0);
        return list;
    }, [rows, searchTerm, filterTab]);

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    const summary = useMemo(() => {
        const debtRows = rows.filter(r => r.balance < 0);
        const creditRows = rows.filter(r => r.balance > 0);
        return {
            totalDebt: debtRows.reduce((s, r) => s + Math.abs(r.balance), 0),
            totalCredit: creditRows.reduce((s, r) => s + r.balance, 0),
            debtCount: debtRows.length,
            creditCount: creditRows.length,
            settledCount: rows.filter(r => r.balance === 0).length,
        };
    }, [rows]);

    const handleSettle = async () => {
        if (!modalVenue) return;
        const amt = parseFloat(settlementAmount.replace(/[^0-9.]/g, ''));
        if (!amt || amt <= 0) { toast.error('Ingresa un monto válido'); return; }
        if (!settlementDesc.trim()) { toast.error('Agrega una descripción'); return; }
        setSaving(true);
        try {
            await adminService.recordSettlement({
                venueId: modalVenue.venueId,
                amount: amt,
                type: settlementType,
                description: settlementDesc.trim(),
            });
            toast.success('Movimiento registrado correctamente');
            setModalVenue(null);
            setSettlementAmount('');
            setSettlementDesc('');
            await loadData();
        } catch (e: any) {
            logger.error('Error registrando pago', e);
            toast.error(e?.message || 'Error al registrar el movimiento');
        } finally {
            setSaving(false);
        }
    };

    const statusBadge = (balance: number) => {
        if (balance < 0) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                <AlertTriangle size={11} /> En Deuda
            </span>
        );
        if (balance > 0) return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                <TrendingDown size={11} /> Rescatto Debe
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle size={11} /> Al Día
            </span>
        );
    };

    const tabs: { key: FilterTab; label: string; count: number }[] = [
        { key: 'all', label: 'Todos', count: rows.length },
        { key: 'debt', label: 'En Deuda', count: summary.debtCount },
        { key: 'credit', label: 'Rescatto Debe', count: summary.creditCount },
        { key: 'settled', label: 'Al Día', count: summary.settledCount },
    ];

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Landmark className="text-emerald-400" />
                    Comisiones y Deudas
                </h2>
                <button
                    onClick={loadData}
                    className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
                    title="Refrescar"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Deuda Total de Negocios</p>
                    <p className="text-2xl font-bold text-red-600">{formatCOP(summary.totalDebt)}</p>
                    <p className="text-xs text-gray-400 mt-1">{summary.debtCount} negocio(s) con saldo negativo</p>
                </div>
                <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Rescatto Debe a Negocios</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCOP(summary.totalCredit)}</p>
                    <p className="text-xs text-gray-400 mt-1">{summary.creditCount} negocio(s) con saldo a favor</p>
                </div>
                <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Al Día</p>
                    <p className="text-2xl font-bold text-emerald-600">{summary.settledCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Negocios sin saldo pendiente</p>
                </div>
            </div>

            {/* Table card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar negocio..."
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                            />
                        </div>
                        {/* Filter tabs */}
                        <div className="flex gap-1 flex-wrap">
                            {tabs.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => { setFilterTab(t.key); setPage(0); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterTab === t.key
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {t.label} <span className="opacity-60">({t.count})</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                        <span>Filas:</span>
                        <select
                            value={rowsPerPage}
                            onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        >
                            {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><LoadingSpinner size="md" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">
                        <Landmark size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No se encontraron resultados</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <table className="w-full min-w-[620px] text-sm text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <th className="px-4 py-3">Negocio</th>
                                    <th className="px-4 py-3">Ciudad</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-right">Saldo</th>
                                    <th className="px-4 py-3">Última actualización</th>
                                    <th className="px-4 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginated.map(row => (
                                    <tr key={row.venueId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">{row.venueName}</td>
                                        <td className="px-4 py-3 text-gray-500">{row.city}</td>
                                        <td className="px-4 py-3">{statusBadge(row.balance)}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.balance < 0 ? 'text-red-600' : row.balance > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                            {row.balance === 0 ? '—' : (row.balance < 0 ? '-' : '+') + formatCOP(Math.abs(row.balance))}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">
                                            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    setModalVenue(row);
                                                    setSettlementType(row.balance < 0 ? 'DEBT_PAYMENT' : 'PAYOUT');
                                                    setSettlementAmount('');
                                                    setSettlementDesc('');
                                                }}
                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition"
                                            >
                                                Registrar Movimiento
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination footer */}
                {!loading && filtered.length > 0 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                        <span>
                            Mostrando {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, filtered.length)} de {filtered.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2">Pág. {page + 1} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Settlement Modal */}
            {modalVenue && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-gray-900">Registrar Movimiento</h3>
                            <button onClick={() => setModalVenue(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Negocio: <span className="font-semibold text-gray-800">{modalVenue.venueName}</span>
                            <br />
                            Saldo actual:{' '}
                            <span className={`font-bold ${modalVenue.balance < 0 ? 'text-red-600' : modalVenue.balance > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                {modalVenue.balance === 0 ? 'Al día' : (modalVenue.balance < 0 ? '-' : '+') + formatCOP(Math.abs(modalVenue.balance))}
                            </span>
                        </p>

                        <div className="space-y-4">
                            {/* Type selector */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tipo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setSettlementType('DEBT_PAYMENT')}
                                        className={`py-2.5 rounded-lg text-sm font-semibold border transition ${settlementType === 'DEBT_PAYMENT'
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        Pago de Deuda
                                        <span className="block text-xs font-normal opacity-70">Negocio paga a Rescatto</span>
                                    </button>
                                    <button
                                        onClick={() => setSettlementType('PAYOUT')}
                                        className={`py-2.5 rounded-lg text-sm font-semibold border transition ${settlementType === 'PAYOUT'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        Liquidación
                                        <span className="block text-xs font-normal opacity-70">Rescatto paga al negocio</span>
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Monto (COP)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={settlementAmount}
                                    onChange={e => setSettlementAmount(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Descripción / Referencia</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Pago comisión semana 12, Transferencia Bancolombia..."
                                    value={settlementDesc}
                                    onChange={e => setSettlementDesc(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setModalVenue(null)}
                                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSettle}
                                disabled={saving}
                                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                            >
                                {saving ? 'Guardando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
