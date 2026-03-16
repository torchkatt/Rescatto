import React, { useEffect, useState, useMemo } from 'react';
import { Product } from '../../../types';
import { Package, AlertTriangle, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { LoadingSpinner } from '../../../components/customer/common/Loading';
import { logger } from '../../../utils/logger';
import { formatCOP } from '../../../utils/formatters';

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export const AdminInventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    useEffect(() => {
        loadProducts(true);
    }, []);

    const loadProducts = async (initial = false) => {
        if (initial) { setLoading(true); setProducts([]); setLastDoc(null); }
        else setLoadingMore(true);

        try {
            const { data, lastDoc: newLastDoc, hasMore: moreAvailable } = await (async () => {
                const { collection, query, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
                const { db } = await import('../../../services/firebase');
                let q = query(collection(db, 'products'), orderBy('name'), limit(PAGE_SIZE));
                if (!initial && lastDoc) q = query(collection(db, 'products'), orderBy('name'), startAfter(lastDoc), limit(PAGE_SIZE));
                const snap = await getDocs(q);
                return {
                    data: snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
                    lastDoc: snap.docs[snap.docs.length - 1] || null,
                    hasMore: snap.docs.length === PAGE_SIZE,
                };
            })();

            if (initial) setProducts(data);
            else setProducts(prev => [...prev, ...data]);
            setLastDoc(newLastDoc);
            setHasMore(moreAvailable);
        } catch (error) {
            logger.error('Failed to load inventory:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const filteredProducts = useMemo(() =>
        products.filter(product =>
            (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (product.venueId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        ),
        [products, searchTerm]
    );

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filteredProducts.length > 0 && filteredProducts.length % pageSize === 0;

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) {
            await loadProducts(false);
        }
        setCurrentPage(target);
    };

    const handlePageSizeChange = (size: number) => { setPageSize(size); setCurrentPage(1); };

    const getPageNumbers = () => {
        const delta = 2;
        const pages: (number | '...')[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) pages.push(i);
            else if (pages[pages.length - 1] !== '...') pages.push('...');
        }
        return pages;
    };

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Package className="text-emerald-600" />
                    Inventario Global
                </h2>
                <button
                    onClick={() => loadProducts(true)}
                    disabled={loading}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm"
                    title="Refrescar inventario"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : 'text-gray-500'} />
                </button>
            </div>

            {/* Alertas de stock */}
            {(() => {
                const lowStock = filteredProducts.filter(p => p.quantity > 0 && p.quantity < 5);
                const outOfStock = filteredProducts.filter(p => p.quantity === 0);
                if (!lowStock.length && !outOfStock.length) return null;
                return (
                    <div className="flex flex-wrap gap-2">
                        {outOfStock.length > 0 && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium">
                                <AlertTriangle size={16} />
                                {outOfStock.length} productos agotados
                            </div>
                        )}
                        {lowStock.length > 0 && (
                            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium">
                                <AlertTriangle size={16} />
                                {lowStock.length} con bajo stock (menos de 5 unidades)
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-800">Inventario de Productos</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 sm:flex-none sm:w-72">
                            <Search className="text-gray-400 shrink-0" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por producto, ID de negocio o categoría..."
                                className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                            {searchTerm && (
                                <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-600 text-xs">Limpiar</button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-500">Filas:</span>
                            <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:border-emerald-400">
                                {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="p-12 text-center">
                        <Package className="mx-auto mb-4 text-gray-300" size={48} />
                        <p className="text-gray-500 font-medium">No se encontraron productos</p>
                        {searchTerm && <p className="text-sm text-gray-400 mt-1">Intenta con otro término de búsqueda</p>}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                        <th className="p-4">Producto</th>
                                        <th className="p-4">ID Negocio</th>
                                        <th className="p-4">Categoría</th>
                                        <th className="p-4">Precio</th>
                                        <th className="p-4 text-center">Stock</th>
                                        <th className="p-4 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedProducts.map(product => (
                                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-medium text-gray-800">{product.name}</td>
                                            <td className="p-4 text-gray-500 font-mono text-xs max-w-[120px] truncate" title={product.venueId}>
                                                {product.venueId?.slice(0, 12)}...
                                            </td>
                                            <td className="p-4 text-gray-600">{product.category || '—'}</td>
                                            <td className="p-4 text-gray-800">
                                                <span className="font-bold text-emerald-600">{product.discountedPrice != null ? formatCOP(product.discountedPrice) : '—'}</span>
                                                <span className="text-xs text-gray-400 line-through ml-2">{product.originalPrice != null ? formatCOP(product.originalPrice) : '—'}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`font-bold ${product.quantity === 0 ? 'text-red-600' : product.quantity < 5 ? 'text-yellow-600' : 'text-gray-800'}`}>
                                                    {product.quantity}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {product.quantity === 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"><AlertTriangle size={12} /> Agotado</span>
                                                ) : product.quantity < 5 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium"><AlertTriangle size={12} /> Bajo Stock</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Disponible</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <p className="text-xs text-gray-500 shrink-0">
                                {loadingMore ? 'Cargando...' : <>Mostrando <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredProducts.length)}</span> de <span className="font-semibold text-gray-700">{filteredProducts.length}{hasMore ? '+' : ''}</span> productos</>}
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => goToPage(1)} disabled={safePage === 1 || loadingMore} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsLeft size={16} /></button>
                                <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1 || loadingMore} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                                {getPageNumbers().map((page, idx) =>
                                    page === '...' ? <span key={`e-${idx}`} className="px-2 text-gray-400 text-sm select-none">…</span> : (
                                        <button key={page} onClick={() => goToPage(page as number)} disabled={loadingMore} className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${page === safePage ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                                    )
                                )}
                                <button onClick={() => goToPage(safePage + 1)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                                <button onClick={() => goToPage(totalPages)} disabled={(safePage >= totalPages && !hasMore) || loadingMore} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsRight size={16} /></button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
