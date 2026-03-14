import React, { useEffect, useState } from 'react';
import { Product } from '../../../types';
import { Package, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/customer/common/Loading';
import { logger } from '../../../utils/logger';
import { formatCOP } from '../../../utils/formatters';

const PAGE_SIZE = 20;

export const AdminInventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [totalLoaded, setTotalLoaded] = useState(0);

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

            if (initial) {
                setProducts(data);
            } else {
                setProducts(prev => [...prev, ...data]);
            }
            setLastDoc(newLastDoc);
            setHasMore(moreAvailable);
            setTotalLoaded(prev => initial ? data.length : prev + data.length);
        } catch (error) {
            logger.error('Failed to load inventory:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const filteredProducts = products.filter(product =>
        (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.venueId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Package className="text-emerald-600" />
                    Inventario Global
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{totalLoaded} productos cargados</span>
                    <button
                        onClick={() => loadProducts(true)}
                        disabled={loading}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm"
                        title="Refrescar inventario"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : 'text-gray-500'} />
                    </button>
                </div>
            </div>

            {/* Alertas de stock bajo */}
            {(() => {
                const lowStock = filteredProducts.filter(p => p.quantity > 0 && p.quantity < 5);
                const outOfStock = filteredProducts.filter(p => p.quantity === 0);
                if (lowStock.length === 0 && outOfStock.length === 0) return null;
                return (
                    <div className="flex flex-wrap gap-3">
                        {outOfStock.length > 0 && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium">
                                <AlertTriangle size={16} />
                                {outOfStock.length} producto{outOfStock.length > 1 ? 's' : ''} agotado{outOfStock.length > 1 ? 's' : ''}
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

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400 shrink-0" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por producto, ID de negocio o categoría..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600 text-sm">
                        Limpiar
                    </button>
                )}
            </div>

            {filteredProducts.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <Package className="mx-auto mb-4 text-gray-300" size={48} />
                    <p className="text-gray-500 font-medium">No se encontraron productos</p>
                    {searchTerm && <p className="text-sm text-gray-400 mt-1">Intenta con otro término de búsqueda</p>}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="p-4">Producto</th>
                                <th className="p-4">ID Negocio</th>
                                <th className="p-4">Categoría</th>
                                <th className="p-4">Precio</th>
                                <th className="p-4 text-center">Stock</th>
                                <th className="p-4 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map(product => (
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
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                                <AlertTriangle size={12} /> Agotado
                                            </span>
                                        ) : product.quantity < 5 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                                <AlertTriangle size={12} /> Bajo Stock
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                Disponible
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Load More */}
                    {hasMore && !searchTerm && (
                        <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-3">
                            <button
                                onClick={() => loadProducts(false)}
                                disabled={loadingMore}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {loadingMore ? (
                                    <><RefreshCw size={14} className="animate-spin" /> Cargando...</>
                                ) : (
                                    `Cargar más productos`
                                )}
                            </button>
                        </div>
                    )}
                    {!hasMore && products.length > 0 && (
                        <div className="p-3 border-t border-gray-100 text-center text-xs text-gray-400">
                            Todos los productos cargados ({totalLoaded} total)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
