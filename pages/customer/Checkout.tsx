import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { OrderStatus, DonationCenter, ActiveRedemption } from '../../types';
import { ArrowLeft, CreditCard, Wallet, MapPin, Phone, Store, Leaf, Heart, Gift, Tag } from 'lucide-react';
import { PaymentForm } from '../../components/customer/checkout/PaymentForm';
import { DonationCenterSelector } from '../../components/customer/checkout/DonationCenterSelector';
import { dataService } from '../../services/dataService';
import { useLocation } from '../../context/LocationContext';
import { PLATFORM_COMMISSION_RATE, DEFAULT_DELIVERY_FEE } from '../../utils/constants';
import { calculateDeliveryFee, DeliveryCalculationResult } from '../../utils/delivery';
import { logger } from '../../utils/logger';
import { GuestConversionBanner } from '../../components/customer/common/GuestConversionBanner';
import { NotificationPermissionModal, hasAskedForNotifications } from '../../components/customer/common/NotificationPermissionModal';

type DeliveryMethod = 'delivery' | 'pickup' | 'donation';

export const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { items, clearCart, getCartByVenue } = useCart();
    const { user, loginAsGuest, isAuthenticated, isLoading: authLoading } = useAuth();
    const { city, latitude, longitude } = useLocation();
    const { success, error } = useToast();

    // State Hooks
    const [deliveryCosts, setDeliveryCosts] = useState<Record<string, DeliveryCalculationResult>>({});
    const [venuesData, setVenuesData] = useState<Record<string, any>>({}); // Cache venue data

    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
    // Pre-fill from user profile
    const [address, setAddress] = useState(user?.address || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [selectedDonationCenter, setSelectedDonationCenter] = useState<DonationCenter | null>(null);
    const [loading, setLoading] = useState(false);
    const [cityError, setCityError] = useState<string | null>(null);
    const [showNotifModal, setShowNotifModal] = useState(false);
    const [pendingNavPath, setPendingNavPath] = useState<string>('/app/orders');
    // Canje de puntos seleccionado para aplicar en esta compra
    const [selectedRedemption, setSelectedRedemption] = useState<ActiveRedemption | null>(null);

    // After order success: show notification modal on first order if not asked yet,
    // then navigate. On subsequent orders, navigate immediately.
    const navigateAfterOrder = (path: string) => {
        if (!hasAskedForNotifications()) {
            setPendingNavPath(path);
            setShowNotifModal(true);
        } else {
            navigate(path);
        }
    };

    // Auto-login guiado para Guest Checkout
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            loginAsGuest().catch(err => {
                logger.error("Failed to login as guest", err);
                error("Error al preparar tu sesión. Intenta de nuevo.");
            });
        }
    }, [authLoading, isAuthenticated, loginAsGuest, error]);

    // Rellenar datos cuando el usuario (o guest) se carga
    useEffect(() => {
        if (user) {
            if (user.address && !address) setAddress(user.address);
            if (user.phone && !phone) setPhone(user.phone);
        }
    }, [user]);

    const venueGroups = getCartByVenue();

    // Load Venues Data on Mount or when items change
    useEffect(() => {
        const loadVenues = async () => {
            const venueIds = Array.from(venueGroups.keys());
            const data: Record<string, any> = {};

            for (const id of venueIds) {
                try {
                    const v = await dataService.getVenue(id);
                    if (v) data[id] = v;
                } catch (e) {
                    logger.error("Error loading venue data", e);
                }
            }
            setVenuesData(data);
        };
        loadVenues();
    }, [items]); // Reload if items change (active venues might change)


    // Calculate Fees when dependencies change
    useEffect(() => {
        // If no user location available, we can't calculate precisely. Assume delivery allowed or fallback.
        // In this implementation, we rely on the venue's config.

        const newCosts: Record<string, DeliveryCalculationResult> = {};

        venueGroups.forEach((groupItems, venueId) => {
            const venue = venuesData[venueId];
            if (!venue) return;

            const subtotal = groupItems.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);

            // Use real GPS from LocationContext; fall back to Bogotá center only if unavailable
            const userLat = latitude ?? 4.6097;
            const userLng = longitude ?? -74.0817;

            const result = calculateDeliveryFee(
                venue,
                userLat,
                userLng,
                subtotal
            );
            newCosts[venueId] = result;
        });
        setDeliveryCosts(newCosts);

    }, [venuesData, items, deliveryMethod]); // Recalculate if venues loaded or items change


    // Validate City Consistency
    useEffect(() => {
        const validateCity = async () => {
            setCityError(null);
            if (!city) return;

            for (const [venueId] of venueGroups.entries()) {
                const venue = venuesData[venueId]; // Use cached data if available
                if (venue && venue.city && venue.city !== city) {
                    setCityError(`El restaurante "${venue.name}" está en ${venue.city}, pero tu ubicación es ${city}.`);
                    return;
                }
            }
        };
        validateCity();
    }, [items, city, venuesData]);


    // Helper to calculate totals
    const calculateOrderTotals = (venueId: string, venueItems: any[]) => {
        const subtotal = venueItems.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
        const platformFee = Math.round((subtotal * PLATFORM_COMMISSION_RATE) * 100) / 100;

        let deliveryFee = 0;
        if (deliveryMethod === 'delivery') {
            // Use calculated fee or default if calculation not ready/possible (fallback)
            // If calculation says impossible, we should probably block checkout, but for now use fee.
            const calc = deliveryCosts[venueId];
            if (calc && calc.possible) {
                deliveryFee = calc.fee;
            } else {
                // Fallback or error state
                deliveryFee = DEFAULT_DELIVERY_FEE;
            }
        }

        const venueEarnings = Math.round((subtotal - platformFee) * 100) / 100;
        const total = subtotal + deliveryFee;

        return { subtotal, platformFee, deliveryFee, venueEarnings, total };
    };

    // Calculate Grand Total for UI (con descuento de canje aplicado)
    const getGrandTotal = () => {
        let total = 0;
        venueGroups.forEach((items, venueId) => {
            total += calculateOrderTotals(venueId, items).total;
        });
        const discount = selectedRedemption?.discountAmount ?? 0;
        return Math.max(0, total - discount);
    };

    // Total de descuento activo
    const activeDiscount = selectedRedemption?.discountAmount ?? 0;

    // Canjes válidos (no usados, no vencidos)
    const availableRedemptions = (user?.redemptions ?? []).filter(
        r => !r.usedAt && new Date(r.expiresAt) > new Date()
    );

    // Calculate CO2 Impact
    const calculateCo2Impact = () => {
        const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
        let baseImpact = itemsCount * 0.5; // 0.5kg per item base

        // Bonus based on delivery method
        if (deliveryMethod === 'pickup') {
            baseImpact += 0.3; // Bonus for pickup
        } else if (deliveryMethod === 'donation') {
            baseImpact += 0.2; // Bonus for donation
        }

        return Number(baseImpact.toFixed(1));
    };

    const estimatedCo2 = calculateCo2Impact();

    // Estimate points user will earn from this order
    const estimatedPoints = React.useMemo(() => {
        const moneySaved = items.reduce((sum, item) => sum + ((item.originalPrice - item.discountedPrice) * item.quantity), 0);
        const pointsFromSavings = Math.floor(moneySaved / 1000);
        const pointsFromCo2 = Math.floor(estimatedCo2 * 10);
        return Math.min(pointsFromSavings + pointsFromCo2, 500);
    }, [items, estimatedCo2]);

    const getRedirectPath = (orderIds: string[]) => {
        const orderId = orderIds[0] || '';
        // Si el usuario es gestor, llevarlo a la gestión de pedidos
        if (user?.role === 'VENUE_OWNER' || user?.role === 'SUPER_ADMIN') {
            return `/order-management?search=${orderId}`;
        }
        // Si es cliente, llevarlo a "Mis Pedidos" filtrado por este ID
        return `/app/orders?orderId=${orderId}`;
    };


    const handlePlaceOrder = async () => {
        if (!user) {
            error('Debes iniciar sesión para realizar pedidos.');
            return;
        }

        if (deliveryMethod === 'delivery' && !address) {
            error('Por favor ingresa una dirección de entrega.');
            return;
        }

        if (!phone) {
            error('Por favor ingresa un número de teléfono.');
            return;
        }

        if (deliveryMethod === 'donation' && !selectedDonationCenter) {
            error('Por favor selecciona un centro de donación.');
            return;
        }

        // Validate City Consistency again (blocking)
        if (cityError) {
            error(cityError);
            return;
        }

        // Validate Delivery Feasibility
        if (deliveryMethod === 'delivery') {
            for (const [venueId] of venueGroups.entries()) {
                const calc = deliveryCosts[venueId];
                if (calc && !calc.possible) {
                    error(`No es posible entregar desde este negocio. ${calc.reason || ''}`);
                    return;
                }
            }
        }

        // Validate product availability — block if any item's availableUntil has passed
        const now = new Date();
        const expiredItems = items.filter(item => item.availableUntil && new Date(item.availableUntil) < now);
        if (expiredItems.length > 0) {
            const names = expiredItems.map(i => i.name).join(', ');
            error(`Los siguientes productos ya no están disponibles: ${names}. Por favor actualiza tu carrito.`);
            return;
        }

        setLoading(true);

        try {
            const createOrderFn = httpsCallable(functions, 'createOrder');

            const orderPromises = Array.from(venueGroups.entries()).map(async ([venueId, venueItems]) => {
                const { deliveryFee } = calculateOrderTotals(venueId, venueItems);

                const payload = {
                    venueId,
                    products: venueItems.map(item => ({
                        productId: item.id,
                        quantity: item.quantity
                    })),
                    paymentMethod: 'cash',
                    deliveryMethod,
                    deliveryFee,
                    address: address,
                    city: city || 'Bogotá',
                    phone: phone,
                    transactionId: null,
                    isDonation: deliveryMethod === 'donation',
                    donationCenterId: selectedDonationCenter?.id,
                    donationCenterName: selectedDonationCenter?.name,
                    estimatedCo2: calculateCo2Impact() / venueGroups.size,
                    // Canje de puntos aplicado
                    redemptionId: selectedRedemption?.id ?? null,
                    discountAmount: selectedRedemption ? Math.round(activeDiscount / venueGroups.size) : 0,
                };
                const result: any = await createOrderFn(payload);
                return result.data.orderId;
            });

            const orderIds = await Promise.all(orderPromises);

            clearCart();
            const pointsMsg = estimatedPoints > 0 ? ` +${estimatedPoints} puntos ganados 🎯` : '';
            success(`¡Pedido realizado con éxito! 🎉${pointsMsg}`);
            navigateAfterOrder(getRedirectPath(orderIds));

        } catch (err: any) {
            logger.error("Error creating order:", err);
            error(err.message || 'Error al procesar el pedido. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleCardPaymentSuccess = async (transactionId: string) => {
        if (!user) return;

        setLoading(true);
        try {
            const createOrderFn = httpsCallable(functions, 'createOrder');

            const orderPromises = Array.from(venueGroups.entries()).map(async ([venueId, venueItems]) => {
                const { deliveryFee } = calculateOrderTotals(venueId, venueItems);

                const payload = {
                    venueId,
                    products: venueItems.map(item => ({
                        productId: item.id,
                        quantity: item.quantity
                    })),
                    paymentMethod: 'card',
                    deliveryMethod,
                    deliveryFee,
                    address: address,
                    city: city || 'Bogotá',
                    phone: phone,
                    transactionId,
                    isDonation: deliveryMethod === 'donation',
                    donationCenterId: selectedDonationCenter?.id,
                    donationCenterName: selectedDonationCenter?.name,
                    estimatedCo2: calculateCo2Impact() / venueGroups.size, // Split impact across orders
                    // Canje de puntos aplicado
                    redemptionId: selectedRedemption?.id ?? null,
                    discountAmount: selectedRedemption ? Math.round(activeDiscount / venueGroups.size) : 0,
                };
                const result: any = await createOrderFn(payload);
                return result.data.orderId;
            });

            const orderIds = await Promise.all(orderPromises);
            clearCart();
            const pointsMsg = estimatedPoints > 0 ? ` +${estimatedPoints} puntos ganados 🎯` : '';
            success(`¡Pago exitoso! Tu pedido ha sido confirmado. ✅${pointsMsg}`);
            navigateAfterOrder(getRedirectPath(orderIds));
        } catch (err: any) {
            logger.error('Error creating paid order:', err);
            error('Error al crear el pedido pagado. Contacta a soporte.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (items.length === 0 && !loading) {
            navigate('/app/cart');
        }
    }, [items.length, navigate, loading]);

    if (authLoading || (!isAuthenticated && !loading)) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-500 font-medium">Preparando tu carrito...</p>
            </div>
        );
    }

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/30 to-gray-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate('/app/cart')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-all font-bold active:scale-95 px-2 py-1"
                    >
                        <ArrowLeft size={20} />
                        Volver al Carrito
                    </button>

                    {/* Banner de conversión para usuarios invitados (anónimos) */}
                    <GuestConversionBanner context="checkout" />

                    {/* Hero Banner */}
                    <div className="relative mb-8 rounded-2xl overflow-hidden shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 to-blue-600/90 z-10"></div>
                        <img
                            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=300&fit=crop&q=80"
                            alt="Deliciosa comida"
                            className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-white p-6">
                            <h1 className="text-4xl font-bold mb-2 drop-shadow-lg">¡Casi listo!</h1>
                            <p className="text-lg opacity-90 flex items-center gap-2">
                                <Leaf size={20} className="text-emerald-300" />
                                Con este rescate ahorrarás aprox. <strong>{estimatedCo2}kg de CO2</strong>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {cityError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                                    <span className="text-xl">🛑</span> {cityError}
                                </div>
                            )}

                            <div className="bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 flex gap-1">
                                <button
                                    onClick={() => setDeliveryMethod('delivery')}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${deliveryMethod === 'delivery'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <MapPin size={18} />
                                    <span className="text-xs sm:text-sm">Domicilio</span>
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('pickup')}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${deliveryMethod === 'pickup'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <Store size={18} />
                                    <span className="text-xs sm:text-sm">Recoger</span>
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('donation')}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${deliveryMethod === 'donation'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <Heart size={18} className={deliveryMethod === 'donation' ? 'fill-white' : ''} />
                                    <span className="text-xs sm:text-sm">Donar</span>
                                </button>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    {deliveryMethod === 'delivery' ? <MapPin className="text-emerald-600" size={20} /> : deliveryMethod === 'pickup' ? <Store className="text-emerald-600" size={20} /> : <Heart className="text-emerald-600" size={20} />}
                                    {deliveryMethod === 'delivery' ? 'Información de Entrega' : deliveryMethod === 'pickup' ? 'Datos de Recogida' : 'Donar a una Causa'}
                                </h3>

                                <div className="space-y-4">
                                    {deliveryMethod === 'delivery' && (
                                        <div className="animate-fadeIn">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Dirección de Entrega *
                                            </label>
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                placeholder="Ej: Calle 123 #45-67, Bogotá"
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base transition-all"
                                                required
                                            />
                                        </div>
                                    )}

                                    {deliveryMethod === 'pickup' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeIn">
                                            <p className="text-blue-800 text-sm flex items-center gap-2">
                                                <Store size={16} />
                                                <strong>Recuerda:</strong> Debes ir al negocio a recoger tu pedido antes de la hora indicada.
                                            </p>
                                        </div>
                                    )}

                                    {deliveryMethod === 'donation' && (
                                        <div className="animate-fadeIn space-y-4">
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                <p className="text-emerald-800 text-sm">
                                                    <Heart className="inline mr-2 text-emerald-500" size={18} />
                                                    <strong>¡Gracias por tu generosidad!</strong> Al elegir donar, el restaurante llevará tus productos directamente al centro de acopio seleccionado.
                                                </p>
                                            </div>

                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Selecciona a quién quieres ayudar:
                                            </label>
                                            <DonationCenterSelector
                                                onSelect={setSelectedDonationCenter}
                                                selectedCenterId={selectedDonationCenter?.id}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <Phone size={16} className="inline mr-1" />
                                            Teléfono de Contacto *
                                        </label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="Ej: 3001234567"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base transition-all"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Te contactaremos si hay novedades con tu {deliveryMethod === 'delivery' ? 'entrega' : 'pedido'}.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <CreditCard className="text-emerald-600" size={20} />
                                    Método de Pago
                                </h3>

                                <div className="space-y-3">
                                    <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${paymentMethod === 'cash' ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' : 'border-gray-100 hover:border-emerald-200'}`}>
                                        <input
                                            type="radio"
                                            name="payment"
                                            value="cash"
                                            checked={paymentMethod === 'cash'}
                                            onChange={(e) => setPaymentMethod(e.target.value as 'cash')}
                                            className="text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                                        />
                                        <Wallet className={paymentMethod === 'cash' ? 'text-emerald-600' : 'text-gray-400'} size={24} />
                                        <div>
                                            <p className="font-bold text-gray-900">
                                                {deliveryMethod === 'delivery' ? 'Pago Contra Entrega' : 'Pagar en el Negocio'}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {deliveryMethod === 'delivery' ? 'Paga en efectivo al recibir' : 'Paga en efectivo al recoger'}
                                            </p>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${paymentMethod === 'card' ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' : 'border-gray-100 hover:border-emerald-200'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="payment"
                                            value="card"
                                            checked={paymentMethod === 'card'}
                                            onChange={(e) => setPaymentMethod(e.target.value as 'card')}
                                            className="text-emerald-600 focus:ring-emerald-500 w-5 h-5"
                                        />
                                        <CreditCard className={paymentMethod === 'card' ? 'text-emerald-600' : 'text-gray-400'} size={24} />
                                        <div>
                                            <p className="font-bold text-gray-900">Tarjeta de Crédito/Débito</p>
                                            <p className="text-sm text-gray-500">Paga ahora de forma segura</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {paymentMethod === 'card' && (
                                <div className="bg-white rounded-xl p-6 shadow-sm border border-emerald-100 ring-1 ring-emerald-50">
                                    <h3 className="font-bold text-lg mb-4 text-emerald-800">Detalles del Pago</h3>
                                    {((deliveryMethod === 'delivery' && !address) || !phone || !!cityError) ? (
                                        <div className="text-yellow-600 bg-yellow-50 p-4 rounded-lg text-sm mb-4">
                                            ⚠️ {cityError ? 'No es posible procesar el pago debido al error de ciudad.' : `Por favor completa ${deliveryMethod === 'delivery' ? 'la dirección y' : ''} el teléfono antes de ingresar tu tarjeta.`}
                                        </div>
                                    ) : (
                                        <PaymentForm
                                            amount={getGrandTotal()}
                                            onSuccess={handleCardPaymentSuccess}
                                            onError={(err) => error(err)}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4">Resumen de Productos</h3>

                                {Array.from(venueGroups.entries()).map(([venueId, venueItems]) => (
                                    <div key={venueId} className="mb-4 pb-4 border-b last:border-0">
                                        <p className="text-sm font-semibold text-gray-600 mb-2">Negocio: {venuesData[venueId]?.name || venueId}</p>
                                        <div className="space-y-2">
                                            {venueItems.map(item => (
                                                <div key={item.id} className="flex justify-between text-sm">
                                                    <span className="text-gray-700">
                                                        {item.quantity}x {item.name}
                                                    </span>
                                                    <span className="font-semibold">
                                                        ${(item.discountedPrice * item.quantity).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Subtotal per venue */}
                                        <div className="mt-2 text-right text-xs text-gray-500">
                                            Subtotal: ${calculateOrderTotals(venueId, venueItems).subtotal.toFixed(2)} |
                                            Envío: ${calculateOrderTotals(venueId, venueItems).deliveryFee.toFixed(2)} ({(deliveryCosts[venueId]?.distance || 0).toFixed(1)}km)
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-6">
                                <h3 className="font-bold text-lg mb-4">Resumen del Pedido</h3>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span>${Array.from(venueGroups.entries()).reduce((sum, [vid, vitems]) => sum + calculateOrderTotals(vid, vitems).subtotal, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Domicilio ({venueGroups.size} negocios)</span>
                                        {deliveryMethod === 'delivery' ? (
                                            // Sum up all delivery fees 
                                            <span>${Array.from(venueGroups.keys()).reduce((sum, vid) => sum + (calculateOrderTotals(vid, venueGroups.get(vid) || []).deliveryFee), 0).toFixed(2)}</span>
                                        ) : (
                                            <span className="text-emerald-600 font-semibold">GRATIS  ({deliveryMethod === 'pickup' ? 'Recogida' : 'Donación'})</span>
                                        )}
                                    </div>

                                    {/* Canjes de puntos disponibles */}
                                    {availableRedemptions.length > 0 && (
                                        <div className="border border-dashed border-emerald-200 rounded-xl p-3 bg-emerald-50 space-y-2">
                                            <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                                <Gift size={12} /> Canjes disponibles
                                            </p>
                                            {availableRedemptions.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setSelectedRedemption(prev => prev?.id === r.id ? null : r)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${selectedRedemption?.id === r.id
                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                        : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400'
                                                        }`}
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        <Tag size={11} />
                                                        {r.label}
                                                    </span>
                                                    <span>{selectedRedemption?.id === r.id ? '✓ Aplicado' : 'Aplicar'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Descuento activo */}
                                    {activeDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-700 font-semibold">
                                            <span className="flex items-center gap-1">
                                                <Tag size={13} /> Descuento canje
                                            </span>
                                            <span>-${activeDiscount.toLocaleString('es-CO')} COP</span>
                                        </div>
                                    )}
                                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span className="text-emerald-600">${getGrandTotal().toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-end mt-1">
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                                            <Leaf size={10} /> Impacto: -{estimatedCo2}kg CO2
                                        </span>
                                    </div>
                                </div>

                                {paymentMethod === 'cash' ? (
                                    <button
                                        onClick={handlePlaceOrder}
                                        disabled={loading || (deliveryMethod === 'delivery' && !address) || !phone || !!cityError}
                                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        {loading ? (
                                            <>
                                                <span className="animate-spin text-xl">⏳</span>
                                                <span>Procesando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Wallet size={24} />
                                                <span>
                                                    {deliveryMethod === 'delivery' ? 'Confirmar Pedido 💚' : deliveryMethod === 'pickup' ? 'Reservar Pedido 🛍️' : 'Realizar Donación ❤️'}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="text-sm text-gray-500 text-center italic p-2 bg-gray-50 rounded-lg">
                                        Completa el pago en el formulario de arriba
                                    </div>
                                )}

                                <p className="text-xs text-gray-500 mt-4 text-center">
                                    Al confirmar aceptas nuestros términos y condiciones.
                                    {deliveryMethod === 'pickup' && ' Debes presentar tu ID de pedido al recoger.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div >

            {/* Notification permission modal — shown after first successful order */}
            {showNotifModal && user && (
                <NotificationPermissionModal
                    userId={user.id}
                    onClose={() => {
                        setShowNotifModal(false);
                        navigate(pendingNavPath);
                    }}
                />
            )}
        </>
    );
};

export default Checkout;
