import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venueService } from '../../services/venueService';
import { Venue, Product, RatingStats } from '../../types';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { VenueDetailSkeletonLoader } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { Countdown } from '../../components/customer/common/Countdown';
import { ArrowLeft, MapPin, Clock, Star, ShoppingCart, Flame, Users, Search, X, Heart } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { getRatingStats } from '../../services/ratingService';
import { logger } from '../../utils/logger';
import { isProductAvailable, isProductExpired } from '../../utils/productAvailability';
import { formatCOP } from '../../utils/formatters';

// ── Product FOMO helpers ──────────────────────────────────────────────────────
function getStockUrgency(quantity: number): { label: string; color: string; bg: string } | null {
    if (quantity <= 0) return null;
    if (quantity === 1) return { label: '¡Última unidad!', color: 'text-red-700', bg: 'bg-red-600' };
    if (quantity <= 3) return { label: `¡Solo ${quantity} quedan!`, color: 'text-red-700', bg: 'bg-red-500' };
    if (quantity <= 7) return { label: `${quantity} disponibles`, color: 'text-orange-700', bg: 'bg-orange-500' };
    return null;
}

function getDiscountBadge(original: number, discounted: number): string {
    const pct = Math.round((1 - discounted / original) * 100);
    if (pct >= 60) return `🔥 -${pct}%`;
    if (pct >= 40) return `-${pct}%`;
    return `-${pct}%`;
}

