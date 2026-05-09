import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { flashDealService, FlashDealInput } from '../../services/flashDealService';
import { productService } from '../../services/productService';
import { adminService } from '../../services/adminService';
import { FlashDeal, Product, Venue, UserRole } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import {
    Zap, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
    Clock, Tag, Store, ChevronDown, X, AlertTriangle
} from 'lucide-react';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDatetimeLocal = (iso: string) => iso ? iso.slice(0, 16) : '';
const toISO = (local: string) => local ? new Date(local).toISOString() : '';

const statusBadge = (deal: FlashDeal) => {
    const now = Date.now();
    const end = new Date(deal.endTime).getTime();
    const start = new Date(deal.startTime).getTime();
    if (!deal.isActive) return { label: 'Inactivo', cls: 'bg-gray-100 text-gray-600' };
    if (now > end) return { label: 'Expirado', cls: 'bg-red-100 text-red-700' };
    if (now < start) return { label: 'Programado', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Activo', cls: 'bg-green-100 text-green-700' };
};

// ─── Form defaults ────────────────────────────────────────────────────────────

const emptyForm = (): Omit<FlashDealInput, 'venueId' | 'venueName'> => {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60_000);
    const end = new Date(now.getTime() + 2 * 3_600_000);
    return {
        title: '',
        description: '',
        productId: '',
        imageUrl: '',
        extraDiscountPct: 20,
        flashPrice: undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isActive: true,
        maxClaims: undefined,
        claimsCount: 0,
    };
};

// ─── Component ────────────────────────────────────────────────────────────────

