import React from 'react';
import { listingService } from '../../services/listingService';
import { Listing, ListingType } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAdminTable } from '../../hooks/useAdminTable';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import { Package, Star, Trash2, RotateCw } from 'lucide-react';
import { logger } from '../../utils/logger';
import {
    collection,
    query as firestoreQuery,
    orderBy,
    limit,
    startAfter,
    getDocs,
    getCountFromServer,
} from 'firebase/firestore';
import { db } from '../../services/firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
    [ListingType.PRODUCT]: 'Producto',
    [ListingType.SERVICE]: 'Servicio',
    [ListingType.DIGITAL]: 'Digital',
};

const LISTING_TYPE_ICONS: Record<ListingType, string> = {
    [ListingType.PRODUCT]: '📦',
    [ListingType.SERVICE]: '🛠️',
    [ListingType.DIGITAL]: '💾',
};

const LISTING_TYPE_COLORS: Record<ListingType, string> = {
    [ListingType.PRODUCT]: 'bg-blue-100 text-blue-700',
    [ListingType.SERVICE]: 'bg-purple-100 text-purple-700',
    [ListingType.DIGITAL]: 'bg-amber-100 text-amber-700',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ListingsManager: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();

    const table = useAdminTable<Listing>({
        fetchFn: async (size, cursor, term) => {
            const listingsRef = collection(db, 'listings');
            const constraints: any[] = [orderBy('createdAt', 'desc')];
            if (cursor) constraints.push(startAfter(cursor));
            constraints.push(limit(size));

            const q = firestoreQuery(listingsRef, ...constraints);
            const snapshot = await getDocs(q);
            let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Listing));

            // Client-side search across multiple fields
            if (term) {
                const t = term.toLowerCase();
                data = data.filter(l =>
                    l.title?.toLowerCase().includes(t) ||
                    l.sellerId?.toLowerCase().includes(t) ||
                    l.categoryId?.toLowerCase().includes(t) ||
                    l.type?.toLowerCase().includes(t)
                );
            }

            return {
                data,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === size,
            };
        },
        countFn: async () => {
            const snap = await getCountFromServer(collection(db, 'listings'));
            return snap.data().count;
        },
        initialPageSize: 20,
    });

    // ─── Actions ──────────────────────────────────────────────────────────────

    const handleToggleActive = async (listing: Listing) => {
        try {
            await listingService.updateListing(listing.id, { isActive: !listing.isActive });
            toast.success(listing.isActive ? 'Listing desactivado' : 'Listing activado');
            table.reload();
        } catch (error) {
            logger.error('Error toggling listing active', error);
            toast.error('Error al cambiar estado');
        }
    };

    const handleToggleFeatured = async (listing: Listing) => {
        try {
            await listingService.updateListing(listing.id, { isFeatured: !listing.isFeatured });
            toast.success(listing.isFeatured ? 'Destacado removido' : 'Listing destacado');
            table.reload();
        } catch (error) {
            logger.error('Error toggling listing featured', error);
            toast.error('Error al cambiar destacado');
        }
    };

    const handleDelete = async (listing: Listing) => {
        const confirmed = await confirm({
            title: '¿Eliminar listing?',
            message: `Esta acción eliminará permanentemente "${listing.title}". Esta operación no se puede deshacer.`,
            confirmLabel: 'Eliminar',
            variant: 'danger',
        });
        if (confirmed) {
            try {
                await listingService.deleteListing(listing.id);
                toast.success('Listing eliminado correctamente');
                table.reload();
            } catch (error) {
                logger.error('Error deleting listing', error);
                toast.error('Error al eliminar el listing');
            }
        }
    };

    // ─── Columns ──────────────────────────────────────────────────────────────

    const columns: Column<Listing>[] = [
        {
            header: 'Título',
            accessor: 'title' as keyof Listing,
            sortable: true,
            className: 'font-bold text-gray-900 max-w-[200px] truncate',
        },
        {
            header: 'Tipo',
            accessor: 'type' as keyof Listing,
            className: 'text-center',
            render: (value: ListingType) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${LISTING_TYPE_COLORS[value] || 'bg-gray-100 text-gray-700'}`}>
                    {LISTING_TYPE_ICONS[value]} {LISTING_TYPE_LABELS[value]}
                </span>
            ),
        },
        {
            header: 'Vendedor',
            accessor: 'sellerId' as keyof Listing,
            className: 'font-mono text-xs text-gray-500 truncate max-w-[130px]',
        },
        {
            header: 'Categoría',
            accessor: 'categoryId' as keyof Listing,
            className: 'font-mono text-xs text-gray-400 truncate max-w-[130px] hidden md:table-cell',
        },
        {
            header: 'Precio',
            accessor: 'price' as keyof Listing,
            className: 'text-right font-bold text-gray-900',
            render: (value: number) =>
                value != null
                    ? `$${value.toLocaleString('es-CO')}`
                    : <span className="text-gray-400">—</span>,
        },
        {
            header: 'Activo',
            accessor: 'isActive' as keyof Listing,
            className: 'text-center',
            render: (value: boolean, item: Listing) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(item); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${value ? 'bg-emerald-600' : 'bg-gray-200'}`}
                    title={value ? 'Desactivar listing' : 'Activar listing'}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            ),
        },
        {
            header: 'Destacado',
            accessor: 'isFeatured' as keyof Listing,
            className: 'text-center',
            render: (value: boolean, item: Listing) => (
                <Tooltip text={value ? 'Remover destacado' : 'Marcar como destacado'}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFeatured(item); }}
                        className={`p-1.5 rounded-lg transition-all ${value ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-300 hover:bg-gray-50 hover:text-yellow-400'}`}
                    >
                        <Star size={18} fill={value ? 'currentColor' : 'none'} />
                    </button>
                </Tooltip>
            ),
        },
        {
            header: 'Ventas',
            accessor: 'stats' as keyof Listing,
            className: 'text-center font-bold text-gray-700',
            render: (value: Listing['stats']) => (
                <span className="tabular-nums">{value?.sales ?? 0}</span>
            ),
        },
        {
            header: 'Acciones',
            accessor: 'id' as keyof Listing,
            className: 'text-right',
            render: (_id: string, item: Listing) => (
                <div className="flex justify-end gap-1">
                    <Tooltip text="Eliminar listing permanentemente">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        >
                            <Trash2 size={18} />
                        </button>
                    </Tooltip>
                </div>
            ),
        },
    ];

    // ─── Loading state ────────────────────────────────────────────────────────

    if (table.isLoading && table.data.length === 0) return <LoadingSpinner fullPage />;

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 overflow-x-hidden animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/20">
                            <Package className="text-white" size={24} />
                        </div>
                        Gestión de Listings
                    </h2>
                    <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest opacity-70">
                        Administración de productos, servicios y digitales del marketplace
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => table.reload()}
                        className="bg-white/10 backdrop-blur-md border border-white/10 text-white p-3 rounded-2xl hover:bg-white/20 transition shadow-sm flex items-center justify-center active:scale-95"
                        title="Refrescar listings"
                    >
                        <RotateCw size={20} className={table.isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* DataTable */}
            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar listings por título, vendedor, categoría o tipo..."
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
                    exportable
                    exportFilename="rescatto_listings"
                    exportTransformer={(listing: Listing) => ({
                        'Título': listing.title,
                        'Tipo': LISTING_TYPE_LABELS[listing.type],
                        'Vendedor ID': listing.sellerId,
                        'Categoría ID': listing.categoryId,
                        'Precio': listing.price,
                        'Precio original': listing.originalPrice ?? '',
                        'Activo': listing.isActive ? 'Sí' : 'No',
                        'Destacado': listing.isFeatured ? 'Sí' : 'No',
                        'Ventas': listing.stats?.sales ?? 0,
                        'Vistas': listing.stats?.views ?? 0,
                        'Rating': listing.stats?.rating ?? 0,
                        'Creado': listing.createdAt,
                    })}
                />
            </div>
        </div>
    );
};

export default ListingsManager;
