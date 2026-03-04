import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { venueService } from '../../services/venueService';
import { Venue, Product } from '../../types';
import { useCart } from '../../context/CartContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Button } from '../../components/customer/common/Button';
import { ArrowLeft, ShoppingCart, Info, Store, Clock, MapPin, Star, ChevronRight } from 'lucide-react';
import { logger } from '../../utils/logger';

export const ProductDetail: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();

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
        } catch (error) {
            logger.error('Failed to load product details', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (product) {
            const cartProduct = product.isDynamicPricing && product.dynamicDiscountedPrice
                ? { ...product, discountedPrice: product.dynamicDiscountedPrice }
                : product;

            addToCart(cartProduct, venue?.name || '');
            navigate('/app/cart');
        }
    };

    if (loading) return <LoadingSpinner fullPage />;

    if (!product) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Producto no encontrado</h2>
                    <Button onClick={() => navigate('/app')}>Ir al Inicio</Button>
                </div>
            </div>
        );
    }

    const activePrice = (product.isDynamicPricing && product.dynamicDiscountedPrice) ? product.dynamicDiscountedPrice : product.discountedPrice;
    const isDynamic = product.isDynamicPricing && !!product.dynamicDiscountedPrice;

    const discount = product.originalPrice > activePrice
        ? Math.round(((product.originalPrice - activePrice) / product.originalPrice) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
            {/* Header / Nav */}
            <div className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-95"
                >
                    <ArrowLeft size={20} className="text-gray-700" strokeWidth={2.5} />
                </button>
                <h1 className="font-bold text-base text-gray-800 truncate flex-1">{product.name}</h1>
            </div>

            {/* Product Image with Gradient Overlay */}
            <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
                {/* Gradient overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>

                {/* Stock Badge */}
                {product.quantity < 5 && product.quantity > 0 && (
                    <div className="absolute top-4 right-4">
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm animate-pulse inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                            ¡Solo quedan {product.quantity}!
                        </span>
                    </div>
                )}

                {/* Discount Badge */}
                {discount > 0 && (
                    <div className="absolute top-4 left-4">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                            -{discount}% OFF
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 -mt-6 relative z-10 space-y-4">
                {/* Product Info Card */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 mb-1 leading-tight">{product.name}</h2>
                            <p className="text-emerald-600 text-sm font-semibold bg-emerald-50 inline-block px-3 py-1 rounded-full">
                                {product.category}
                            </p>
                        </div>
                        <div className="text-right ml-4">
                            {isDynamic && product.dynamicTier && (
                                <span className="block mb-1 text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full animate-pulse">
                                    {product.dynamicTier}
                                </span>
                            )}
                            <p className={`text-3xl font-bold ${isDynamic ? 'text-orange-600' : 'text-emerald-600'}`}>${activePrice}</p>
                            {product.originalPrice > activePrice && (
                                <p className="text-sm text-gray-400 line-through mt-1">${product.originalPrice}</p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mt-5 pt-5 border-t border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Descripción</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Delicioso plato preparado con ingredientes frescos del día.
                            Ayuda a rescatar esta comida de alta calidad antes de que cierre el local.
                        </p>
                    </div>

                    {/* Pickup Info */}
                    <div className="mt-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <Clock size={18} className="flex-shrink-0" />
                        <span className="font-medium">Recógelo hoy antes de las {venue?.closingTime || '22:00'}</span>
                    </div>
                </div>

                {/* Venue Info Card */}
                {venue && (
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Restaurante</h3>

                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-16 h-16 flex-shrink-0">
                                <img
                                    src={venue.logoUrl || venue.imageUrl}
                                    alt={venue.name}
                                    className="w-full h-full rounded-xl object-cover border-2 border-gray-100 shadow-sm"
                                    loading="lazy"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 text-base mb-1 truncate">{venue.name}</h4>

                                {/* Rating */}
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="flex items-center gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                size={14}
                                                className={i < Math.floor(venue.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700">{venue.rating}</span>
                                    <span className="text-xs text-gray-400">(50+ reseñas)</span>
                                </div>

                                {/* Address */}
                                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                                    <MapPin size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                                    <span className="line-clamp-2">{venue.address}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate(`/app/venue/${venue.id}`)}
                            className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-3.5 px-4 rounded-xl border border-gray-200 transition-all flex items-center justify-center gap-2 group active:scale-95"
                        >
                            <Store size={18} />
                            <span>Ver Menú Completo</span>
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-4 shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.1)] border-t border-gray-100 z-20">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">Total a pagar</p>
                        <p className={`text-2xl font-bold ${isDynamic ? 'text-orange-600' : 'text-gray-900'}`}>${activePrice}</p>
                        {discount > 0 && (
                            <p className="text-xs text-emerald-600 font-semibold">
                                ¡Ahorras ${(product.originalPrice - activePrice).toFixed(2)}!
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleAddToCart}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg shadow-emerald-200 py-4 text-base font-bold active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={product.quantity === 0}
                    >
                        <ShoppingCart size={20} strokeWidth={2.5} />
                        {product.quantity === 0 ? 'Agotado' : 'Agregar al Carrito'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