export const FlashDealsManager: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirmDialog = useConfirm();

    const [deals, setDeals] = useState<FlashDeal[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreProducts, setHasMoreProducts] = useState(true);
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const [venues, setVenues] = useState<Venue[]>([]);
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMoreDeals, setLoadingMoreDeals] = useState(false);
    const [hasMoreDeals, setHasMoreDeals] = useState(true);
    const [dealsLastDoc, setDealsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingDeal, setEditingDeal] = useState<FlashDeal | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyForm());

    // ── Venue selection ───────────────────────────────────────────────────────

    const userId = user?.id;
    const userRole = user?.role;
    const userVenueId = user?.venueId;
    useEffect(() => {
        if (!userId) return;
        if (userRole === UserRole.SUPER_ADMIN) {
            adminService.getAllVenues().then(v => {
                setVenues(v);
                if (v.length > 0) setSelectedVenueId(v[0].id);
            });
        } else if (userVenueId) {
            setSelectedVenueId(userVenueId);
        }
    }, [userId, userRole, userVenueId]);

    // ── Load deals + products when venue changes ──────────────────────────────

    useEffect(() => {
        if (!selectedVenueId) return;
        setLoading(true);
        Promise.all([
            flashDealService.getDealsByVenuePage(selectedVenueId, null, 20),
            productService.getProductsByVenuePage(selectedVenueId, null, 20),
        ]).then(([d, p]) => {
            setDeals(d.data);
            setDealsLastDoc(d.lastDoc);
            setHasMoreDeals(d.hasMore);
            setProducts(p.products);
            setProductsLastDoc(p.lastDoc);
            setHasMoreProducts(p.hasMore);
        }).catch(err => {
            logger.error('FlashDealsManager load error:', err);
            toast.error('Error cargando flash deals');
        }).finally(() => setLoading(false));
    }, [selectedVenueId, toast]);

    // ── Modal helpers ─────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingDeal(null);
        setForm(emptyForm());
        setShowModal(true);
    };

    const openEdit = (deal: FlashDeal) => {
        setEditingDeal(deal);
        setForm({
            title: deal.title,
            description: deal.description || '',
            productId: deal.productId || '',
            imageUrl: deal.imageUrl || '',
            extraDiscountPct: deal.extraDiscountPct,
            flashPrice: deal.flashPrice,
            startTime: deal.startTime,
            endTime: deal.endTime,
            isActive: deal.isActive,
            maxClaims: deal.maxClaims,
            claimsCount: deal.claimsCount || 0,
        });
        setShowModal(true);
    };

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!selectedVenueId) return;
        if (!form.title.trim()) { toast.error('El título es obligatorio'); return; }
        if (!form.description?.trim()) { toast.error('La descripción es obligatoria'); return; }
        if (form.extraDiscountPct < 1 || form.extraDiscountPct > 100) {
            toast.error('El descuento extra debe estar entre 1 y 100%'); return;
        }
        if (new Date(form.endTime) <= new Date(form.startTime)) {
            toast.error('La fecha de fin debe ser posterior a la de inicio'); return;
        }

        const selectedProduct = products.find(p => p.id === form.productId);
        if (selectedProduct && selectedProduct.quantity === 0 && form.isActive) {
            toast.error('El producto seleccionado no tiene stock. Actívalo cuando haya unidades disponibles.');
            return;
        }

        const venueName = venues.find(v => v.id === selectedVenueId)?.name
            || user?.fullName
            || 'Negocio';

        const payload: FlashDealInput = {
            title: form.title.trim(),
            description: form.description?.trim() || '',
            venueId: selectedVenueId,
            venueName,
            productId: form.productId || undefined,
            imageUrl: form.imageUrl || selectedProduct?.imageUrl || undefined,
            extraDiscountPct: form.extraDiscountPct,
            flashPrice: form.flashPrice || undefined,
            startTime: form.startTime,
            endTime: form.endTime,
            isActive: form.isActive,
            maxClaims: form.maxClaims || undefined,
            claimsCount: form.claimsCount || 0,
        };

        setSaving(true);
        try {
            if (editingDeal) {
                await flashDealService.updateDeal(editingDeal.id, payload);
                toast.success('Flash deal actualizado');
            } else {
                await flashDealService.createDeal(payload);
                toast.success('Flash deal creado — ya visible para los clientes');
            }
            setShowModal(false);
            // Refresh list
            const refreshed = await flashDealService.getDealsByVenuePage(selectedVenueId, null, 20);
            setDeals(refreshed.data);
            setDealsLastDoc(refreshed.lastDoc);
            setHasMoreDeals(refreshed.hasMore);
        } catch (err) {
            logger.error('FlashDealsManager save error:', err);
            toast.error('Error guardando el flash deal');
        } finally {
            setSaving(false);
        }
    };

    const loadMoreDeals = async () => {
        if (!selectedVenueId || !hasMoreDeals || loadingMoreDeals) return;
        setLoadingMoreDeals(true);
        try {
            const next = await flashDealService.getDealsByVenuePage(selectedVenueId, dealsLastDoc, 20);
            setDeals(prev => [...prev, ...next.data]);
            setDealsLastDoc(next.lastDoc);
            setHasMoreDeals(next.hasMore);
        } catch (err) {
            logger.error('Error loading more deals:', err);
        } finally {
            setLoadingMoreDeals(false);
        }
    };

    const loadMoreProducts = async () => {
        if (!selectedVenueId || !hasMoreProducts || loadingMoreProducts) return;
        setLoadingMoreProducts(true);
        try {
            const next = await productService.getProductsByVenuePage(selectedVenueId, productsLastDoc, 20);
            setProducts(prev => [...prev, ...next.products]);
            setProductsLastDoc(next.lastDoc);
            setHasMoreProducts(next.hasMore);
        } catch (err) {
            logger.error('Error loading more products:', err);
        } finally {
            setLoadingMoreProducts(false);
        }
    };

    // ── Toggle active ─────────────────────────────────────────────────────────

    const handleToggle = async (deal: FlashDeal) => {
        try {
            await flashDealService.toggleActive(deal.id, !deal.isActive);
            setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, isActive: !d.isActive } : d));
            toast.success(deal.isActive ? 'Deal desactivado' : 'Deal activado');
        } catch (err) {
            toast.error('Error actualizando estado');
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (deal: FlashDeal) => {
        const ok = await confirmDialog({
            title: 'Eliminar Flash Deal',
            message: `¿Eliminar "${deal.title}"? Esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar',
        });
        if (!ok) return;
        try {
            await flashDealService.deleteDeal(deal.id);
            setDeals(prev => prev.filter(d => d.id !== deal.id));
            toast.success('Flash deal eliminado');
        } catch (err) {
            toast.error('Error eliminando el flash deal');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 overflow-x-hidden animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Zap className="text-yellow-500" size={26} />
                        Flash Deals
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Ofertas por tiempo limitado que generan urgencia y más ventas
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-md"
                >
                    <Plus size={18} />
                    Nuevo Deal
                </button>
            </div>

            {/* Super admin venue selector */}
            {user?.role === UserRole.SUPER_ADMIN && venues.length > 0 && (
                <div className="flex items-center gap-3">
                    <Store size={16} className="text-gray-400" />
                    <div className="relative">
                        <select
                            value={selectedVenueId || ''}
                            onChange={e => setSelectedVenueId(e.target.value)}
                            className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        >
                            {venues.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Info banner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                    <p className="font-semibold">¿Cómo funcionan los Flash Deals?</p>
                    <p className="mt-0.5 text-yellow-700">Aparecen en la pantalla principal de los clientes con un contador regresivo. El descuento extra se suma al descuento ya existente del producto.</p>
                </div>
            </div>

            {/* Deals list */}
            {loading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : deals.length === 0 ? (
                <EmptyState onAdd={openCreate} />
            ) : (
                <div className="grid gap-4">
                    {deals.map(deal => {
                        const { label, cls } = statusBadge(deal);
                        const linked = products.find(p => p.id === deal.productId);
                        return (
                            <div
                                key={deal.id}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-4"
                            >
                                {/* Image / icon */}
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    {deal.imageUrl ? (
                                        <img src={deal.imageUrl} alt={deal.title} loading="lazy" className="w-full h-full object-cover" />
                                    ) : (
                                        <Zap size={24} className="text-white" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-gray-900 truncate">{deal.title}</p>
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Tag size={11} />
                                            -{deal.extraDiscountPct}% extra
                                        </span>
                                        {linked && (
                                            <span className="flex items-center gap-1">
                                                <Store size={11} />
                                                {linked.name}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock size={11} />
                                            {new Date(deal.startTime).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            {' → '}
                                            {new Date(deal.endTime).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {deal.maxClaims && (
                                            <span className="text-gray-500">
                                                {deal.claimsCount || 0}/{deal.maxClaims} reclamados
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleToggle(deal)}
                                        className={`p-1.5 rounded-lg transition-colors ${deal.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                                        title={deal.isActive ? 'Desactivar' : 'Activar'}
                                    >
                                        {deal.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                    </button>
                                    <button
                                        onClick={() => openEdit(deal)}
                                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deal)}
                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {hasMoreDeals && (
                        <div className="flex justify-center">
                            <button
                                onClick={loadMoreDeals}
                                disabled={loadingMoreDeals}
                                className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                            >
                                {loadingMoreDeals ? 'Cargando...' : 'Cargar más deals'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <DealModal
                    form={form}
                    setForm={setForm}
                    products={products}
                    hasMoreProducts={hasMoreProducts}
                    loadingMoreProducts={loadingMoreProducts}
                    onLoadMoreProducts={loadMoreProducts}
                    editing={!!editingDeal}
                    saving={saving}
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center mb-4">
            <Zap size={36} className="text-yellow-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Sin Flash Deals activos</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Crea tu primer deal para generar urgencia y multiplicar tus ventas por 3×
        </p>
        <button
            onClick={onAdd}
            className="mt-6 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-white font-bold px-6 py-3 rounded-2xl transition-colors shadow-md"
        >
            <Plus size={18} />
            Crear primer Flash Deal
        </button>
    </div>
);

// ─── Deal Modal ───────────────────────────────────────────────────────────────

type FormState = ReturnType<typeof emptyForm>;

interface ModalProps {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    products: Product[];
    hasMoreProducts: boolean;
    loadingMoreProducts: boolean;
    onLoadMoreProducts: () => void;
    editing: boolean;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}

const DealModal: React.FC<ModalProps> = ({ form, setForm, products, hasMoreProducts, loadingMoreProducts, onLoadMoreProducts, editing, saving, onSave, onClose }) => {
    const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    const selectedProduct = products.find(p => p.id === form.productId);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
                    <div className="flex items-center gap-2">
                        <Zap size={20} className="text-yellow-500" />
                        <h2 className="text-lg font-black text-gray-900">
                            {editing ? 'Editar Flash Deal' : 'Nuevo Flash Deal'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Título */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Título del deal <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            placeholder="ej. ¡Almuerzo del día a mitad de precio!"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                    </div>

                    {/* Producto vinculado (opcional) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Producto vinculado <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <div className="relative">
                            <select
                                value={form.productId || ''}
                                onChange={e => set('productId', e.target.value)}
                                className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            >
                                <option value="">— Sin producto específico —</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.discountedPrice ? `(${formatCOP(p.discountedPrice)})` : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        {hasMoreProducts && (
                            <div className="mt-2 flex justify-start">
                                <button
                                    onClick={onLoadMoreProducts}
                                    disabled={loadingMoreProducts}
                                    className="px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                                >
                                    {loadingMoreProducts ? 'Cargando...' : 'Cargar más productos'}
                                </button>
                            </div>
                        )}
                        {selectedProduct && (
                            <div className="mt-1.5 space-y-1">
                                <p className="text-xs text-gray-500">
                                    Precio actual: {selectedProduct.originalPrice ? formatCOP(selectedProduct.originalPrice) : '—'} → {selectedProduct.discountedPrice ? formatCOP(selectedProduct.discountedPrice) : '—'}
                                </p>
                                {selectedProduct.quantity === 0 ? (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                                        <AlertTriangle size={13} />
                                        Este producto está agotado. No se puede activar el deal.
                                    </div>
                                ) : selectedProduct.quantity < 5 ? (
                                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-xs font-medium">
                                        <AlertTriangle size={13} />
                                        Stock bajo: solo {selectedProduct.quantity} unidades disponibles.
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Descuento extra + precio flash */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Descuento extra (%) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={form.extraDiscountPct}
                                onChange={e => set('extraDiscountPct', Number(e.target.value))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Precio flash (COP) <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={form.flashPrice || ''}
                                onChange={e => set('flashPrice', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="ej. 15000"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Inicio <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={formatDatetimeLocal(form.startTime)}
                                onChange={e => set('startTime', toISO(e.target.value))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Fin <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={formatDatetimeLocal(form.endTime)}
                                onChange={e => set('endTime', toISO(e.target.value))}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                        </div>
                    </div>

                    {/* Máx. reclamaciones */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Límite de reclamaciones <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={form.maxClaims || ''}
                            onChange={e => set('maxClaims', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="Sin límite"
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                    </div>

                    {/* URL imagen */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            URL de imagen <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            type="url"
                            value={form.imageUrl || ''}
                            onChange={e => set('imageUrl', e.target.value)}
                            placeholder="https://..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                    </div>

                    {/* Activo toggle */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Activar inmediatamente</p>
                            <p className="text-xs text-gray-500">Si está activo, aparece en la app para los clientes</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => set('isActive', !form.isActive)}
                            className={`w-12 h-6 rounded-full transition-colors duration-200 ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 mx-0.5 ${form.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-200 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <><LoadingSpinner size="sm" /><span>Guardando...</span></>
                        ) : (
                            <><Zap size={16} /><span>{editing ? 'Actualizar' : 'Crear Deal'}</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
