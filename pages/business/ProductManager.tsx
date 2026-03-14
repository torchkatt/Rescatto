import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { productService } from '../../services/productService';
import { useAuth } from '../../context/AuthContext';
import { Product, ProductType, Permission, VenueCategory, Venue, UserRole } from '../../types';
import { PermissionGate } from '../../components/PermissionGate';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { Plus, Pencil, Trash2, Package, Search, X, Store, Eye, EyeOff, RotateCw, AlertTriangle, Clock, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import MobilePreview from '../../components/MobilePreview';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { geminiService } from '../../services/geminiService';
import { Sparkles } from 'lucide-react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export const ProductManager: React.FC = () => {
    const toast = useToast();
    const confirmDialog = useConfirm();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [availableTags, setAvailableTags] = useState<VenueCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

    // Super Admin Venue Selection
    const [searchParams] = useSearchParams();
    const querySearch = searchParams.get('search') || '';

    const [venues, setVenues] = useState<Venue[]>([]);
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState(querySearch);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        type: ProductType.SPECIFIC_DISH,
        originalPrice: 0,
        discountedPrice: 0,
        quantity: 0,
        imageUrl: '',
        description: '',
        availableUntil: '',
        isDynamicPricing: false,
        isRecurring: false,
        recurrencyDays: [] as string[],
        tags: [] as string[],
    });

    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    useEffect(() => {
        if (user) {
            loadTags();

            if (user.role === UserRole.SUPER_ADMIN || (user.venueIds && user.venueIds.length > 0)) {
                loadVenues();
            } else if (user.venueId) {
                setSelectedVenueId(user.venueId);
            } else {
                setLoading(false);
            }
        }
    }, [user?.id, user?.role, user?.venueId, JSON.stringify(user?.venueIds)]);

    useEffect(() => {
        if (selectedVenueId) {
            loadProducts(true);
        }
    }, [selectedVenueId]);

    const loadVenues = async () => {
        try {
            let filteredVenues: Venue[];
            if (user?.role === UserRole.SUPER_ADMIN) {
                filteredVenues = await adminService.getAllVenues();
            } else if (user?.venueIds && user.venueIds.length > 0) {
                // Fetch only assigned venues
                const all = await adminService.getAllVenues();
                filteredVenues = all.filter(v => user.venueIds?.includes(v.id));
            } else {
                filteredVenues = [];
            }

            setVenues(filteredVenues);
            if (filteredVenues.length > 0) {
                setSelectedVenueId(filteredVenues[0].id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            logger.error('Error loading venues:', error);
            setLoading(false);
        }
    };

    const loadTags = async () => {
        try {
            const tags = await adminService.getAllCategories();
            setAvailableTags(tags);
        } catch (error) {
            logger.error('Error loading tags:', error);
        }
    };

    const loadProducts = async (initial = false) => {
        if (!selectedVenueId) return;

        if (initial) {
            setLoading(true);
            setProducts([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const page = await productService.getProductsByVenuePage(selectedVenueId, initial ? null : lastDoc, 20);
            const nextProducts = initial ? page.products : [...products, ...page.products];
            setProducts(nextProducts);
            setLastDoc(page.lastDoc);
            setHasMore(page.hasMore);
            if (nextProducts.length > 0 && !selectedProduct) {
                setSelectedProduct(nextProducts[0]);
            }
        } catch (error) {
            logger.error('Error loading products:', error);
        } finally {
            if (initial) setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                category: product.category || '',
                type: product.type,
                originalPrice: product.originalPrice,
                discountedPrice: product.discountedPrice,
                quantity: product.quantity,
                imageUrl: product.imageUrl,
                description: product.description || '',
                availableUntil: product.availableUntil.split('T')[0], // Format for input[type=date]
                isDynamicPricing: product.isDynamicPricing,
                isRecurring: product.isRecurring || false,
                recurrencyDays: product.recurrencyDays || [],
                tags: product.tags || [],
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                category: '',
                type: ProductType.SPECIFIC_DISH,
                originalPrice: 0,
                discountedPrice: 0,
                quantity: 0,
                imageUrl: 'https://picsum.photos/400/300',
                description: '',
                availableUntil: new Date().toISOString().split('T')[0],
                isDynamicPricing: false,
                isRecurring: false,
                recurrencyDays: [],
                tags: [],
            });
        }
        setShowModal(true);
    };

    const handleAIGenerate = async () => {
        if (!selectedVenueId) return;
        
        setIsGeneratingAI(true);
        try {
            const venue = venues.find(v => v.id === selectedVenueId);
            const suggestion = await geminiService.generateProductSuggestion(
                venue?.businessType || 'Restaurante',
                formData.type
            );
            
            setFormData(prev => ({
                ...prev,
                name: suggestion.name,
                description: suggestion.description
            }));
            
            toast.success('¡Sugerencia generada con éxito! ✨');
        } catch (error) {
            logger.error('Error fallback AI:', error);
            toast.error('No se pudo generar la sugerencia');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProduct(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedVenueId) return;

        const productData = {
            ...formData,
            venueId: selectedVenueId,
            availableUntil: new Date(formData.availableUntil).toISOString(),
        };

        try {
            const productToSave = {
                name: productData.name,
                category: productData.category,
                type: productData.type as ProductType,
                originalPrice: productData.originalPrice,
                discountedPrice: productData.discountedPrice,
                quantity: productData.quantity,
                imageUrl: productData.imageUrl,
                availableUntil: productData.availableUntil,
                isDynamicPricing: productData.isDynamicPricing,
                isRecurring: productData.isRecurring,
                recurrencyDays: productData.recurrencyDays,
                description: productData.description,
                tags: productData.tags || [],
                venueId: productData.venueId
            };

            if (editingProduct) {
                // Update existing product
                await productService.updateProduct(editingProduct.id, productToSave, selectedVenueId);
                setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...productToSave } : p));
                if (selectedProduct?.id === editingProduct.id) {
                    setSelectedProduct({ ...selectedProduct, ...productToSave } as Product);
                }
            } else {
                // Create new product
                const newProduct = await productService.createProduct(productToSave);
                setProducts([...products, newProduct]);
                setSelectedProduct(newProduct);
            }

            toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
            handleCloseModal();
            loadProducts(true);
        } catch (error) {
            logger.error('Error saving product:', error);
            toast.error('Error al guardar el producto');
        }
    };

    const handleDelete = async (productId: string) => {
        const confirmed = await confirmDialog({
            title: '¿Eliminar producto?',
            message: '¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            await productService.deleteProduct(productId, selectedVenueId);
            setProducts(products.filter(p => p.id !== productId));
            if (selectedProduct?.id === productId) {
                setSelectedProduct(null);
            }
            toast.success('Producto eliminado');
        } catch (error) {
            logger.error('Error deleting product:', error);
            toast.error('Error al eliminar el producto');
        }
    };

    const handleDuplicate = (product: Product) => {
        setEditingProduct(null);
        setFormData({
            name: `Copia de ${product.name}`,
            category: product.category,
            type: product.type,
            originalPrice: product.originalPrice,
            discountedPrice: product.discountedPrice,
            quantity: 0,
            imageUrl: product.imageUrl,
            description: product.description || '',
            availableUntil: new Date().toISOString().split('T')[0],
            isDynamicPricing: product.isDynamicPricing,
            isRecurring: product.isRecurring || false,
            recurrencyDays: product.recurrencyDays || [],
            tags: product.tags || [],
        });
        setShowModal(true);
        toast.info?.('Producto duplicado — ajusta el stock y la fecha antes de guardar');
    };

    // Stock + expiry alerts
    const now = new Date();
    const LOW_STOCK_THRESHOLD = 3;
    const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= LOW_STOCK_THRESHOLD);
    const expiredProducts = products.filter(p => p.availableUntil && new Date(p.availableUntil) < now && p.quantity > 0);

    const filteredProducts = products.filter(product =>
        (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner fullPage />;

    if (!selectedVenueId && user?.role !== UserRole.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                <Package className="text-gray-300 mb-4" size={64} />
                <h2 className="text-xl font-bold text-gray-800 mb-2">No tienes una sede asignada</h2>
                <p className="text-gray-500 max-w-md">
                    Para gestionar productos, tu usuario debe estar asociado a una sede (Venue).
                    Si eres Super Admin, asimílate una sede o usa el gestor de negocios.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 overflow-x-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Package className="text-emerald-600" />
                        Gestión de Catálogo
                    </h2>
                    {(user?.role === UserRole.SUPER_ADMIN || (user?.venueIds && user.venueIds.length > 1)) && (
                        <div className="flex items-center gap-2 mt-2">
                            <Store size={16} className="text-gray-500" />
                            <select
                                className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none"
                                value={selectedVenueId || ''}
                                onChange={(e) => setSelectedVenueId(e.target.value)}
                            >
                                {venues.map(venue => (
                                    <option key={venue.id} value={venue.id}>
                                        {venue.name} ({venue.businessType})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            loadTags();
                            if (user?.role === UserRole.SUPER_ADMIN) loadVenues();
                            if (selectedVenueId) loadProducts();
                        }}
                        className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center"
                        title="Refrescar catálogo"
                    >
                        <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showPreview ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                        {showPreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
                    </button>
                    <PermissionGate requires={Permission.CREATE_PRODUCTS}>
                        <Tooltip text="Añadir un nuevo producto al catálogo" position="left">
                            <Button onClick={() => handleOpenModal()}>
                                <Plus size={18} />
                                Nuevo Producto
                            </Button>
                        </Tooltip>
                    </PermissionGate>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar producto por nombre o categoría..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Stock & Expiry Alerts Banner */}
            {(lowStockProducts.length > 0 || expiredProducts.length > 0) && (
                <div className="space-y-2">
                    {expiredProducts.length > 0 && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <Clock size={18} className="text-red-600 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <span className="font-bold text-red-700">
                                    {expiredProducts.length} producto{expiredProducts.length > 1 ? 's' : ''} vencido{expiredProducts.length > 1 ? 's' : ''}:
                                </span>{' '}
                                <span className="text-red-600">
                                    {expiredProducts.map(p => p.name).join(', ')}. Actualiza su fecha de disponibilidad o elimínalos.
                                </span>
                            </div>
                        </div>
                    )}
                    {lowStockProducts.length > 0 && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <span className="font-bold text-amber-700">
                                    Stock bajo en {lowStockProducts.length} producto{lowStockProducts.length > 1 ? 's' : ''}:
                                </span>{' '}
                                <span className="text-amber-600">
                                    {lowStockProducts.map(p => `${p.name} (${p.quantity} restante${p.quantity > 1 ? 's' : ''})`).join(', ')}.
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                    <Package className="mx-auto mb-4 text-gray-300" size={64} />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No se encontraron productos</h3>
                    <p className="text-gray-500 mb-6">Intenta con otra búsqueda o crea un nuevo producto</p>
                    <PermissionGate requires={Permission.CREATE_PRODUCTS}>
                        <Button onClick={() => handleOpenModal()}>
                            Crear Producto
                        </Button>
                    </PermissionGate>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => setSelectedProduct(product)}
                                    className={`bg-white rounded-xl overflow-hidden shadow-sm border transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:z-10 cursor-pointer ${selectedProduct?.id === product.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-100 hover:border-emerald-500/30'}`}
                                >
                                    <div className="relative">
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="w-full h-40 object-cover"
                                        />
                                        {/* Stock badge */}
                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold shadow-sm backdrop-blur-sm ${product.quantity === 0
                                            ? 'bg-gray-800/80 text-white'
                                            : product.quantity <= LOW_STOCK_THRESHOLD
                                                ? 'bg-amber-500/90 text-white'
                                                : 'bg-white/90 text-gray-700'
                                            }`}>
                                            {product.quantity === 0 ? 'Sin stock' : `Stock: ${product.quantity}`}
                                        </div>
                                        {/* Expired badge */}
                                        {product.availableUntil && new Date(product.availableUntil) < now && (
                                            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-red-600/90 text-white rounded text-[10px] font-bold shadow-sm backdrop-blur-sm">
                                                <Clock size={10} /> Vencido
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4">
                                        <h3 className="font-bold text-gray-800 mb-1 text-sm truncate">{product.name}</h3>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-base font-bold text-emerald-600">
                                                    {formatCOP(product.discountedPrice)}
                                                </p>
                                                <p className="text-xs text-gray-400 line-through">
                                                    {formatCOP(product.originalPrice)}
                                                </p>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 font-medium">
                                                {product.type === ProductType.SURPRISE_PACK ? 'Sorpresa' : 'Específico'}
                                            </span>
                                        </div>

                                        <div className="flex gap-2">
                                            <PermissionGate requires={Permission.EDIT_PRODUCTS}>
                                                <Tooltip text="Editar información del producto">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 active:scale-95 transition-all duration-200 text-xs font-semibold"
                                                    >
                                                        <Pencil size={14} /> Editar
                                                    </button>
                                                </Tooltip>
                                            </PermissionGate>

                                            <PermissionGate requires={Permission.EDIT_PRODUCTS}>
                                                <Tooltip text="Duplicar producto con datos pre-cargados">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicate(product); }}
                                                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-95 transition-all duration-200"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </Tooltip>
                                            </PermissionGate>

                                            <PermissionGate requires={Permission.DELETE_PRODUCTS}>
                                                <Tooltip text="Eliminar permanentemente del catálogo">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                                                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 active:scale-95 transition-all duration-200"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Tooltip>
                                            </PermissionGate>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {hasMore && searchTerm.length === 0 && (
                            <div className="flex justify-center">
                                <button
                                    onClick={() => loadProducts(false)}
                                    disabled={loadingMore}
                                    className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                                >
                                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Preview Panel */}
                    {showPreview && selectedProduct && (
                        <div className="hidden lg:flex w-80 flex-col sticky top-6 self-start">
                            <div className="bg-gray-900 text-white p-3 rounded-t-xl text-center text-xs font-bold tracking-wider">
                                VISTA PREVIA DEL CLIENTE
                            </div>
                            <div className="bg-white border-x border-b border-gray-200 p-6 rounded-b-xl shadow-lg flex flex-col items-center">
                                <MobilePreview
                                    product={selectedProduct}
                                    venueName={venues.find(v => v.id === selectedVenueId)?.name || "Tu Negocio"}
                                />
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 w-full">
                                    <h4 className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                                        <Eye size={12} /> Tips para tu oferta:
                                    </h4>
                                    <p className="text-[10px] text-blue-700 leading-relaxed">
                                        Asegúrate de que la foto sea apetitosa. Las ofertas que terminan entre 20:00 y 21:00 tienen un 30% más de ventas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden"
                    onClick={handleCloseModal}
                >
                    <div
                        className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col cursor-default"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-xl font-bold">
                                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Nombre del Producto *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleAIGenerate}
                                            disabled={isGeneratingAI}
                                            className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50 transition-all bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
                                        >
                                            <Sparkles size={12} className={isGeneratingAI ? 'animate-spin' : ''} />
                                            {isGeneratingAI ? 'Generando...' : 'Sugerir con IA'}
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                        required
                                        placeholder="Ej: Pack Sorpresa Familiar"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all duration-200 h-24 resize-none"
                                        placeholder="Describe brevemente qué puede incluir este pack..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Categoría
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="Ej: Platos Fuertes"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tipo *
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as ProductType })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                    >
                                        <option value={ProductType.SPECIFIC_DISH}>Plato Específico</option>
                                        <option value={ProductType.SURPRISE_PACK}>Paquete Sorpresa</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Precio Original ($) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.originalPrice}
                                        onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) })}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Precio Oferta ($) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.discountedPrice}
                                        onChange={(e) => setFormData({ ...formData, discountedPrice: parseFloat(e.target.value) })}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base font-bold text-emerald-600 transition-all duration-200"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Cantidad Disponible *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                        min="0"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Disponible Hasta *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.availableUntil}
                                        onChange={(e) => setFormData({ ...formData, availableUntil: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white appearance-none min-w-0 focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        URL de Imagen
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-base transition-all duration-200"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas (Opcional)</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {formData.tags?.map(tag => (
                                            <span key={tag} className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                                                    className="hover:text-emerald-900"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <select
                                        className="w-full rounded-xl border-gray-300 border py-3 px-4 text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white transition-all duration-200"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val && !formData.tags?.includes(val)) {
                                                setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), val] }));
                                            }
                                            e.target.value = '';
                                        }}
                                    >
                                        <option value="">Añadir etiqueta...</option>
                                        {availableTags
                                            .filter(tag => !formData.tags?.includes(tag.name))
                                            .map(tag => (
                                                <option key={tag.id} value={tag.name}>
                                                    {tag.icon || '🏷️'} {tag.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <input
                                            type="checkbox"
                                            id="is-recurring"
                                            className="w-4 h-4 text-blue-600 rounded"
                                            checked={formData.isRecurring}
                                            onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                                        />
                                        <label htmlFor="is-recurring" className="text-sm text-gray-700 font-medium cursor-pointer">
                                            Publicación Recurrente
                                            <span className="block text-xs text-gray-500 font-normal">Publicar automáticamente este producto en los días seleccionados.</span>
                                        </label>
                                    </div>
                                    
                                    {formData.isRecurring && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                                                const dayCodes = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                                                const code = dayCodes[idx];
                                                const isActive = formData.recurrencyDays.includes(code);
                                                return (
                                                    <button
                                                        key={code}
                                                        type="button"
                                                        onClick={() => {
                                                            const newDays = isActive 
                                                                ? formData.recurrencyDays.filter(d => d !== code)
                                                                : [...formData.recurrencyDays, code];
                                                            setFormData({ ...formData, recurrencyDays: newDays });
                                                        }}
                                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                            isActive 
                                                                ? 'bg-blue-600 text-white shadow-md' 
                                                                : 'bg-white border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500'
                                                        }`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button type="submit" className="w-full sm:flex-1 py-3.5 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all duration-200">
                                    {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                                </Button>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="w-full sm:w-auto px-6 py-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all duration-200 font-bold text-gray-600 shadow-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManager;
