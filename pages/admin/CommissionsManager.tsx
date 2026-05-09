import React, { useEffect, useState, useMemo } from 'react';
import { adminService } from '../../services/adminService';
import { useAdminTable } from '../../hooks/useAdminTable';
import { Venue } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import {
    Landmark, Search, AlertTriangle, CheckCircle, TrendingDown,
    RefreshCw, X, ChevronLeft, ChevronRight, RotateCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';

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

    const [filterTab, setFilterTab] = useState<FilterTab>('all');

    const table = useAdminTable<WalletRow>({
        fetchFn: async (size, cursor, term) => {
            const result = await adminService.getCommissionsPaginated(size, cursor, term);
            
            // Apply local tab filter (since getCommissionsPaginated doesn't handle debt/credit tabs yet)
            let data = result.data;
            if (filterTab === 'debt') data = data.filter(r => r.balance < 0);
            if (filterTab === 'credit') data = data.filter(r => r.balance > 0);
            if (filterTab === 'settled') data = data.filter(r => r.balance === 0);
            
            return { ...result, data };
        },
        countFn: () => adminService.getCommissionsCount(),
        initialPageSize: 20,
        dependencies: [filterTab]
    });

    // Modal state
    const [modalVenue, setModalVenue] = useState<WalletRow | null>(null);
    const [settlementType, setSettlementType] = useState<'DEBT_PAYMENT' | 'PAYOUT'>('DEBT_PAYMENT');
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementDesc, setSettlementDesc] = useState('');
    const [saving, setSaving] = useState(false);

    const summary = useMemo(() => {
        const debtRows = table.data.filter(r => r.balance < 0);
        const creditRows = table.data.filter(r => r.balance > 0);
        return {
            totalDebt: debtRows.reduce((s, r) => s + Math.abs(r.balance), 0),
            totalCredit: creditRows.reduce((s, r) => s + r.balance, 0),
            debtCount: debtRows.length,
            creditCount: creditRows.length,
            settledCount: table.data.filter(r => r.balance === 0).length,
        };
    }, [table.data]);

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
            table.reload();
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

    const columns = [
        {
            header: 'Negocio',
            accessor: 'venueName' as keyof WalletRow,
            sortable: true,
            className: 'font-bold text-gray-900'
        },
        {
            header: 'Ciudad',
            accessor: 'city' as keyof WalletRow,
            sortable: true,
            className: 'hidden sm:table-cell text-gray-500 font-medium'
        },
        {
            header: 'Estado',
            accessor: 'balance' as keyof WalletRow,
            sortable: true,
            render: (value: number) => statusBadge(value)
        },
        {
            header: 'Saldo',
            accessor: 'balance' as keyof WalletRow,
            sortable: true,
            className: 'text-right',
            render: (value: number) => (
                <span className={`font-black text-sm tracking-tight ${value < 0 ? 'text-red-600' : value > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                    {value === 0 ? 'AL DÍA' : (value < 0 ? '-' : '+') + formatCOP(Math.abs(value))}
                </span>
            )
        },
        {
            header: 'Última Act.',
            accessor: 'updatedAt' as keyof WalletRow,
            sortable: true,
            className: 'hidden md:table-cell text-gray-400 text-[10px] font-bold uppercase tracking-widest',
            render: (value: string) => value ? new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'
        },
        {
            header: 'Acciones',
            accessor: 'venueId' as keyof WalletRow,
            className: 'text-right',
            render: (id: string, row: WalletRow) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setModalVenue(row);
                        setSettlementType(row.balance < 0 ? 'DEBT_PAYMENT' : 'PAYOUT');
                        setSettlementAmount('');
                        setSettlementDesc('');
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                    Registrar
                </button>
            )
        }
    ];

    if (table.isLoading && table.data.length === 0) return (
        <div className="flex justify-center items-center h-96">
            <LoadingSpinner />
        </div>
    );

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Landmark className="text-emerald-400" />
                    Comisiones y Deudas
                </h2>
                <button
                    onClick={() => table.reload()}
                    disabled={table.isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={table.isLoading ? 'animate-spin' : ''} />
                    Refrescar
                </button>
            </div>

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

            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'Todos', count: table.data.length },
                    { key: 'debt', label: 'En Deuda', count: summary.debtCount },
                    { key: 'credit', label: 'Rescatto Debe', count: summary.creditCount },
                    { key: 'settled', label: 'Al Día', count: summary.settledCount },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setFilterTab(t.key as FilterTab)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            filterTab === t.key 
                                ? 'bg-gray-900 text-white shadow-lg scale-105' 
                                : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                        <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${
                            filterTab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                            {t.count}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar por negocio o ciudad..."
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
                    onRowClick={(item) => {/* Opcional: ver detalles */ }}
                    exportable
                    exportFilename="rescatto_comisiones"
                    exportTransformer={(r) => ({
                        venueName: r.venueName,
                        city: r.city,
                        balance: r.balance,
                        status: r.balance < 0 ? 'En Deuda' : r.balance > 0 ? 'Rescatto Debe' : 'Al Día',
                        updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es-CO') : '—'
                    })}
                />
            </div>

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
