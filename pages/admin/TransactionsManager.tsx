import React, { useState, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { transactionService } from '../../services/transactionService';
import { useAdminTable } from '../../hooks/useAdminTable';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DataTable, Column } from '../../components/common/DataTable';
import { Transaction, TransactionStatus, TransactionType, DeliveryMethod } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import {
    ShoppingCart, Search, RefreshCw, CheckCircle, Clock,
    XCircle, Truck, AlertTriangle, RotateCw, ArrowRightLeft
} from 'lucide-react';

type FilterTab = 'ALL' | TransactionStatus;

const STATUS_LABELS: Record<TransactionStatus, string> = {
    [TransactionStatus.PENDING]: 'Pendiente',
    [TransactionStatus.CONFIRMED]: 'Confirmado',
    [TransactionStatus.IN_PROGRESS]: 'En Progreso',
    [TransactionStatus.READY]: 'Listo',
    [TransactionStatus.IN_TRANSIT]: 'En Tránsito',
    [TransactionStatus.COMPLETED]: 'Completado',
    [TransactionStatus.CANCELLED]: 'Cancelado',
    [TransactionStatus.DISPUTED]: 'Disputado',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
    [TransactionStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
    [TransactionStatus.CONFIRMED]: 'bg-blue-50 text-blue-700 border-blue-200',
    [TransactionStatus.IN_PROGRESS]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    [TransactionStatus.READY]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    [TransactionStatus.IN_TRANSIT]: 'bg-purple-50 text-purple-700 border-purple-200',
    [TransactionStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    [TransactionStatus.CANCELLED]: 'bg-red-50 text-red-700 border-red-200',
    [TransactionStatus.DISPUTED]: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_ICONS: Record<TransactionStatus, React.ReactNode> = {
    [TransactionStatus.PENDING]: <Clock size={12} />,
    [TransactionStatus.CONFIRMED]: <CheckCircle size={12} />,
    [TransactionStatus.IN_PROGRESS]: <RotateCw size={12} />,
    [TransactionStatus.READY]: <CheckCircle size={12} />,
    [TransactionStatus.IN_TRANSIT]: <Truck size={12} />,
    [TransactionStatus.COMPLETED]: <CheckCircle size={12} />,
    [TransactionStatus.CANCELLED]: <XCircle size={12} />,
    [TransactionStatus.DISPUTED]: <AlertTriangle size={12} />,
};

const COLLECTION = 'transactions';

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
    [TransactionType.PURCHASE]: 'Compra',
    [TransactionType.BOOKING]: 'Reserva',
    [TransactionType.DIGITAL]: 'Digital',
};

const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
    [DeliveryMethod.PICKUP]: 'Recoger',
    [DeliveryMethod.SHIPPING]: 'Envío',
    [DeliveryMethod.DIGITAL]: 'Digital',
    [DeliveryMethod.IN_PERSON]: 'En Persona',
};

/** Firestore date → ISO string helper */
function toISO(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.toDate?.()?.toISOString?.() || String(val);
}

export const TransactionsManager: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
    const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

    const table = useAdminTable<Transaction>({
        fetchFn: async (size, cursor, term) => {
            try {
                const constraints: any[] = [];

                // Apply status filter
                if (filterTab !== 'ALL') {
                    constraints.push(where('status', '==', filterTab));
                }

                constraints.push(orderBy('createdAt', 'desc'));

                if (cursor) {
                    constraints.push(startAfter(cursor));
                }

                constraints.push(limit(size));

                const snap = await getDocs(
                    query(collection(db, COLLECTION), ...constraints)
                );

                const data = snap.docs.map(d => {
                    const raw = d.data();
                    return {
                        id: d.id,
                        buyerId: raw.buyerId || '',
                        sellerId: raw.sellerId || '',
                        transactionType: raw.transactionType || TransactionType.PURCHASE,
                        status: raw.status || TransactionStatus.PENDING,
                        lineItems: raw.lineItems || [],
                        subtotal: raw.subtotal || 0,
                        deliveryFee: raw.deliveryFee,
                        totalAmount: raw.totalAmount || 0,
                        commission: raw.commission || 0,
                        sellerEarnings: raw.sellerEarnings || 0,
                        payment: raw.payment || { method: 'wompi', id: '', status: 'pending' },
                        deliveryMethod: raw.deliveryMethod || DeliveryMethod.PICKUP,
                        shippingAddress: raw.shippingAddress,
                        courierId: raw.courierId,
                        trackingNumber: raw.trackingNumber,
                        pickupWindow: raw.pickupWindow,
                        downloadUrl: raw.downloadUrl,
                        buyerNotes: raw.buyerNotes,
                        sellerNotes: raw.sellerNotes,
                        createdAt: toISO(raw.createdAt),
                        updatedAt: toISO(raw.updatedAt),
                        completedAt: raw.completedAt ? toISO(raw.completedAt) : undefined,
                    } as Transaction;
                });

                return {
                    data,
                    lastDoc: snap.docs[snap.docs.length - 1] || null,
                    hasMore: snap.docs.length === size,
                };
            } catch (err) {
                logger.error('TransactionsManager fetch error:', err);
                return { data: [], lastDoc: null, hasMore: false };
            }
        },
        countFn: async () => {
            try {
                const ref = collection(db, COLLECTION);
                if (filterTab !== 'ALL') {
                    const snap = await getCountFromServer(
                        query(ref, where('status', '==', filterTab))
                    );
                    return snap.data().count;
                }
                const snap = await getCountFromServer(ref);
                return snap.data().count;
            } catch {
                return 0;
            }
        },
        initialPageSize: 20,
        dependencies: [filterTab],
    });

    const handleStatusUpdate = useCallback(
        async (transactionId: string, newStatus: TransactionStatus) => {
            setStatusUpdating(transactionId);
            try {
                await transactionService.updateStatus(transactionId, newStatus);
                toast.success(`Transacción ${newStatus === TransactionStatus.COMPLETED ? 'completada' : 'actualizada'}`);
                table.reload();
            } catch (err: any) {
                logger.error('Status update error:', err);
                toast.error(err?.message || 'Error al actualizar estado');
            } finally {
                setStatusUpdating(null);
            }
        },
        [toast, table]
    );

    const statusBadge = (status: TransactionStatus) => (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[status]}`}
        >
            {STATUS_ICONS[status]}
            {STATUS_LABELS[status]}
        </span>
    );

    const columns: Column<Transaction>[] = [
        {
            header: 'ID',
            accessor: 'id' as keyof Transaction,
            className: 'font-mono text-[10px] text-gray-400 w-28',
            render: (value: string) => (
                <span title={value} className="truncate block max-w-[100px]">
                    {value.length > 10 ? `${value.slice(0, 10)}…` : value}
                </span>
            ),
        },
        {
            header: 'Comprador',
            accessor: 'buyerId' as keyof Transaction,
            sortable: true,
            className: 'font-mono text-[10px] text-gray-500 hidden md:table-cell',
            render: (value: string) => (
                <span title={value}>{value.length > 12 ? `${value.slice(0, 12)}…` : value}</span>
            ),
        },
        {
            header: 'Vendedor',
            accessor: 'sellerId' as keyof Transaction,
            sortable: true,
            className: 'font-mono text-[10px] text-gray-500 hidden md:table-cell',
            render: (value: string) => (
                <span title={value}>{value.length > 12 ? `${value.slice(0, 12)}…` : value}</span>
            ),
        },
        {
            header: 'Tipo',
            accessor: 'transactionType' as keyof Transaction,
            sortable: true,
            className: 'text-xs font-semibold text-gray-600 hidden sm:table-cell',
            render: (value: TransactionType) => (
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-wider">
                    {TRANSACTION_TYPE_LABELS[value] || value}
                </span>
            ),
        },
        {
            header: 'Estado',
            accessor: 'status' as keyof Transaction,
            sortable: true,
            render: (value: TransactionStatus) => statusBadge(value),
        },
        {
            header: 'Total',
            accessor: 'totalAmount' as keyof Transaction,
            sortable: true,
            className: 'text-right',
            render: (value: number) => (
                <span className="font-bold text-sm text-gray-900">{formatCOP(value)}</span>
            ),
        },
        {
            header: 'Entrega',
            accessor: 'deliveryMethod' as keyof Transaction,
            sortable: true,
            className: 'hidden lg:table-cell text-xs text-gray-500',
            render: (value: DeliveryMethod) => DELIVERY_METHOD_LABELS[value] || value,
        },
        {
            header: 'Fecha',
            accessor: 'createdAt' as keyof Transaction,
            sortable: true,
            className: 'hidden lg:table-cell text-gray-400 text-[10px] font-bold uppercase tracking-widest',
            render: (value: string) =>
                value
                    ? new Date(value).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                      })
                    : '—',
        },
        {
            header: 'Acción',
            accessor: 'id' as keyof Transaction,
            className: 'text-right',
            render: (id: string, row: Transaction) => {
                const isUpdating = statusUpdating === id;

                // Show action buttons based on current status
                if (row.status === TransactionStatus.PENDING) {
                    return (
                        <div className="flex gap-1 justify-end">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(id, TransactionStatus.CONFIRMED);
                                }}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {isUpdating ? '…' : 'Confirmar'}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(id, TransactionStatus.CANCELLED);
                                }}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-700 transition disabled:opacity-50"
                            >
                                {isUpdating ? '…' : 'Cancelar'}
                            </button>
                        </div>
                    );
                }

                if (row.status === TransactionStatus.CONFIRMED) {
                    return (
                        <div className="flex gap-1 justify-end">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(id, TransactionStatus.IN_PROGRESS);
                                }}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {isUpdating ? '…' : 'Procesar'}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(id, TransactionStatus.CANCELLED);
                                }}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-700 transition disabled:opacity-50"
                            >
                                {isUpdating ? '…' : 'Cancelar'}
                            </button>
                        </div>
                    );
                }

                if (
                    row.status === TransactionStatus.IN_PROGRESS ||
                    row.status === TransactionStatus.READY ||
                    row.status === TransactionStatus.IN_TRANSIT
                ) {
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleStatusUpdate(id, TransactionStatus.COMPLETED);
                            }}
                            disabled={isUpdating}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                            {isUpdating ? '…' : 'Completar'}
                        </button>
                    );
                }

                return (
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        {row.status === TransactionStatus.COMPLETED
                            ? 'Finalizado'
                            : row.status === TransactionStatus.CANCELLED
                            ? 'Cancelado'
                            : row.status === TransactionStatus.DISPUTED
                            ? 'En Disputa'
                            : '—'}
                    </span>
                );
            },
        },
    ];

    const statusCounts = React.useMemo(() => {
        const counts: Partial<Record<FilterTab, number>> = { ALL: 0 };
        for (const tx of table.data) {
            counts.ALL = (counts.ALL || 0) + 1;
            counts[tx.status] = (counts[tx.status] || 0) + 1;
        }
        // When filter is active, total is from Firestore countFn
        if (filterTab !== 'ALL') {
            counts.ALL = table.totalItems;
        }
        return counts;
    }, [table.data, table.totalItems, filterTab]);

    const filterTabs: { key: FilterTab; label: string; status?: TransactionStatus }[] = [
        { key: 'ALL', label: 'Todos' },
        { key: TransactionStatus.PENDING, label: 'Pendientes', status: TransactionStatus.PENDING },
        { key: TransactionStatus.CONFIRMED, label: 'Confirmados', status: TransactionStatus.CONFIRMED },
        { key: TransactionStatus.COMPLETED, label: 'Completados', status: TransactionStatus.COMPLETED },
        { key: TransactionStatus.CANCELLED, label: 'Cancelados', status: TransactionStatus.CANCELLED },
    ];

    if (table.isLoading && table.data.length === 0) {
        return (
            <div className="flex justify-center items-center h-96">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ArrowRightLeft className="text-emerald-400" />
                    Transacciones del Marketplace
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

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {filterTabs.map((tab) => (
                    <div
                        key={tab.key}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-gray-200 transition"
                        onClick={() => setFilterTab(tab.key)}
                    >
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            {tab.label}
                        </p>
                        <p className="text-xl font-bold text-gray-800">
                            {statusCounts[tab.key] ?? 0}
                        </p>
                    </div>
                ))}
            </div>

            {/* DataTable */}
            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar por ID de transacción..."
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
                    exportFilename="rescatto_transacciones"
                    exportTransformer={(tx) => ({
                        id: tx.id,
                        buyerId: tx.buyerId,
                        sellerId: tx.sellerId,
                        transactionType: TRANSACTION_TYPE_LABELS[tx.transactionType] || tx.transactionType,
                        status: STATUS_LABELS[tx.status] || tx.status,
                        totalAmount: formatCOP(tx.totalAmount),
                        deliveryMethod: DELIVERY_METHOD_LABELS[tx.deliveryMethod] || tx.deliveryMethod,
                        createdAt: tx.createdAt
                            ? new Date(tx.createdAt).toLocaleDateString('es-CO')
                            : '—',
                    })}
                />
            </div>
        </div>
    );
};

export default TransactionsManager;
