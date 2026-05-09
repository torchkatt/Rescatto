import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { VenueCategory } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Plus, Edit2, Trash2, Tag, X, Save, Search, Archive, Store, Package, RotateCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import { logger } from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';
import { collection, getCountFromServer, query, where, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const CategoriesManager: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const { user: currentUser } = useAuth();
    const [categories, setCategories] = useState<VenueCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [usageMap, setUsageMap] = useState<Record<string, { venues: number; products: number; total: number }>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<VenueCategory>>({ isActive: true });
    const [searchTerm, setSearchTerm] = useState('');

    const PAGE_SIZE = 20;
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    useEffect(() => {
        loadCategories(true);
        // loadCategories es estable al montaje; también se llama desde handlers de edición/eliminación
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCategories = async (initial = false) => {
        if (initial) {
            setLoading(true);
            setCategories([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const page = await adminService.getCategoriesPaginated(PAGE_SIZE, initial ? null : lastDoc);
            const next = initial ? page.data : [...categories, ...page.data];
            setCategories(next as VenueCategory[]);
            setLastDoc(page.lastDoc);
            setHasMore(page.hasMore);

            if (page.data.length > 0) {
                const usageUpdates: Record<string, { venues: number; products: number; total: number }> = {};
                await Promise.all(
                    page.data.map(async (cat: VenueCategory) => {
                        const [venuesCount, productsCount] = await Promise.all([
                            getCountFromServer(query(collection(db, 'venues'), where('categories', 'array-contains', cat.name))),
                            getCountFromServer(query(collection(db, 'products'), where('tags', 'array-contains', cat.name))),
                        ]);
                        usageUpdates[cat.id] = {
                            venues: venuesCount.data().count || 0,
                            products: productsCount.data().count || 0,
                            total: (venuesCount.data().count || 0) + (productsCount.data().count || 0),
                        };
                    })
                );
                setUsageMap(prev => ({ ...prev, ...usageUpdates }));
            }
        } catch (error) {
            logger.error('Failed to load categories', error);
        } finally {
            if (initial) setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const slug = formData.name?.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]/g, '') || '';
            const dataToSave = { ...formData, slug };

            if (formData.id) {
                await adminService.updateCategory(formData.id, dataToSave, currentUser?.id || 'system');
            } else {
                await adminService.createCategory(dataToSave, currentUser?.id || 'system');
            }
            toast.success(formData.id ? 'Etiqueta actualizada' : 'Etiqueta creada');
            setIsModalOpen(false);
            setFormData({ isActive: true });
            loadCategories(true);
        } catch (error) {
            logger.error('Error saving category', error);
            toast.error('Error al guardar la etiqueta');
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: '¿Eliminar etiqueta?',
            message: 'Esta acción no se puede deshacer y podría afectar a los productos que la usan.',
            confirmLabel: 'Eliminar',
            variant: 'danger'
        });

        if (confirmed) {
            try {
                await adminService.deleteCategory(id, currentUser?.id || 'system');
                toast.success('Etiqueta eliminada correctamente');
                loadCategories(true);
            } catch (error) {
                logger.error('Error deleting category', error);
                toast.error('Error al eliminar la etiqueta');
            }
        }
    };

    const handleToggleStatus = async (category: VenueCategory) => {
        const newStatus = !category.isActive;
        try {
            // Optimistic update
            setCategories(prev => prev.map(c => c.id === category.id ? { ...c, isActive: newStatus } : c));
            await adminService.updateCategory(category.id, { isActive: newStatus }, currentUser?.id || 'system');
        } catch (error) {
            logger.error('Error updating status', error);
            loadCategories(true); // Revert
        }
    };

    const openEdit = (cat: VenueCategory) => {
        setFormData(cat);
        setIsModalOpen(true);
    };

    const openCreate = () => {
        setFormData({ isActive: true });
        setIsModalOpen(true);
    };

    const handleSeed = async () => {
        const confirmed = await confirm({
            title: 'Cargar etiquetas por defecto',
            message: 'Esto añadirá las categorías estándar (Restaurante, Café, etc.). ¿Deseas continuar?',
            confirmLabel: 'Cargar',
            variant: 'info'
        });

        if (confirmed) {
            setLoading(true);
            try {
                await adminService.seedDefaultCategories(currentUser?.id || 'system');
                toast.success('Etiquetas cargadas correctamente');
                loadCategories(true);
            } catch (error) {
                logger.error('Error seeding categories', error);
                toast.error('Error al cargar etiquetas');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDeduplicate = async () => {
        const categoriesBySlug: Record<string, VenueCategory[]> = {};
        categories.forEach(cat => {
            const slug = cat.slug || cat.name.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]/g, '');
            if (!categoriesBySlug[slug]) categoriesBySlug[slug] = [];
            categoriesBySlug[slug].push(cat);
        });

        const duplicates = Object.values(categoriesBySlug).filter(group => group.length > 1);

        if (duplicates.length === 0) {
            toast.info('No se encontraron etiquetas duplicadas.');
            return;
        }

        const confirmed = await confirm({
            title: 'Deduplicar etiquetas',
            message: `Se han encontrado ${duplicates.length} grupos de etiquetas duplicadas. ¿Deseas eliminarlas y mantener una de cada una?`,
            confirmLabel: 'Deduplicar',
            variant: 'warning'
        });

        if (confirmed) {
            setLoading(true);
            try {
                for (const group of duplicates) {
                    // Keep the one with an icon, or the first one
                    const toKeep = group.find(c => c.icon) || group[0];
                    const toDelete = group.filter(c => c.id !== toKeep.id);

                    for (const cat of toDelete) {
                        await adminService.deleteCategory(cat.id, currentUser?.id || 'system');
                    }
                }
                toast.success('Deduplicación completada con éxito.');
                loadCategories(true);
            } catch (error) {
                logger.error('Error during deduplication', error);
                toast.error('Hubo un error durante la deduplicación.');
            } finally {
                setLoading(false);
            }
        }
    };

    const filteredCategories = useMemo(() => categories.filter(cat =>
        (cat.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cat.slug?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ), [categories, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedCategories = filteredCategories.slice((safePage - 1) * pageSize, safePage * pageSize);
    const needsMoreData = hasMore && safePage === totalPages && filteredCategories.length > 0 && filteredCategories.length % pageSize === 0;

    const goToPage = async (page: number) => {
        const target = Math.max(1, Math.min(page, totalPages));
        if (needsMoreData && target === totalPages) await loadCategories(false);
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


    if (loading && !isModalOpen) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Tag className="text-emerald-600" />
                        Gestión de Etiquetas
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Gestiona las etiquetas disponibles para negocios y productos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadCategories(true)}
                        className="bg-white border border-gray-200 text-gray-600 p-3 rounded-xl hover:bg-gray-50 transition shadow-sm flex items-center justify-center active:scale-95"
                        title="Refrescar etiquetas"
                    >
                        <RotateCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Tooltip text="Eliminar etiquetas duplicadas automáticamente" position="bottom">
                        <button
                            onClick={handleDeduplicate}
                            className="bg-white text-amber-600 px-4 py-3 rounded-xl hover:bg-amber-50 border border-amber-200 transition flex items-center gap-2 text-sm font-bold active:scale-95 shadow-sm"
                        >
                            <X size={16} /> Deduplicar
                        </button>
                    </Tooltip>
                    <Tooltip text="Cargar etiquetas predeterminadas" position="bottom">
                        <button
                            onClick={handleSeed}
                            className="bg-white text-gray-600 px-4 py-3 rounded-xl hover:bg-gray-50 border border-gray-200 transition flex items-center gap-2 text-sm font-bold active:scale-95 shadow-sm"
                        >
                            <Archive size={16} /> Defaults
                        </button>
                    </Tooltip>
                    <Tooltip text="Crear una nueva etiqueta desde cero" position="bottom">
                        <button
                            onClick={openCreate}
                            className="bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-md font-bold active:scale-95"
                        >
                            <Plus size={20} /> <span className="hidden sm:inline">Nueva Etiqueta</span>
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-800">Categorías</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 sm:flex-none sm:w-64">
                            <Search className="text-gray-400 shrink-0" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar categorías..."
                                className="flex-1 outline-none text-gray-700 bg-transparent text-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                            {searchTerm && (
                                <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
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
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="p-4 w-16 text-center">Icono</th>
                                <th className="p-4">Nombre</th>
                                <th className="p-4 hidden sm:table-cell">Slug</th>
                                <th className="p-4">Uso</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        No se encontraron categorías
                                    </td>
                                </tr>
                            ) : (
                                paginatedCategories.map(cat => {
                                    const usage = usageMap[cat.id] || { venues: 0, products: 0, total: 0 };

                                    return (
                                        <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 text-center text-2xl">
                                                {cat.icon || '🏷️'}
                                            </td>
                                            <td className="p-4 font-medium text-gray-800">
                                                {cat.name}
                                            </td>
                                            <td className="p-4 hidden sm:table-cell text-gray-500 font-mono text-xs">
                                                {cat.slug}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    {usage.venues > 0 && (
                                                        <Link
                                                            to={`/admin/venues?search=${encodeURIComponent(cat.name)}`}
                                                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                            title="Ver negocios que usan esta etiqueta"
                                                        >
                                                            <Store size={12} />
                                                            {usage.venues} {usage.venues === 1 ? 'negocio' : 'negocios'}
                                                        </Link>
                                                    )}
                                                    {usage.products > 0 && (
                                                        <Link
                                                            to={`/products?search=${encodeURIComponent(cat.name)}`}
                                                            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 hover:underline"
                                                            title="Ver productos que usan esta etiqueta"
                                                        >
                                                            <Package size={12} />
                                                            {usage.products} {usage.products === 1 ? 'producto' : 'productos'}
                                                        </Link>
                                                    )}
                                                    {usage.total === 0 && (
                                                        <span className="text-xs text-gray-400 italic">Sin uso</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleToggleStatus(cat)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${cat.isActive !== false ? 'bg-emerald-600' : 'bg-gray-200'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cat.isActive !== false ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Tooltip text="Editar esta etiqueta">
                                                        <button
                                                            onClick={() => openEdit(cat)}
                                                            className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip text="Eliminar etiqueta permanentemente">
                                                        <button
                                                            onClick={() => handleDelete(cat.id)}
                                                            className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredCategories.length > 0 && (
                    <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-500 shrink-0">
                            {loadingMore ? 'Cargando...' : <>Mostrando <span className="font-semibold text-gray-700">{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredCategories.length)}</span> de <span className="font-semibold text-gray-700">{filteredCategories.length}{hasMore ? '+' : ''}</span> etiquetas</>}
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
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 sm:p-6 animate-in fade-in zoom-in duration-200 cursor-default max-h-[85vh] overflow-y-auto flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">
                                {formData.id ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-base"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Icono (Emoji)</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-base"
                                    placeholder="e.g. 🍔"
                                    value={formData.icon || ''}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive !== false}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700">Categoría Activa</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center gap-2 font-bold active:scale-95"
                                >
                                    <Save size={20} />
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