export const VenueDetail: React.FC = () => {
    const { venueId } = useParams<{ venueId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { success, error } = useToast();
    const { isFavorite, toggleFavorite } = useFavorites();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    // Tick cada 60s para re-evaluar expiración de productos en tiempo real
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (venueId) {
            loadVenueData(venueId);
        }
    }, [venueId]);

    const loadVenueData = async (id: string) => {
        setLoading(true);
        try {
            // Load Venue first
            const venueData = await venueService.getVenueById(id);
            setVenue(venueData);

            if (venueData) {
                // Load products and rating stats in parallel
                const [productsResult, statsResult] = await Promise.allSettled([
                    venueService.getVenueProducts(id),
                    getRatingStats(id, 'venue'),
                ]);

                if (productsResult.status === 'fulfilled') {
                    setProducts(productsResult.value);
                } else {
                    logger.error('Failed to load products (possibly missing index):', productsResult.reason);
                }

                if (statsResult.status === 'fulfilled' && statsResult.value) {
                    setRatingStats(statsResult.value);
                }
            }
        } catch (err) {
            logger.error('Failed to load venue', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = (product: Product) => {
        if (!venue) return;
        if (!isProductAvailable(product)) {
            error(`"${product.name}" ya no está disponible.`);
            return;
        }
        // If dynamic pricing is active, cart uses the dynamic price
        const cartProduct = product.isDynamicPricing && product.dynamicDiscountedPrice
            ? { ...product, discountedPrice: product.dynamicDiscountedPrice }
            : product;
        const added = addToCart(cartProduct, venue.name);
        if (added) {
            success(`✅ ${product.name} agregado al carrito`);
        } else {
            error(`No se pudo agregar "${product.name}". Verifica el stock disponible.`);
        }
    };

    // Productos activos: con stock > 0 y sin expirar (re-evaluado en cada render
    // para cubrir el caso donde un producto expira mientras la página está abierta)
    const availableProducts = useMemo(() => {
        return products.filter(p => isProductAvailable(p));
    }, [products]);

    // Categorías únicas de los productos activos
    const productCategories = useMemo(() => {
        const cats = availableProducts
            .map(p => p.category)
            .filter((c): c is string => !!c);
        return Array.from(new Set(cats));
    }, [availableProducts]);

    // Productos filtrados por búsqueda + categoría (sobre la base de disponibles)
    const filteredProducts = useMemo(() => {
        return availableProducts.filter(p => {
            const matchesSearch = !productSearch ||
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.category?.toLowerCase() ?? '').includes(productSearch.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [availableProducts, productSearch, selectedCategory]);

    if (loading) {
        return <VenueDetailSkeletonLoader />;
    }

    if (!venue) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Negocio no encontrado</h2>
                    <Button
                        onClick={() => navigate('/app')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        Volver al inicio
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            {/* Header */}
            <div className="relative border-b border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto w-full relative">
                    {/* Cover Image */}
                    <div
                        className="h-64 md:h-56 xl:h-[320px] bg-gradient-to-r from-emerald-400 to-emerald-600 w-full"
                        style={{
                            backgroundImage: venue.coverImageUrl ? `url(${venue.coverImageUrl})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        <button
                            onClick={() => navigate(-1)}
                            className="absolute top-4 left-4 p-2.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg active:scale-90 transition-all border border-gray-100"
                        >
                            <ArrowLeft size={22} className="text-emerald-700" />
                        </button>
                        {venueId && (
                            <button
                                onClick={() => toggleFavorite(venueId)}
                                aria-label={isFavorite(venueId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                className="absolute top-4 right-4 p-2.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg active:scale-90 transition-all border border-gray-100"
                            >
                                <Heart
                                    size={22}
                                    className={isFavorite(venueId) ? 'text-red-500 fill-red-500' : 'text-gray-500'}
                                />
                            </button>
                        )}
                    </div>

                </div>

                {/* Venue Info - Compact Layout */}
                <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-10 pb-6 w-full">
                    <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            {venue.logoUrl && (
                                <img
                                    src={venue.logoUrl}
                                    alt={venue.name}
                                    className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-black text-gray-900 truncate tracking-tight leading-none mb-1.5">{venue.name}</h1>

                                <div className="flex items-center gap-3 text-[13px] text-gray-600 font-medium">
                                    <div className="flex items-center gap-1">
                                        <Clock size={14} className="text-emerald-600" />
                                        <span>Cierra {venue.closingTime}</span>
                                    </div>
                                    {ratingStats && ratingStats.totalRatings > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                            <span className="font-bold text-gray-900">{ratingStats.averageRating.toFixed(1)}</span>
                                            <span className="text-gray-400">({ratingStats.totalRatings})</span>
                                        </div>
                                    ) : venue.rating > 0 && (
                                        <div className="flex items-center gap-1">
                                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                            <span className="font-bold text-gray-900">{venue.rating.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 text-[12px] text-gray-500 truncate flex-1">
                                <MapPin size={14} className="shrink-0" />
                                <span className="truncate">{venue.address}</span>
                            </div>
                            <Button onClick={() => navigate('/app/cart')} className="flex items-center justify-center gap-2 h-9 px-4 text-sm shrink-0 shadow-md">
                                <ShoppingCart size={16} />
                                Carrito
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products */}
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Productos Disponibles</h2>
                    <span className="text-sm text-gray-500 font-medium">
                        {filteredProducts.length} de {products.length}
                    </span>
                </div>

                {/* Búsqueda */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    {productSearch && (
                        <button
                            onClick={() => setProductSearch('')}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Filtros por categoría */}
                {
                    productCategories.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 min-w-0">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${selectedCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}`}
                            >
                                Todos
                            </button>
                            {productCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )
                }

                {
                    availableProducts.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center">
                            <p className="text-gray-500">No hay productos disponibles en este momento</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="bg-white rounded-xl p-10 text-center">
                            <Search size={36} className="mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500 font-medium">Sin resultados para "{productSearch}"</p>
                            <button
                                onClick={() => { setProductSearch(''); setSelectedCategory('all'); }}
                                className="mt-2 text-emerald-600 text-sm font-bold hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                            {filteredProducts.map(product => {
                                // Dynamic pricing: prefer dynamicDiscountedPrice when active
                                const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice)
                                    ? product.dynamicDiscountedPrice
                                    : product.discountedPrice;
                                const stockUrgency = getStockUrgency(product.quantity);
                                const discountBadge = getDiscountBadge(product.originalPrice, activePrice);
                                const discountPct = Math.round((1 - activePrice / product.originalPrice) * 100);
                                const isSoldOut = (product.quantity || 0) <= 0;
                                const isExpired = isProductExpired(product.availableUntil);
                                const isUnavailable = isSoldOut || isExpired;
                                const isMegaDeal = discountPct >= 50;
                                const isDynamic = product.isDynamicPricing && !!product.dynamicDiscountedPrice;

                                return (
                                    <div
                                        key={product.id}
                                        className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border cursor-pointer group ${isUnavailable ? 'opacity-60 border-gray-100' : isMegaDeal ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-emerald-200'}`}
                                        onClick={() => navigate(`/app/product/${product.id}`)}
                                    >
                                        <div className="relative">
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className={`w-full h-48 object-cover transition-all duration-300 ${isUnavailable ? 'grayscale opacity-70 filter' : 'group-hover:scale-105'}`}
                                                loading="lazy"
                                            />

                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                                            {/* Countdown — all products with availableUntil */}
                                            {product.availableUntil && !isUnavailable && (
                                                <div className="absolute top-2 left-2">
                                                    <Countdown targetTime={product.availableUntil} />
                                                </div>
                                            )}

                                            {/* Discount badge — top right */}
                                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-white text-xs font-black shadow-md ${isMegaDeal ? 'bg-red-500' : isUnavailable ? 'bg-gray-500' : 'bg-emerald-600'}`}>
                                                {discountBadge}
                                            </div>

                                            {/* Stock urgency badge — bottom left */}
                                            {stockUrgency && !isUnavailable && (
                                                <div className={`absolute bottom-2 left-2 flex items-center gap-1 ${stockUrgency.bg} text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md`}>
                                                    <Flame size={10} />
                                                    {stockUrgency.label}
                                                </div>
                                            )}

                                            {/* Sold out elegant overlay */}
                                            {isUnavailable && (
                                                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center">
                                                    <span className="bg-gray-900/80 text-white font-bold text-xs tracking-wider uppercase px-4 py-1.5 rounded-lg shadow-lg border border-white/20">
                                                        Agotado
                                                    </span>
                                                </div>
                                            )}

                                            {/* Dietary Tags Overlay */}
                                            {product.dietaryTags && product.dietaryTags.length > 0 && (
                                                <div className="absolute bottom-2 right-2 flex gap-1">
                                                    {product.dietaryTags.slice(0, 2).map(tag => (
                                                        <div key={tag} className="bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border border-emerald-100">
                                                            {tag === 'VEGAN' ? '🌿' : tag === 'VEGETARIAN' ? '🥗' : tag === 'GLUTEN_FREE' ? '🌾' : '🥩'}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            <h3 className="font-bold text-gray-800 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-2">{product.name}</h3>
                                            {product.category && (
                                                <p className="text-xs text-emerald-600 font-medium mb-2">{product.category}</p>
                                            )}

                                            {/* Dynamic pricing tier badge */}
                                            {isDynamic && product.dynamicTier && (
                                                <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold px-2 py-1 rounded-lg mb-2 animate-pulse">
                                                    {product.dynamicTier}
                                                </div>
                                            )}

                                            <div className="flex items-end justify-between mb-3">
                                                <div>
                                                    <p className={`text-2xl font-black ${isDynamic ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {formatCOP(activePrice)}
                                                    </p>
                                                    <p className="text-xs text-gray-400 line-through">
                                                        {formatCOP(product.originalPrice)}
                                                    </p>
                                                    {isDynamic && (
                                                        <p className="text-[10px] text-gray-400 line-through">
                                                            {formatCOP(product.discountedPrice)} antes
                                                        </p>
                                                    )}
                                                </div>
                                                <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isMegaDeal ? 'bg-red-100 text-red-600' : isDynamic ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    Ahorras {formatCOP(product.originalPrice - activePrice)}
                                                </div>
                                            </div>

                                            {/* Simulated social proof on hot products */}
                                            {isMegaDeal && product.quantity > 0 && (
                                                <div className="flex items-center gap-1 text-[11px] text-orange-600 font-medium mb-2">
                                                    <Users size={11} />
                                                    <span>Varios usuarios lo tienen en el carrito</span>
                                                </div>
                                            )}

                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddToCart(product);
                                                }}
                                                className={`w-full relative z-10 font-bold transition-all ${isUnavailable ? 'bg-gray-100 text-gray-400 border-none opacity-80 cursor-not-allowed' : ''}`}
                                                disabled={isUnavailable}
                                            >
                                                <ShoppingCart size={16} />
                                                {isUnavailable ? 'Agotado' : 'Agregar al Carrito'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
        </div >
    );
};

export default VenueDetail;
