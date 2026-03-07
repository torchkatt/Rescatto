import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/customer/common/Button';
import { Countdown } from '../../components/customer/common/Countdown';
import { useToast } from '../../context/ToastContext';
import { isProductExpired } from '../../utils/productAvailability';
import { formatCOP } from '../../utils/formatters';

export const Cart: React.FC = () => {
    const navigate = useNavigate();
    const { items, removeFromCart, updateQuantity, getTotalPrice, getTotalItems, getCartByVenue } = useCart();
    const { error } = useToast();

    const venueGroups = getCartByVenue();

    // Hooks deben estar SIEMPRE antes de cualquier return condicional (Reglas de Hooks de React)
    const expiredItems = useMemo(
        () => items.filter(item => isProductExpired(item.availableUntil)),
        [items]
    );

    const urgentItems = useMemo(() => {
        const now = Date.now();
        const twoHoursFromNow = now + 2 * 60 * 60 * 1000;
        return items.filter(item => {
            if (!item.availableUntil) return false;
            const expiresAt = new Date(item.availableUntil).getTime();
            return expiresAt > now && expiresAt < twoHoursFromNow;
        });
    }, [items]);

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <div className="px-4 pt-6 pb-2">
                    <button
                        onClick={() => navigate('/app')}
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Seguir explorando
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 text-center">
                    {/* Illustration */}
                    <div className="relative mb-6">
                        <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center">
                            <ShoppingCart size={52} className="text-emerald-400" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-lg">
                            🍱
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-gray-900 mb-2">Tu carrito está vacío</h2>
                    <p className="text-gray-500 text-sm max-w-xs mb-2">
                        Hay comida deliciosa esperándote — y a precios increíbles antes de que expire.
                    </p>
                    <p className="text-emerald-600 text-xs font-semibold mb-8">
                        ⚡ Los deals se acaban rápido
                    </p>

                    <button
                        onClick={() => navigate('/app')}
                        className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-600/30"
                    >
                        Ver ofertas de hoy
                    </button>
                    <button
                        onClick={() => navigate('/app/impact')}
                        className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Ver mi impacto ambiental
                    </button>
                </div>
            </div>
        );
    }

    const handleCheckout = () => {
        if (expiredItems.length > 0) {
            const names = expiredItems.map(item => item.name).slice(0, 2).join(', ');
            error(`Elimina productos expirados antes de pagar: ${names}${expiredItems.length > 2 ? '...' : ''}`);
            return;
        }
        navigate('/app/checkout');
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 overflow-x-hidden">
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Header */}
                <button
                    onClick={() => navigate('/app')}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 hover:text-gray-900 hover:border-emerald-500 hover:bg-emerald-50 mb-6 transition-all duration-200 group shadow-sm font-bold active:scale-95"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Volver</span>
                </button>

                <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                    <ShoppingCart className="text-emerald-600" size={32} />
                    Mi Carrito <span className="text-gray-400 text-2xl">({getTotalItems().toLocaleString('es-CO')} {getTotalItems() === 1 ? 'producto' : 'productos'})</span>
                </h1>

                {/* Urgency banner — shown when any item expires within 2 hours */}
                {urgentItems.length > 0 && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-fadeIn">
                        <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="font-bold text-amber-800 text-sm">¡Atención! {urgentItems.length === 1 ? 'Un producto expira' : `${urgentItems.length} productos expiran`} pronto</p>
                            <p className="text-amber-700 text-xs mt-0.5">Completa tu compra antes de que se agoten.</p>
                        </div>
                    </div>
                )}
                {expiredItems.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fadeIn">
                        <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="font-bold text-red-700 text-sm">
                                {expiredItems.length === 1 ? 'Tienes un producto expirado' : `Tienes ${expiredItems.length} productos expirados`}
                            </p>
                            <p className="text-red-600 text-xs mt-0.5">Elimínalos para continuar al pago.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cart Items */}
                    <div className="lg:col-span-2 space-y-6">
                        {Array.from(venueGroups.entries()).map(([venueId, venueItems]) => (
                            <div key={venueId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
                                    <h3 className="font-bold text-lg text-gray-900">
                                        📍 Negocio: {venueItems[0].venueName || venueItems[0].venueId}
                                    </h3>
                                </div>

                                <div className="p-6 space-y-5">
                                    {venueItems.map(item => (
                                        <div key={item.id} className="flex flex-col gap-3 pb-5 border-b border-gray-100 last:border-0 last:pb-0">
                                            {(() => {
                                                const isExpired = isProductExpired(item.availableUntil);
                                                const stockQuantity = typeof item.stockQuantity === 'number' ? item.stockQuantity : null;
                                                const isAtStockLimit = stockQuantity !== null && item.quantity >= stockQuantity;

                                                return (
                                                    <>
                                            {/* Fila 1: imagen + info */}
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="w-20 h-20 object-cover rounded-xl shadow-sm flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-900 text-base mb-0.5 truncate">{item.name}</h4>
                                                    <p className="text-sm text-gray-500 mb-1">{item.category || item.type}</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-emerald-600 font-bold text-lg">
                                                            {formatCOP(item.discountedPrice)}
                                                        </p>
                                                        <span className="text-sm text-gray-400 line-through">
                                                            {formatCOP(item.originalPrice)}
                                                        </span>
                                                    </div>
                                                    {/* Urgency indicators */}
                                                    {item.availableUntil && !isExpired && (
                                                        <Countdown targetTime={item.availableUntil} />
                                                    )}
                                                    {isExpired && (
                                                        <p className="text-xs font-bold text-red-600 flex items-center gap-1 mt-1">
                                                            <AlertTriangle size={12} /> Producto expirado
                                                        </p>
                                                    )}
                                                    {stockQuantity !== null && stockQuantity <= 3 && stockQuantity > 0 && !isExpired && (
                                                        <p className="text-xs font-bold text-orange-500 flex items-center gap-1 mt-1">
                                                            <Clock size={12} /> {stockQuantity === 1 ? '¡Solo 1 disponible!' : `¡Solo ${stockQuantity} disponibles!`}
                                                        </p>
                                                    )}
                                                    {isAtStockLimit && !isExpired && (
                                                        <p className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-1">
                                                            <AlertTriangle size={12} /> Ya tienes el máximo disponible
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fila 2: controles de cantidad + eliminar */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100 shadow-sm">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm transition-all active:scale-90"
                                                        aria-label="Disminuir cantidad"
                                                    >
                                                        <Minus size={16} strokeWidth={3} />
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-gray-900 text-lg">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        aria-label="Aumentar cantidad"
                                                        disabled={isExpired || isAtStockLimit}
                                                    >
                                                        <Plus size={16} strokeWidth={3} />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-all active:scale-90 border border-transparent hover:border-red-100"
                                                    aria-label="Eliminar producto"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Summary - Sticky Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden sticky top-6">
                            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
                                <h3 className="font-bold text-lg text-white">Resumen del Pedido</h3>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-gray-700">
                                        <span className="font-medium">Subtotal</span>
                                        <span className="font-semibold">{formatCOP(getTotalPrice())}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-700">
                                        <span className="font-medium">Domicilio</span>
                                        <span className="text-gray-400 text-sm italic">Calculado al pagar</span>
                                    </div>
                                    <div className="border-t-2 border-gray-200 pt-3 flex justify-between items-baseline">
                                        <span className="font-bold text-gray-900 text-lg">Total</span>
                                        <span className="text-emerald-600 font-bold text-2xl">{formatCOP(getTotalPrice())}</span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleCheckout}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                                >
                                    Proceder al Pago
                                </Button>

                                <p className="text-xs text-gray-500 text-center leading-relaxed">
                                    Al continuar aceptas nuestros términos y condiciones
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cart;
