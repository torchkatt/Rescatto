import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Product } from '../../../types';
import { Package, AlertTriangle, Search } from 'lucide-react';
import { logger } from '../../../utils/logger';

export const AdminInventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadAllProducts();
    }, []);

    const loadAllProducts = async () => {
        setLoading(true);
        try {
            const productsRef = collection(db, 'products');
            const snapshot = await getDocs(productsRef);
            const allProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];
            setProducts(allProducts);
        } catch (error) {
            logger.error('Failed to load inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(product =>
        (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.venueId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="animate-pulse">Cargando inventario...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Package className="text-emerald-600" />
                    Inventario Global
                </h2>
                <div className="text-sm text-gray-500">
                    Total: {products.length} productos
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por producto, ID de negocio o categoría..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredProducts.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <Package className="mx-auto mb-4 text-gray-300" size={48} />
                    <p className="text-gray-500">No se encontraron productos</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="p-4">Producto</th>
                                <th className="p-4">Negocio ID</th>
                                <th className="p-4">Categoría</th>
                                <th className="p-4">Precio</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map(product => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-800">{product.name}</td>
                                    <td className="p-4 text-gray-500 font-mono text-xs">{product.venueId}</td>
                                    <td className="p-4 text-gray-600">{product.category || '-'}</td>
                                    <td className="p-4 text-gray-800">
                                        ${product.discountedPrice}
                                        <span className="text-xs text-gray-400 line-through ml-2">
                                            ${product.originalPrice}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`font-medium ${product.quantity < 5 ? 'text-red-600' : 'text-gray-800'}`}>
                                            {product.quantity}
                                        </span>
                                    </td>
                                    <td className="p-4">
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
                </div>
            )}
        </div>
    );
};
