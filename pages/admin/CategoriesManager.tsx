import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { VenueCategory } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Plus, Edit2, Trash2, Tag, X, Save, Archive, Store, Package, RotateCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import { logger } from '../../utils/logger';
import { DataTable, Column } from '../../components/common/DataTable';
import { useAdminTable } from '../../hooks/useAdminTable';
import { useAuth } from '../../context/AuthContext';
import { getCountFromServer, query, collection, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const CategoriesManager: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const { user: currentUser } = useAuth();
    const [usageMap, setUsageMap] = useState<Record<string, { venues: number; products: number; total: number }>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<VenueCategory>>({ isActive: true });

    const table = useAdminTable<VenueCategory>({
        fetchFn: async (size, cursor, term) => {
            const result = await adminService.getCategoriesPaginated(size, cursor, term);
            
            // Enrich usage data
            const usageUpdates: Record<string, { venues: number; products: number; total: number }> = {};
            await Promise.all(
                result.data.map(async (cat: any) => {
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
            
            return result as any;
        },
        initialPageSize: 50
    });

    // loadCategories replaced by table hook


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
            table.reload();
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
                table.reload();
            } catch (error) {
                logger.error('Error deleting category', error);
                toast.error('Error al eliminar la etiqueta');
            }
        }
    };

    const handleToggleStatus = async (category: VenueCategory) => {
        const newStatus = !category.isActive;
        try {
            await adminService.updateCategory(category.id, { isActive: newStatus }, currentUser?.id || 'system');
            table.reload();
        } catch (error) {
            logger.error('Error updating status', error);
            table.reload(); // Revert
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
            // we use table.isLoading here implicitly if we reload
            try {
                await adminService.seedDefaultCategories(currentUser?.id || 'system');
                toast.success('Categorías base cargadas');
                table.reload();
            } catch (error) {
                logger.error('Error seeding categories', error);
                toast.error('Error al cargar categorías');
            }
        }
    };

    const handleDeduplicate = async () => {
        const duplicates = Object.values(table.data.reduce((acc: Record<string, VenueCategory[]>, cat) => {
            const slug = cat.slug || cat.name.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]/g, '');
            if (!acc[slug]) acc[slug] = [];
            acc[slug].push(cat);
            return acc;
        }, {})).filter(group => group.length > 1);

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
            try {
                for (const group of duplicates) {
                    const toKeep = group.find(c => c.icon) || group[0];
                    const toDelete = group.filter(c => c.id !== toKeep.id);

                    for (const cat of toDelete) {
                        await adminService.deleteCategory(cat.id, currentUser?.id || 'system');
                    }
                }
                toast.success('Deduplicación completada con éxito.');
                table.reload();
            } catch (error) {
                logger.error('Error during deduplication', error);
                toast.error('Hubo un error durante la deduplicación.');
            }
        }
    };

    const columns = [
        {
            header: 'Icono',
            accessor: 'icon' as keyof VenueCategory,
            className: 'w-16 text-center text-2xl',
            render: (value: any) => value || '🏷️'
        },
        {
            header: 'Nombre',
            accessor: 'name' as keyof VenueCategory,
            sortable: true,
            className: 'font-bold text-gray-900'
        },
        {
            header: 'Slug',
            accessor: 'slug' as keyof VenueCategory,
            sortable: true,
            className: 'hidden sm:table-cell text-gray-500 font-mono text-xs'
        },
        {
            header: 'Uso en Plataforma',
            accessor: 'id' as keyof VenueCategory,
            render: (id: string, item: VenueCategory) => {
                const usage = usageMap[id] || { venues: 0, products: 0, total: 0 };
                return (
                    <div className="flex flex-col gap-1">
                        {usage.venues > 0 && (
                            <Link
                                to={`/admin/venues?search=${encodeURIComponent(item.name)}`}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase tracking-tight"
                            >
                                <Store size={12} />
                                {usage.venues} {usage.venues === 1 ? 'negocio' : 'negocios'}
                            </Link>
                        )}
                        {usage.products > 0 && (
                            <Link
                                to={`/products?search=${encodeURIComponent(item.name)}`}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline uppercase tracking-tight"
                            >
                                <Package size={12} />
                                {usage.products} {usage.products === 1 ? 'producto' : 'productos'}
                            </Link>
                        )}
                        {usage.total === 0 && (
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-50">Sin uso</span>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Estado',
            accessor: 'isActive' as keyof VenueCategory,
            className: 'text-center',
            render: (value: any, item: VenueCategory) => (
                <button
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${item.isActive !== false ? 'bg-emerald-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${item.isActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            )
        },
        {
            header: 'Acciones',
            accessor: 'id' as keyof VenueCategory,
            className: 'text-right',
            render: (id: string, item: VenueCategory) => (
                <div className="flex justify-end gap-1">
                    <Tooltip text="Editar esta etiqueta">
                        <button
                            onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                        >
                            <Edit2 size={18} />
                        </button>
                    </Tooltip>
                    <Tooltip text="Eliminar etiqueta permanentemente">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        >
                            <Trash2 size={18} />
                        </button>
                    </Tooltip>
                </div>
            )
        }
    ];

    if (table.isLoading && table.data.length === 0 && !isModalOpen) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6 overflow-x-hidden animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/20">
                            <Tag className="text-white" size={24} />
                        </div>
                        Gestión de Etiquetas
                    </h2>
                    <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest opacity-70">Control de categorización para negocios y productos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => table.reload()}
                        className="bg-white/10 backdrop-blur-md border border-white/10 text-white p-3 rounded-2xl hover:bg-white/20 transition shadow-sm flex items-center justify-center active:scale-95"
                        title="Refrescar etiquetas"
                    >
                        <RotateCw size={20} className={table.isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleDeduplicate}
                        className="bg-white text-amber-600 px-5 py-3 rounded-2xl hover:bg-amber-50 border border-amber-200 transition flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm"
                    >
                        <X size={16} /> Deduplicar
                    </button>
                    <button
                        onClick={handleSeed}
                        className="bg-white text-gray-600 px-5 py-3 rounded-2xl hover:bg-gray-50 border border-gray-200 transition flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm"
                    >
                        <Archive size={16} /> Defaults
                    </button>
                    <button
                        onClick={openCreate}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-xl shadow-emerald-900/20 text-[10px] font-black uppercase tracking-widest active:scale-95"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">Nueva Etiqueta</span>
                    </button>
                </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl border border-gray-100">
                <DataTable
                    columns={columns}
                    data={table.data}
                    placeholder="Buscar categorías por nombre o slug..."
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
                    onRowClick={(item) => openEdit(item)}
                    exportable
                    exportFilename="rescatto_categorias"
                    exportTransformer={(cat) => ({
                        name: cat.name,
                        slug: cat.slug,
                        usage: usageMap[cat.id]?.total || 0,
                        venues: usageMap[cat.id]?.venues || 0,
                        products: usageMap[cat.id]?.products || 0,
                        status: cat.isActive ? 'Activo' : 'Inactivo'
                    })}
                />
            </div>

            {table.hasMore && (
                <div className="flex justify-center pt-6">
                    <button
                        onClick={() => table.reload()}
                        disabled={table.isLoading}
                        className="bg-white border border-gray-100 text-gray-600 p-3 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-95 disabled:opacity-50 group"
                        title="Refrescar"
                    >
                        <RotateCw size={18} className={table.isLoading ? 'animate-spin text-emerald-600' : 'transition-transform group-hover:rotate-180 duration-500'} />
                    </button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-hidden animate-in fade-in duration-300"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200 cursor-default max-h-[90vh] overflow-y-auto flex flex-col border border-gray-100"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-xl">
                                    <Tag className="text-emerald-600" size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                    {formData.id ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre de la Categoría</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Hamburguesas"
                                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-bold"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Icono / Emoji</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Ej: 🍔"
                                        className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-bold text-center text-2xl"
                                        value={formData.icon || ''}
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                                        <Tag size={20} />
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-400 font-medium text-center">Usa emojis para darle vida a tu backoffice</p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex flex-col">
                                    <label htmlFor="isActive" className="text-xs font-black text-gray-700 uppercase tracking-tight">Estado de Actividad</label>
                                    <p className="text-[10px] text-gray-500 font-medium">Permite usar esta etiqueta en el sistema</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${formData.isActive !== false ? 'bg-emerald-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.isActive !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 text-gray-500 hover:bg-gray-100 rounded-2xl transition-colors font-black uppercase tracking-widest text-[10px]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 hover:shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] active:scale-95"
                                >
                                    <Save size={18} />
                                    Guardar Etiqueta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
