import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venueService } from '../../services/venueService';
import { Venue, Product, RatingStats } from '../../types';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { VenueDetailSkeletonLoader } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { Countdown } from '../../components/customer/common/Countdown';
import { ArrowLeft, MapPin, Clock, Star, ShoppingCart, Flame, Users } from 'lucide-react';
import { getRatingStats } from '../../services/ratingService';
import { logger } from '../../utils/logger';

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
    const { success } = useToast();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
    const [loading, setLoading] = useState(true);

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
        } catch (error) {
            logger.error('Failed to load venue', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = (product: Product) => {
        if (!venue) return;
        // If dynamic pricing is active, cart uses the dynamic price
        const cartProduct = product.isDynamicPricing && product.dynamicDiscountedPrice
            ? { ...product, discountedPrice: product.dynamicDiscountedPrice }
            : product;
        addToCart(cartProduct, venue.name);
        success(`✅ ${product.name} agregado al carrito`);
    };

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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="relative">
                {/* Cover Image */}
                <div
                    className="h-64 bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{
                        backgroundImage: venue.coverImageUrl ? `url(${venue.coverImageUrl})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                >
                    <button
                        onClick={() => navigate('/app')}
                        className="absolute top-4 left-4 p-2.5 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg active:scale-90 transition-all border border-gray-100"
                    >
                        <ArrowLeft size={22} className="text-emerald-700" />
                    </button>
                </div>

                {/* Venue Info */}
                <div className="max-w-6xl mx-auto px-6 -mt-16 relative">
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-start gap-6">
                            {venue.logoUrl && (
                                <img
                                    src={venue.logoUrl}
                                    alt={venue.name}
                                    className="w-24 h-24 rounded-xl object-cover border-4 border-white shadow-md"
                                />
                            )}

                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">{venue.name}</h1>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                    <div className="flex items-center gap-1">
                                        <MapPin size={16} />
                                        {venue.address}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={16} />
                                        Cierra a las {venue.closingTime}
                                    </div>
                                    {ratingStats && ratingStats.totalRatings > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                                            <span>{ratingStats.averageRating.toFixed(1)}</span>
                                            <span className="text-gray-400">({ratingStats.totalRatings} reseñas)</span>
                                        </div>
                                    ) : venue.rating > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                                            <span>{venue.rating}</span>
                                        </div>
                                    ) : null}
                                </div>

                                {venue.categories && venue.categories.length > 0 && (
                                    <div className="flex gap-2">
                                        {venue.categories.map(cat => (
                                            <span
                                                key={cat}
                                                className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button onClick={() => navigate('/app/cart')}>
                                <ShoppingCart size={18} />
                                Ver Carrito
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Productos Disponibles</h2>

                {products.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <p className="text-gray-500">No hay productos disponibles en este momento</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map(product => {
                            // Dynamic pricing: prefer dynamicDiscountedPrice when active
                            const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice)
                                ? product.dynamicDiscountedPrice
                                : product.discountedPrice;
                            const stockUrgency = getStockUrgency(product.quantity);
                            const discountBadge = getDiscountBadge(product.originalPrice, activePrice);
                            const discountPct = Math.round((1 - activePrice / product.originalPrice) * 100);
                            const isSoldOut = (product.quantity || 0) <= 0;
                            const isMegaDeal = discountPct >= 50;
                            const isDynamic = product.isDynamicPricing && !!product.dynamicDiscountedPrice;

                            return (
                                <div
                                    key={product.id}
                                    className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border cursor-pointer group ${isSoldOut ? 'opacity-60 border-gray-100' : isMegaDeal ? 'border-red-200 hover:border-red-300' : 'border-gray-100 hover:border-emerald-200'}`}
                                    onClick={() => navigate(`/app/product/${product.id}`)}
                                >
                                    <div className="relative">
                                        <img
                                            src={product.imageUrl}
                                            alt={product.name}
                                            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />

                                        {/* Gradient overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                                        {/* Countdown — all products with availableUntil */}
                                        {product.availableUntil && !isSoldOut && (
                                            <div className="absolute top-2 left-2">
                                                <Countdown targetTime={product.availableUntil} />
                                            </div>
                                        )}

                                        {/* Discount badge — top right */}
                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-white text-xs font-black shadow-md ${isMegaDeal ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                            {discountBadge}
                                        </div>

                                        {/* Stock urgency badge — bottom left */}
                                        {stockUrgency && !isSoldOut && (
                                            <div className={`absolute bottom-2 left-2 flex items-center gap-1 ${stockUrgency.bg} text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md`}>
                                                <Flame size={10} />
                                                {stockUrgency.label}
                                            </div>
                                        )}

                                        {/* Sold out overlay */}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <span className="bg-white/90 text-gray-700 font-black text-sm px-3 py-1 rounded-full">
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
                                                    ${activePrice.toLocaleString('es-CO')}
                                                </p>
                                                <p className="text-xs text-gray-400 line-through">
                                                    ${product.originalPrice.toLocaleString('es-CO')}
                                                </p>
                                                {isDynamic && (
                                                    <p className="text-[10px] text-gray-400 line-through">
                                                        ${product.discountedPrice.toLocaleString('es-CO')} antes
                                                    </p>
                                                )}
                                            </div>
                                            <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isMegaDeal ? 'bg-red-100 text-red-600' : isDynamic ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                Ahorras ${(product.originalPrice - activePrice).toLocaleString('es-CO')}
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
                                            className="w-full relative z-10"
                                            disabled={isSoldOut}
                                        >
                                            <ShoppingCart size={16} />
                                            {isSoldOut ? 'Agotado' : 'Agregar al Carrito'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VenueDetail;
