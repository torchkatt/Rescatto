import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venueService } from '../../services/venueService';
import { Venue, Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { ArrowLeft, ShoppingCart, Store, Clock, MapPin, Star, ChevronRight, Zap } from 'lucide-react';
import { logger } from '../../utils/logger';
import { isProductAvailable, isProductExpired } from '../../utils/productAvailability';
import { formatCOP } from '../../utils/formatters';
import { sanitizeHtml } from '../../utils/sanitize';
import { SEO } from '../../components/common/SEO';
import { useTranslation } from 'react-i18next';

export const ProductDetail: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { error, success } = useToast();
    const { t } = useTranslation();

    const [product, setProduct] = useState<Product | null>(null);
    const [venue, setVenue] = useState<Venue | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (productId) {
            loadData(productId);
        }
    }, [productId]);

    const loadData = async (id: string) => {
        setLoading(true);
        try {
            const productData = await venueService.getProductById(id);
            setProduct(productData);

            if (productData && productData.venueId) {
                const venueData = await venueService.getVenueById(productData.venueId);
                setVenue(venueData);
            }
        } catch (err) {
            logger.error('Failed to load product details', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (product) {
            if (!isProductAvailable(product)) {
                error(`"${product.name}" ya no está disponible.`);
                return;
            }
            const cartProduct = product.isDynamicPricing && product.dynamicDiscountedPrice
                ? { ...product, discountedPrice: product.dynamicDiscountedPrice }
                : product;

            const added = addToCart(cartProduct, venue?.name || '');
            if (added) {
                success(`✅ ${product.name} ${t('nav_cart')}`);
                navigate('/app/cart');
            } else {
                error(t('cart_stock_limit_reached'));
            }
        }
    };

    if (loading) return <LoadingSpinner fullPage />;

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{t('prod_not_found')}</h2>
                    <Button onClick={() => navigate('/app')}>{t('prod_go_home')}</Button>
                </div>
            </div>
        );
    }

    const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice) ? product.dynamicDiscountedPrice : product.discountedPrice;
    const isDynamic = product.isDynamicPricing && !!product.dynamicDiscountedPrice;
    const isUnavailable = !isProductAvailable(product);

    const discount = product.originalPrice > activePrice
        ? Math.round(((product.originalPrice - activePrice) / product.originalPrice) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-brand-bg pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-36">
            <SEO 
                title={product.name}
                description={t('prod_seo_desc', { price: formatCOP(activePrice), name: product.name, venue: venue?.name || 'Rescatto', discount: discount })}
                image={product.imageUrl}
                type="product"
                venueName={venue?.name}
            />
            
            {/* Header / Nav - Expanded for Desktop */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-gray-100/50 pt-safe-top transition-all">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 rounded-2xl transition-all active:scale-95 group"
                    >
                        <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-black text-lg text-brand-dark truncate">{product.name}</h1>
                        {venue && (
                            <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider flex items-center gap-1.5">
                                <Store size={10} />
                                {venue.name}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-[1600px] mx-auto px-6 lg:px-10 mt-6 lg:mt-10">
                <div className="lg:grid lg:grid-cols-12 xl:gap-16 2xl:gap-24 lg:gap-8 items-start">
                    
                    {/* LEFT COLUMN: Visuals */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                        <div className="relative rounded-[2.5rem] overflow-hidden bg-gray-100 shadow-2xl shadow-emerald-900/5 aspect-video lg:aspect-auto lg:h-[600px]">
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                                loading="lazy"
                            />
                            
                            {/* Tags atop image - Unified & Refined */}
                            <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center gap-2">
                                {discount > 0 && (
                                    <div className="bg-emerald-500/95 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg">
                                        -{discount}% OFF
                                    </div>
                                )}
                                <div className="bg-white/95 backdrop-blur-sm text-brand-dark text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-white/10 uppercase tracking-widest flex items-center gap-1">
                                    {product.category}
                                    {product.subcategory && (
                                        <>
                                            <ChevronRight size={10} className="text-gray-400" />
                                            <span className="text-emerald-600">{product.subcategory}</span>
                                        </>
                                    )}
                                </div>
                                {product.isRescue !== false ? (
                                    <div className="bg-emerald-600/95 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-emerald-400/30 uppercase tracking-widest flex items-center gap-1.5">
                                        <span role="img" aria-label="rescue">🍃</span> Rescate
                                    </div>
                                ) : (
                                    <div className="bg-blue-600/95 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg border border-blue-400/30 uppercase tracking-widest flex items-center gap-1.5">
                                        <span role="img" aria-label="regular">💎</span> Regular
                                    </div>
                                )}
                                {product.quantity < 5 && product.quantity > 0 && !isProductExpired(product.availableUntil) && (
                                    <div className="bg-red-500/95 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-500 ml-auto sm:ml-0">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                        {t('prod_only_left', { count: product.quantity }).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            {/* Gradient overlay for bottom info if needed */}
                            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent lg:hidden" />
                        </div>

                        {/* Description (Desktop: Below image) */}
                        <div className="hidden lg:block bg-white rounded-[2rem] p-8 border border-gray-100">
                            <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">{t('prod_description')}</h3>
                            <div 
                                className="text-gray-600 text-lg leading-relaxed font-medium"
                                dangerouslySetInnerHTML={{ 
                                    __html: sanitizeHtml(product.description || 'Ayuda a rescatar esta comida de alta calidad antes de que cierre el local.') 
                                }}
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Info & Actions */}
                    <div className="lg:col-span-5 xl:col-span-4 mt-8 lg:mt-0 space-y-6 sticky top-28">
                        {/* Price & Title Card */}
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/5 border border-gray-100 flex flex-col gap-6">
                            <div>
                                {isDynamic && product.dynamicTier && (
                                    <span className="inline-flex items-center gap-1.5 mb-3 text-[10px] font-black text-orange-700 bg-orange-100 px-3 py-1 rounded-full uppercase tracking-widest">
                                        <Zap size={10} fill="currentColor" />
                                        {product.dynamicTier}
                                    </span>
                                )}
                                <h2 className="text-3xl font-black text-brand-dark mb-2 leading-[1.1]">{product.name}</h2>
                                <div className="flex items-baseline gap-3">
                                    <span className={`text-4xl font-black ${isDynamic ? 'text-orange-600' : 'text-emerald-600'}`}>
                                        {formatCOP(activePrice)}
                                    </span>
                                    {product.originalPrice > activePrice && (
                                        <span className="text-lg font-bold text-gray-300 line-through">
                                            {formatCOP(product.originalPrice)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Description for Mobile */}
                            <div className="lg:hidden border-t border-gray-100 pt-6">
                                <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest">{t('prod_description')}</h3>
                                <div 
                                    className="text-gray-600 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ 
                                        __html: sanitizeHtml(product.description || 'Ayuda a rescatar esta comida de alta calidad antes de que cierre el local.') 
                                    }}
                                />
                            </div>

                            {/* Pickup Summary Widget */}
                            <div className="bg-gray-50/50 rounded-2xl p-4 flex items-center gap-4 border border-gray-100">
                                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                                    <Clock size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{t('pickup_time') || 'RECOGIDA'}</p>
                                    <p className="text-sm font-black text-brand-dark">
                                        {t('prod_pickup_today', { time: venue?.closingTime || '22:00' })}
                                    </p>
                                </div>
                                {product.isRescue !== false && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Eco Impacto</p>
                                        <p className="text-xs font-black text-emerald-700">-0.5kg CO2</p>
                                    </div>
                                )}
                            </div>

                            {/* Personalization Hint */}
                            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600">
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Personalizable</p>
                                    <p className="text-[10px] text-blue-600 font-medium">Podrás añadir notas especiales en el checkout.</p>
                                </div>
                            </div>
                        </div>

                        {/* Venue Interactive Card */}
                        {venue && (
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/5 border border-gray-100">
                                <h3 className="text-xs font-black text-gray-400 mb-6 uppercase tracking-[0.2em]">{t('prod_restaurant')}</h3>

                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 group cursor-pointer relative" onClick={() => navigate(`/app/venue/${venue.id}`)}>
                                        <img
                                            src={venue.logoUrl || venue.imageUrl}
                                            alt={venue.name}
                                            className="w-full h-full rounded-[1.5rem] object-cover border-4 border-gray-50 shadow-md transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 rounded-[1.5rem] bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors flex items-center justify-center">
                                            <Store size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-brand-dark text-xl mb-1.5 truncate leading-tight">{venue.name}</h4>

                                        {/* Rating Polish */}
                                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-3">
                                            <div className="flex items-center gap-0.5 text-yellow-500 shrink-0">
                                                <Star size={14} fill="currentColor" />
                                            </div>
                                            <span className="text-sm font-black text-brand-dark shrink-0">{venue.rating?.toFixed(1) || '0.0'}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0" />
                                            <span className="text-xs font-bold text-gray-400 truncate">{venue.rating > 0 ? t('prod_rating_summary', { count: 124 }) : t('prod_no_reviews')}</span>
                                        </div>

                                        <div className="flex items-start gap-2 text-xs font-bold text-gray-400 leading-relaxed">
                                            <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <span className="line-clamp-2">{venue.address}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => navigate(`/app/venue/${venue.id}`)}
                                    className="w-full bg-brand-bg hover:bg-emerald-50 text-brand-dark hover:text-emerald-700 font-extrabold py-4 px-6 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-all flex items-center justify-between group active:scale-[0.98]"
                                >
                                    <span className="flex items-center gap-3">
                                        <Store size={20} className="text-emerald-600" />
                                        {t('prod_view_menu')}
                                    </span>
                                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform text-emerald-400" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Action Bar - Mobile-aware & Desktop-optimized */}
            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width,16rem)] bg-white/95 backdrop-blur-2xl border-t border-gray-100/50 z-40 rounded-t-[2.5rem] lg:rounded-t-[4rem] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.15)] transition-all pb-[env(safe-area-inset-bottom)]">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-6 pb-6 lg:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] flex items-center justify-between gap-6 sm:gap-8">
                    <div className="hidden sm:block flex-shrink-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('prod_total_to_pay')}</p>
                        <div className="flex items-center gap-3">
                            <p className={`text-3xl sm:text-4xl font-black ${isDynamic ? 'text-orange-600' : 'text-brand-dark'}`}>{formatCOP(activePrice)}</p>
                            {discount > 0 && (
                                <span className="bg-emerald-100/80 text-emerald-700 text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tight">
                                    {t('prod_saving_badge', { amount: formatCOP(product.originalPrice - activePrice) })}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <button
                        onClick={handleAddToCart}
                        disabled={isUnavailable}
                        className="w-full sm:flex-1 max-w-[320px] lg:max-w-md h-16 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-2xl shadow-emerald-600/20 rounded-2xl flex items-center justify-center gap-3 text-lg font-black tracking-tight transform active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group mx-auto sm:mx-0"
                    >
                        <ShoppingCart size={22} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
                        <span className="truncate">{isUnavailable ? t('prod_unavailable').toUpperCase() : t('prod_add_to_cart').toUpperCase()}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
