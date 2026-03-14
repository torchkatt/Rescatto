import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { Venue, VenueCategory, BUSINESS_TYPES_LIST } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Store, Plus, Search, X, Eye, EyeOff, RotateCw, MapPin, Loader2 } from 'lucide-react';
import { VenueCard } from '../../components/customer/venue/VenueCard';
import { VenueDetailsModal } from '../../components/customer/venue/VenueDetailsModal';
import { VenueMobilePreview } from '../../components/admin/VenueMobilePreview';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Tooltip } from '../../components/common/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { venueService } from '../../services/venueService';
import { COLOMBIAN_CITIES } from '../../data/colombianCities';
import { logger } from '../../utils/logger';

const CityCombobox: React.FC<{ value: string; onChange: (city: string) => void }> = ({ value, onChange }) => {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync query when value changes externally (e.g. form reset)
    useEffect(() => { setQuery(value); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                // If query doesn't match a valid city, restore last valid value
                const match = COLOMBIAN_CITIES.find(c => c.name.toLowerCase() === query.trim().toLowerCase());
                if (!match) setQuery(value);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [query, value]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COLOMBIAN_CITIES.slice(0, 40);
        return COLOMBIAN_CITIES.filter(
            c => c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q)
        ).slice(0, 40);
    }, [query]);

    const handleSelect = (cityName: string) => {
        onChange(cityName);
        setQuery(cityName);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    required
                    type="text"
                    className="w-full rounded-xl border-gray-300 border pl-9 pr-4 py-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
                    placeholder="Buscar ciudad o departamento…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    autoComplete="off"
                />
            </div>
            {open && filtered.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filtered.map((city, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                onMouseDown={() => handleSelect(city.name)}
                                className={`w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-2 ${
                                    city.name === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-800'
                                }`}
                            >
                                <span className="text-sm">{city.name}</span>
                                <span className="text-xs text-gray-400 ml-1">— {city.department}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export const VenuesManager: React.FC = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const { user: currentUser, switchVenue } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const querySearch = searchParams.get('search') || '';

    const [venues, setVenues] = useState<Venue[]>([]);
    const [categories, setCategories] = useState<VenueCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(querySearch);
    const [selectedVenueDetails, setSelectedVenueDetails] = useState<Venue | null>(null);
    const [showPreview, setShowPreview] = useState(true);
    const [previewVenue, setPreviewVenue] = useState<Venue | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Venue>>({});
    const [geocoding, setGeocoding] = useState(false);

    // Colombia bounding box
    const isInColombia = (lat: number, lng: number) =>
        lat >= -4.5 && lat <= 12.5 && lng >= -82.0 && lng <= -66.5;

    const geocodeAddress = async () => {
        const addressStr = [formData.address, formData.city].filter(Boolean).join(', ');
        if (!addressStr) { toast.error('Ingresa una dirección primero'); return; }
        setGeocoding(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressStr)}&format=json&limit=1&countrycodes=co&accept-language=es`;
            const res = await fetch(url, { headers: { 'User-Agent': 'RescattoApp/1.0' } });
            const results = await res.json();
            if (results.length > 0) {
                const lat = parseFloat(results[0].lat);
                const lng = parseFloat(results[0].lon);
                if (!isInColombia(lat, lng)) {
                    toast.error('Las coordenadas obtenidas están fuera de Colombia. Verifica la dirección.');
                    return;
                }
                setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                toast.success('Coordenadas actualizadas correctamente');
            } else {
                toast.error('No se encontraron coordenadas en Colombia para esa dirección');
            }
        } catch {
            toast.error('Error al geocodificar la dirección');
        } finally {
            setGeocoding(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const [isLoadMoreLoading, setIsLoadMoreLoading] = useState(false);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // Load Categories (Typically small list, fine to keep all)
            try {
                const categoriesData = await adminService.getAllCategories();
                setCategories(categoriesData);
            } catch (err) {
                logger.error('Error loading categories:', err);
            }

            // Load Venues Paginated (First page)
            // Load Venues
            try {
                if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.VENUE_OWNER) {
                    // Restricted access: Fetch specific venues only
                    const adminVenueIds = currentUser?.venueIds || (currentUser?.venueId ? [currentUser.venueId] : []);

                    if (adminVenueIds.length === 0) {
                        setVenues([]);
                    } else {
                        // Parallel fetch for specific IDs
                        const venuesData = await Promise.all(
                            adminVenueIds.map(id => venueService.getVenueById(id))
                        );
                        setVenues(venuesData.filter((v): v is Venue => v !== null));
                    }

                    // Disable pagination for filtered view
                    setHasMore(false);
                    setLastDoc(null);

                } else {
                    // Super Admin: Fetch all paginated
                    const result = await adminService.getVenuesPaginated(9);
                    setVenues(result.data);
                    setLastDoc(result.lastDoc);
                    setHasMore(result.hasMore);
                }
            } catch (err) {
                logger.error('Error loading venues:', err);
            }
        } catch (error) {
            logger.error('Critical error in loadData', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreVenues = async () => {
        if (!hasMore || isLoadMoreLoading) return;
        setIsLoadMoreLoading(true);
        try {
            const result = await adminService.getVenuesPaginated(9, lastDoc);
            setVenues(prev => [...prev, ...result.data]);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        } catch (error) {
            logger.error('Error loading more venues:', error);
        } finally {
            setIsLoadMoreLoading(false);
        }
    };

    const loadVenues = async () => {
        // Reload fresh (e.g. after edit)
        // Reload logic compatible with role
        setLoading(true);
        setVenues([]);
        setLastDoc(null);

        await loadInitialData();
        setLoading(false);
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                // Update
                await adminService.updateVenue(formData.id, formData, currentUser?.id || 'system');
            } else {
                // Create
                const newVenue: Omit<Venue, 'id'> = {
                    name: formData.name || '',
                    address: formData.address || '',
                    city: formData.city || 'Bogotá',
                    closingTime: formData.closingTime || '22:00',
                    rating: 5, // Default
                    latitude: formData.latitude || 0,
                    longitude: formData.longitude || 0,
                    imageUrl: formData.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                    categories: formData.categories || [],
                    businessType: formData.businessType || 'Restaurante',
                    // Default Delivery Config
                    deliveryConfig: formData.deliveryConfig || {
                        isEnabled: true,
                        baseFee: 3000,
                        pricePerKm: 1000,
                        maxDistance: 10,
                        minOrderAmount: 0
                    }
                };
                await adminService.createVenue(newVenue, currentUser?.id || 'system');
            }

            // Clear cache to ensure fresh data is loaded
            venueService.clearCache();

            setIsModalOpen(false);
            setFormData({});
            loadVenues();
        } catch (error) {
            logger.error('Error saving venue', error);
            toast.error('Error al guardar el negocio');
        }
    };

    const handleDelete = async (venueId: string) => {
        const confirmed = await confirm({
            title: '¿Eliminar negocio?',
            message: 'Esta acción eliminará permanentemente el negocio y todos sus productos asociados.',
            confirmLabel: 'Eliminar',
            variant: 'danger'
        });

        if (confirmed) {
            try {
                await adminService.deleteVenue(venueId, currentUser?.id || 'system');
                toast.success('Negocio eliminado correctamente');
                loadVenues();
            } catch (error) {
                logger.error('Error deleting venue', error);
                toast.error('Error al eliminar el negocio');
            }
        }
    };

    const openEdit = (venue: Venue) => {
        setFormData(venue);
        setIsModalOpen(true);
    };

    const openCreate = () => {
        setFormData({});
        setIsModalOpen(true);
    };

    const filteredVenues = venues.filter(venue =>
        venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        venue.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && !isModalOpen) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Store className="text-emerald-600" />
                    Gestión de Negocios
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showPreview
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                        {showPreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
                    </button>
                    <button
                        onClick={() => loadInitialData()}
                        className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center"
                        title="Refrescar negocios"
                    >
                        <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Tooltip text="Registrar un nuevo restaurante o comercio" position="left">
                        <button
                            onClick={openCreate}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm"
                        >
                            <Plus size={18} /> Nuevo Negocio
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o dirección..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex gap-6 items-start">
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Grid Layout */}
                    {filteredVenues.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic">
                            No se encontraron negocios.
                        </div>
                    ) : (
                        <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                            {filteredVenues.map(venue => (
                                <div key={venue.id} className="h-full">
                                    <VenueCard
                                        venue={venue}
                                        onClick={(v) => {
                                            setPreviewVenue(v);
                                            // Force modal open if preview is hidden or if on mobile (width < 1024px)
                                            if (!showPreview || window.innerWidth < 1024) {
                                                setSelectedVenueDetails(v);
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Load More Button */}
                    {hasMore && !searchTerm && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMoreVenues}
                                disabled={isLoadMoreLoading}
                                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-6 py-2 rounded-full font-bold shadow-sm transition-all flex items-center gap-2"
                            >
                                {isLoadMoreLoading ? 'Cargando...' : 'Ver más negocios 👇'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Preview Panel */}
                {showPreview && (
                    <div className="hidden lg:block w-80 xl:w-96 shrink-0 sticky top-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-gray-900 rounded-t-xl p-3 text-white text-center text-xs font-bold tracking-wider uppercase">
                            VISTA PREVIA DEL CLIENTE
                        </div>
                        <div className="bg-gray-100 rounded-b-xl p-6 border border-gray-200 shadow-inner min-h-[600px] flex flex-col items-center justify-start">
                            {previewVenue ? (
                                <div className="space-y-6 w-full">
                                    <VenueMobilePreview venue={previewVenue} />

                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                        <h4 className="font-bold text-gray-800 mb-2 text-sm">Acciones Rápidas</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setSelectedVenueDetails(previewVenue)}
                                                className="bg-emerald-50 text-emerald-700 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
                                            >
                                                Ver Detalles
                                            </button>
                                            <button
                                                onClick={() => openEdit(previewVenue)}
                                                className="bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(previewVenue.id)}
                                                disabled={currentUser?.role !== UserRole.SUPER_ADMIN}
                                                className={`col-span-2 py-2 rounded-lg text-xs font-bold transition ${currentUser?.role === UserRole.SUPER_ADMIN
                                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                title={currentUser?.role !== UserRole.SUPER_ADMIN ? "Solo el Super Admin puede eliminar negocios" : "Eliminar Negocio"}
                                            >
                                                Eliminar Negocio
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800">
                                        <p className="font-bold mb-1">💡 Tips para tu negocio:</p>
                                        Asegúrate de tener una imagen de alta calidad y horarios actualizados para atraer más clientes.
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 mt-20">
                                    <Store size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Selecciona un negocio para ver la vista previa</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 sm:p-6 animate-in fade-in zoom-in duration-200 max-h-[85vh] overflow-y-auto flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h3 className="text-xl font-bold text-gray-900">
                                {formData.id ? 'Editar Negocio' : 'Nuevo Negocio'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 shrink-0">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full rounded-xl border-gray-300 border p-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
                                    placeholder="Ej. Restaurante Las Delicias"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full rounded-xl border-gray-300 border p-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
                                    placeholder="Ej. Calle 123 #45-67"
                                    value={formData.address || ''}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            <div>
                                <CityCombobox
                                    value={formData.city || ''}
                                    onChange={city => setFormData({ ...formData, city })}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Coordenadas GPS</label>
                                    <button
                                        type="button"
                                        onClick={geocodeAddress}
                                        disabled={geocoding}
                                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {geocoding ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                                        {geocoding ? 'Buscando...' : 'Autocompletar con dirección'}
                                    </button>
                                </div>
                                {formData.latitude != null && formData.longitude != null &&
                                    !isInColombia(formData.latitude, formData.longitude) && (
                                    <div className="mb-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                                        <MapPin size={13} className="shrink-0" />
                                        Las coordenadas actuales están fuera de Colombia. Usa "Autocompletar con dirección" para corregirlas.
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Latitud</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="w-full rounded-xl border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="4.6097"
                                            value={formData.latitude ?? ''}
                                            onChange={e => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Longitud</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="w-full rounded-xl border-gray-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="-74.0817"
                                            value={formData.longitude ?? ''}
                                            onChange={e => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Cierre</label>
                                <input
                                    required
                                    type="time"
                                    className="w-full rounded-xl border-gray-300 border p-3 text-base bg-white appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
                                    value={formData.closingTime || ''}
                                    onChange={e => setFormData({ ...formData, closingTime: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Negocio</label>
                                    <select
                                        required
                                        className="w-full rounded-xl border-gray-300 border p-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none bg-white transition-all duration-200"
                                        value={formData.businessType || ''}
                                        onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {BUSINESS_TYPES_LIST.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas / Especialidades</label>
                                    {categories.length > 0 ? (
                                        <select
                                            className="w-full rounded-xl border-gray-300 border p-3 text-base focus:ring-2 focus:ring-emerald-500 outline-none bg-white transition-all duration-200"
                                            value={formData.categories?.[0] || ''}
                                            onChange={e => setFormData({ ...formData, categories: [e.target.value] })}
                                        >
                                            <option value="">Seleccionar etiqueta principal...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>
                                                    {cat.icon || '🏷️'} {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                            placeholder="Crear etiquetas primero"
                                            disabled
                                        />
                                    )}
                                    {categories.length === 0 && (
                                        <p className="text-xs text-orange-500 mt-1">Crea etiquetas en la sección de Etiquetas.</p>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    🛵 Configuración de Domicilios
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="deliveryEnabled"
                                            checked={formData.deliveryConfig?.isEnabled || false}
                                            onChange={(e) => {
                                                const isEnabled = e.target.checked;
                                                const currentConfig = formData.deliveryConfig || {
                                                    baseFee: 3000,
                                                    pricePerKm: 1000,
                                                    maxDistance: 10,
                                                    minOrderAmount: 0
                                                };

                                                setFormData({
                                                    ...formData,
                                                    deliveryConfig: {
                                                        ...currentConfig,
                                                        isEnabled
                                                    }
                                                });
                                            }}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <label htmlFor="deliveryEnabled" className="text-sm font-medium text-gray-700">
                                            Habilitar Domicilios
                                        </label>
                                    </div>

                                    {formData.deliveryConfig?.isEnabled && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa Base ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                                    value={formData.deliveryConfig.baseFee || 0}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        deliveryConfig: { ...formData.deliveryConfig!, baseFee: Number(e.target.value) }
                                                    })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Precio por Km ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                                    value={formData.deliveryConfig.pricePerKm || 0}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        deliveryConfig: { ...formData.deliveryConfig!, pricePerKm: Number(e.target.value) }
                                                    })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Distancia Máxima (km)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                                    value={formData.deliveryConfig.maxDistance || 5}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        deliveryConfig: { ...formData.deliveryConfig!, maxDistance: Number(e.target.value) }
                                                    })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Pedido Mínimo ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                                    value={formData.deliveryConfig.minOrderAmount || 0}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        deliveryConfig: { ...formData.deliveryConfig!, minOrderAmount: Number(e.target.value) }
                                                    })}
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Envío GRATIS desde ($)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="Opcional"
                                                    className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                                    value={formData.deliveryConfig.freeDeliveryThreshold || ''}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        deliveryConfig: { ...formData.deliveryConfig!, freeDeliveryThreshold: e.target.value ? Number(e.target.value) : undefined }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">URL de Imagen (Opcional)</label>
                                <input
                                    type="url"
                                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    placeholder="https://..."
                                    value={formData.imageUrl || ''}
                                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-emerald-600 rounded-lg text-white font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                >
                                    {formData.id ? 'Guardar Cambios' : 'Crear Negocio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Venue Details Modal */}
            {selectedVenueDetails && (
                <VenueDetailsModal
                    venue={selectedVenueDetails}
                    onClose={() => setSelectedVenueDetails(null)}
                    onEdit={(venue) => openEdit(venue)}
                    onDelete={(venueId) => handleDelete(venueId)}
                />
            )}
        </div>
    );
};
