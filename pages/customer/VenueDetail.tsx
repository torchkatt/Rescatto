import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venueService } from '../../services/venueService';
import { Venue, Product, RatingStats } from '../../types';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { VenueDetailSkeletonLoader } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { Countdown } from '../../components/customer/common/Countdown';
import { ArrowLeft, MapPin, Clock, Star, ShoppingCart, Flame, Users, Search, X, Heart, ChevronRight } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { getRatingStats } from '../../services/ratingService';
import { logger } from '../../utils/logger';
import { isProductAvailable, isProductExpired } from '../../utils/productAvailability';
import { isVenueOpen } from '../../utils/venueAvailability';
import { formatCOP } from '../../utils/formatters';
import { SEO } from '../../components/common/SEO';
import { useTranslation } from 'react-i18next';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

// ── Product FOMO helpers ──────────────────────────────────────────────────────
function getStockUrgency(quantity: number, t: any): { label: string; color: string; bg: string } | null {
    if (quantity <= 0) return null;
    if (quantity === 1) return { label: t('venue_last_unit'), color: 'text-red-700', bg: 'bg-red-600' };
    if (quantity <= 3) return { label: t('venue_only_left', { count: quantity }), color: 'text-red-700', bg: 'bg-red-500' };
    if (quantity <= 7) return { label: t('venue_available', { count: quantity }), color: 'text-orange-700', bg: 'bg-orange-500' };
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
    const { t } = useTranslation();
    const { isFavorite, toggleFavorite } = useFavorites();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreProducts, setHasMoreProducts] = useState(true);
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (venueId) loadVenueData(venueId);
    }, [venueId]);

    const loadVenueData = async (id: string) => {
        setLoading(true);
        try {
            const venueData = await venueService.getVenueById(id);
            setVenue(venueData);
            if (venueData) {
                const [productsResult, statsResult] = await Promise.allSettled([
                    venueService.getVenueProductsPage(id, null, 20),
                    getRatingStats(id, 'venue'),
                ]);
                if (productsResult.status === 'fulfilled') {
                    setProducts(productsResult.value.products);
                    setProductsLastDoc(productsResult.value.lastDoc);
                    setHasMoreProducts(productsResult.value.hasMore);
                } else {
                    logger.error('Failed to load products:', productsResult.reason);
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

    const loadMoreProducts = async () => {
        if (!venueId || !hasMoreProducts || loadingMoreProducts) return;
        setLoadingMoreProducts(true);
        try {
            const nextPage = await venueService.getVenueProductsPage(venueId, productsLastDoc, 20);
            setProducts(prev => [...prev, ...nextPage.products]);
            setProductsLastDoc(nextPage.lastDoc);
            setHasMoreProducts(nextPage.hasMore);
        } catch (err) {
            logger.error('Failed to load more products:', err);
        } finally {
            setLoadingMoreProducts(false);
        }
    };

    const handleAddToCart = (product: Product) => {
        if (!venue) return;
        if (!isProductAvailable(product)) {
            error(`"${product.name}" ya no está disponible.`);
            return;
        }
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

    const availableProducts = useMemo(() => products.filter(p => isProductAvailable(p)), [products]);

    const productCategories = useMemo(() => {
        const cats = availableProducts.map(p => p.category).filter((c): c is string => !!c);
        return Array.from(new Set(cats));
    }, [availableProducts]);

    const filteredProducts = useMemo(() => {
        return availableProducts.filter(p => {
            const matchesSearch = !productSearch ||
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.category?.toLowerCase() ?? '').includes(productSearch.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [availableProducts, productSearch, selectedCategory]);

    if (loading) return <VenueDetailSkeletonLoader />;

    if (!venue) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('venue_not_found')}</h2>
                    <Button onClick={() => navigate('/app')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {t('venue_back_home')}
                    </Button>
                </div>
            </div>
        );
    }

    const venueOpen = isVenueOpen(venue);
    const displayRating = ratingStats && ratingStats.totalRatings > 0
        ? ratingStats
        : venue.rating > 0 ? { averageRating: venue.rating, totalRatings: 0 } : null;

    return (
        <div className="min-h-screen bg-gray-50">
            <SEO
                title={venue.name}
                description={t('venue_seo_desc', { name: venue.name, address: venue.address })}
                image={venue.coverImageUrl || venue.logoUrl}
                type="restaurant"
                venueName={venue.name}
            />

            {/* ── HERO ── */}
            <div className="relative">
                {/* Cover Image */}
                <div className="h-56 md:h-72 lg:h-80 xl:h-[360px] overflow-hidden relative">
                    {venue.coverImageUrl ? (
                        <img
                            src={venue.coverImageUrl}
                            alt={venue.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600" />
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/25" />

                    {/* Floating Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-safe left-4 mt-4 z-50 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg text-gray-800 hover:bg-white active:scale-95 transition-all"
                    >
                        <ArrowLeft size={20} className="text-gray-800" />
                    </button>

                    {/* Favorite button */}
                    {venueId && (
                        <button
                            onClick={() => toggleFavorite(venueId)}
                            aria-label={isFavorite(venueId) ? t('venue_remove_fav') : t('venue_add_fav')}
                            className="absolute top-safe right-4 mt-4 p-2.5 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 border border-white/20 shadow-lg active:scale-90 transition-all"
                        >
                            <Heart
                                size={20}
                                className={isFavorite(venueId) ? 'text-red-400 fill-red-400' : 'text-white'}
                            />
                        </button>
                    )}

                    {/* Desktop: venue name overlay en la imagen */}
                    <div className="absolute bottom-0 left-0 right-0 hidden lg:block px-8 pb-8">
                        <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
                            <div>
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 ${venueOpen ? 'bg-emerald-500/90 text-white' : 'bg-gray-700/80 text-gray-200'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${venueOpen ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
                                    {venueOpen ? 'Abierto' : 'Cerrado'}
                                </span>
                                <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-tight">
                                    {venue.name}
                                </h1>
                                <div className="flex items-center gap-4 mt-2">
                                    {displayRating && (
                                        <div className="flex items-center gap-1.5">
                                            <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                            <span className="text-white font-black">{displayRating.averageRating.toFixed(1)}</span>
                                            {displayRating.totalRatings > 0 && (
                                                <span className="text-white/60 text-sm">({displayRating.totalRatings})</span>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-white/80 text-sm">
                                        <Clock size={14} />
                                        <span>{t('venue_closes_at', { time: venue.closingTime })}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-white/70 text-sm">
                                        <MapPin size={14} />
                                        <span>{venue.address}</span>
                                    </div>
                                </div>
                            </div>
                            {venue.logoUrl && (
                                <img
                                    src={venue.logoUrl}
                                    alt={venue.name}
                                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 shadow-2xl flex-shrink-0"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile: venue info card flotando sobre la imagen */}
                <div className="lg:hidden max-w-7xl mx-auto px-4 -mt-12 relative z-10 pb-2">
                    <div className="bg-white rounded-2xl px-4 py-4 shadow-xl border border-gray-100/80">
                        <div className="flex items-center gap-3">
                            {/* Logo */}
                            {venue.logoUrl ? (
                                <img
                                    src={venue.logoUrl}
                                    alt={venue.name}
                                    className="w-14 h-14 rounded-xl object-cover border border-gray-100 shadow-sm flex-shrink-0"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                                    {venue.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h1 className="text-base font-black text-gray-900 leading-tight">{venue.name}</h1>
                                    <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${venueOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${venueOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                        {venueOpen ? 'Abierto' : 'Cerrado'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <Clock size={11} className="text-emerald-600" />
                                        {t('venue_closes_at', { time: venue.closingTime })}
                                    </span>
                                    {displayRating && (
                                        <span className="flex items-center gap-1">
                                            <Star size={11} className="text-yellow-500 fill-yellow-500" />
                                            <span className="font-bold text-gray-700">{displayRating.averageRating.toFixed(1)}</span>
                                            {displayRating.totalRatings > 0 && (
                                                <span className="text-gray-400">({displayRating.totalRatings})</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400">
                                    <MapPin size={10} className="flex-shrink-0" />
                                    <span className="truncate">{venue.address}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop: info bar debajo de la imagen */}
                <div className="hidden lg:block bg-white border-b border-gray-100 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6 py-5">
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>{availableProducts.length} {t('venue_products_avail')}</span>
                            {availableProducts.length > 0 && (
                                <>
                                    <span className="text-gray-200">·</span>
                                    <span className="text-emerald-600 font-bold">
                                        {t('venue_savings', { amount: formatCOP(
                                            Math.max(0, ...availableProducts.map(p => p.originalPrice - ((p.isDynamicPricing && p.dynamicDiscountedPrice) ? p.dynamicDiscountedPrice : p.discountedPrice)))
                                        ) })} {t('venue_max_savings') || 'máx. descuento'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PRODUCTS SECTION ── */}
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 pb-10">

                {/* Section header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                        {t('venue_products_avail')}
                    </h2>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                        {filteredProducts.length} {t('prod_of')} {availableProducts.length}
                    </span>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={17} />
                    <input
                        type="text"
                        placeholder={t('venue_search_ph')}
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent shadow-sm transition-all"
                    />
                    {productSearch && (
                        <button
                            onClick={() => setProductSearch('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Category pills */}
                {productCategories.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${selectedCategory === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700'}`}
                        >
                            {t('cat_all')}
                        </button>
                        {productCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${selectedCategory === cat ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Empty states */}
                {availableProducts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-14 text-center border border-gray-100 shadow-sm">
                        <div className="text-5xl mb-4">🍽️</div>
                        <p className="font-bold text-gray-700 mb-1">{t('venue_no_products')}</p>
                        <p className="text-sm text-gray-400">{t('venue_check_back') || 'Vuelve más tarde para ver los productos disponibles'}</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
                        <Search size={36} className="mx-auto mb-3 text-gray-200" />
                        <p className="font-bold text-gray-600 mb-1">{t('venue_no_results', { query: productSearch })}</p>
                        <button
                            onClick={() => { setProductSearch(''); setSelectedCategory('all'); }}
                            className="mt-2 text-emerald-600 text-sm font-bold hover:underline"
                        >
                            {t('venue_clear_filters')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Mobile: tarjetas horizontales */}
                        <div className="flex flex-col gap-3 lg:hidden">
                            {filteredProducts.map(product => {
                                const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice)
                                    ? product.dynamicDiscountedPrice
                                    : product.discountedPrice;
                                const stockUrgency = getStockUrgency(product.quantity, t);
                                const discountPct = Math.round((1 - activePrice / product.originalPrice) * 100);
                                const isSoldOut = (product.quantity || 0) <= 0;
                                const isExpired = isProductExpired(product.availableUntil);
                                const isUnavailable = isSoldOut || isExpired;
                                const isMegaDeal = discountPct >= 50;
                                const isDynamic = product.isDynamicPricing && !!product.dynamicDiscountedPrice;

                                return (
                                    <div
                                        key={product.id}
                                        className={`bg-white rounded-2xl overflow-hidden border transition-all active:scale-[0.99] ${isUnavailable ? 'opacity-60 border-gray-100' : 'border-gray-100 shadow-sm active:shadow-md'}`}
                                        onClick={() => navigate(`/app/product/${product.id}`)}
                                    >
                                        <div className="flex gap-0">
                                            {/* Imagen cuadrada izquierda */}
                                            <div className="relative w-28 h-28 flex-shrink-0">
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    className={`w-full h-full object-cover ${isUnavailable ? 'grayscale opacity-60' : ''}`}
                                                    loading="lazy"
                                                />
                                                {/* Discount badge */}
                                                <div className={`absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-lg text-white ${isMegaDeal ? 'bg-red-500' : isDynamic ? 'bg-orange-500' : 'bg-emerald-600'}`}>
                                                    {getDiscountBadge(product.originalPrice, activePrice)}
                                                </div>
                                                {/* Countdown */}
                                                {product.availableUntil && !isUnavailable && (
                                                    <div className="absolute bottom-1 left-1 right-1">
                                                        <Countdown targetTime={product.availableUntil} compact />
                                                    </div>
                                                )}
                                                {isUnavailable && (
                                                    <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] flex items-center justify-center">
                                                        <span className="bg-gray-900/75 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
                                                            {t('venue_sold_out')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info derecha */}
                                            <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-black text-gray-900 text-sm leading-tight line-clamp-2 mb-0.5">{product.name}</p>
                                                    {product.category && (
                                                        <p className="text-[11px] text-emerald-600 font-bold">{product.category}</p>
                                                    )}
                                                    {isDynamic && product.dynamicTier && (
                                                        <span className="inline-flex items-center text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md mt-1">
                                                            {product.dynamicTier}
                                                        </span>
                                                    )}
                                                    {stockUrgency && !isUnavailable && (
                                                        <div className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold ${stockUrgency.color}`}>
                                                            <Flame size={9} />
                                                            {stockUrgency.label}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <div>
                                                        <p className={`text-base font-black leading-none ${isDynamic ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                            {formatCOP(activePrice)}
                                                        </p>
                                                        <p className="text-[11px] text-gray-400 line-through">{formatCOP(product.originalPrice)}</p>
                                                    </div>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleAddToCart(product); }}
                                                        disabled={isUnavailable}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${isUnavailable ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700'}`}
                                                    >
                                                        <ShoppingCart size={13} />
                                                        {isUnavailable ? t('venue_sold_out') : t('venue_add_to_cart')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop: grid */}
                        <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {filteredProducts.map(product => {
                                const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice)
                                    ? product.dynamicDiscountedPrice
                                    : product.discountedPrice;
                                const stockUrgency = getStockUrgency(product.quantity, t);
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
                                        className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group border ${isUnavailable ? 'opacity-60 border-gray-100' : isMegaDeal ? 'border-red-100 hover:border-red-200' : 'border-gray-100 hover:border-emerald-200'}`}
                                        onClick={() => navigate(`/app/product/${product.id}`)}
                                    >
                                        <div className="relative overflow-hidden">
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className={`w-full h-48 object-cover transition-transform duration-500 ${isUnavailable ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                                            {product.availableUntil && !isUnavailable && (
                                                <div className="absolute top-2 left-2">
                                                    <Countdown targetTime={product.availableUntil} />
                                                </div>
                                            )}
                                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-xl text-white text-[11px] font-black shadow-md ${isMegaDeal ? 'bg-red-500' : isUnavailable ? 'bg-gray-500' : 'bg-emerald-600'}`}>
                                                {discountBadge}
                                            </div>
                                            {stockUrgency && !isUnavailable && (
                                                <div className={`absolute bottom-2 left-2 flex items-center gap-1 ${stockUrgency.bg} text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md`}>
                                                    <Flame size={10} />
                                                    {stockUrgency.label}
                                                </div>
                                            )}
                                            {isUnavailable && (
                                                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center">
                                                    <span className="bg-gray-900/80 text-white font-black text-xs tracking-wider uppercase px-4 py-1.5 rounded-xl shadow-lg border border-white/20">
                                                        {t('venue_sold_out')}
                                                    </span>
                                                </div>
                                            )}
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
                                            <h3 className="font-black text-gray-800 mb-1 group-hover:text-emerald-600 transition-colors line-clamp-2 text-sm leading-snug">{product.name}</h3>
                                            {product.category && (
                                                <p className="text-[11px] text-emerald-600 font-bold mb-2">{product.category}</p>
                                            )}
                                            {isDynamic && product.dynamicTier && (
                                                <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold px-2 py-1 rounded-lg mb-2 animate-pulse">
                                                    {product.dynamicTier}
                                                </div>
                                            )}
                                            <div className="flex items-end justify-between mb-3">
                                                <div>
                                                    <p className={`text-xl font-black ${isDynamic ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {formatCOP(activePrice)}
                                                    </p>
                                                    <p className="text-xs text-gray-400 line-through">{formatCOP(product.originalPrice)}</p>
                                                </div>
                                                <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isMegaDeal ? 'bg-red-50 text-red-600' : isDynamic ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                    {t('venue_savings', { amount: formatCOP(product.originalPrice - activePrice) })}
                                                </div>
                                            </div>
                                            {isMegaDeal && product.quantity > 0 && (
                                                <div className="flex items-center gap-1 text-[11px] text-orange-600 font-medium mb-2">
                                                    <Users size={11} />
                                                    <span>{t('venue_social_proof')}</span>
                                                </div>
                                            )}
                                            <Button
                                                onClick={e => { e.stopPropagation(); handleAddToCart(product); }}
                                                className={`w-full font-black text-sm ${isUnavailable ? 'bg-gray-100 text-gray-400 border-none opacity-80 cursor-not-allowed' : ''}`}
                                                disabled={isUnavailable}
                                            >
                                                <ShoppingCart size={15} />
                                                {isUnavailable ? t('venue_sold_out') : t('venue_add_to_cart')}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Load more */}
                        {hasMoreProducts && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={loadMoreProducts}
                                    disabled={loadingMoreProducts}
                                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                                >
                                    {loadingMoreProducts ? t('loading') : (
                                        <>
                                            {t('load_more_products')}
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default VenueDetail;
