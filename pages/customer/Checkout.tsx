import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { OrderStatus, DonationCenter, ActiveRedemption } from '../../types';
import { ArrowLeft, CreditCard, Wallet, MapPin, Phone, Store, Leaf, Heart, Gift, Tag, Zap } from 'lucide-react';
import { DonationCenterSelector } from '../../components/customer/checkout/DonationCenterSelector';
import { dataService } from '../../services/dataService';
import { useLocation } from '../../context/LocationContext';
import { PLATFORM_COMMISSION_RATE, DEFAULT_DELIVERY_FEE } from '../../utils/constants';
import { calculateDeliveryFee, DeliveryCalculationResult } from '../../utils/delivery';
import { logger } from '../../utils/logger';
import { GuestConversionBanner } from '../../components/customer/common/GuestConversionBanner';
import { NotificationPermissionModal, hasAskedForNotifications } from '../../components/customer/common/NotificationPermissionModal';
import { PhoneInput } from '../../components/customer/common/PhoneInput';
import { isProductExpired } from '../../utils/productAvailability';
import { formatCOP, formatKgCO2 } from '../../utils/formatters';
import { useOrderFlow } from '../../hooks/useOrderFlow';
import { safeParseCheckoutForm } from '../../schemas';
import { useTranslation } from 'react-i18next';

type DeliveryMethod = 'delivery' | 'pickup' | 'donation';

export const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { items, clearCart, removeFromCart, getCartByVenue } = useCart();
    const { user, loginAsGuest, isAuthenticated, isLoading: authLoading } = useAuth();
    const { city, latitude, longitude } = useLocation();
    const { success, error } = useToast();
    const { t } = useTranslation();

    // Custom Order Flow Hook
    const { 
        loading, 
        processOrder, 
        showNotifModal, 
        setShowNotifModal, 
        pendingNavPath 
    } = useOrderFlow();

    // State Hooks
    const [deliveryCosts, setDeliveryCosts] = useState<Record<string, DeliveryCalculationResult>>({});
    const [venuesData, setVenuesData] = useState<Record<string, any>>({}); // Cache venue data

    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
    const [address, setAddress] = useState(user?.address || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [selectedDonationCenter, setSelectedDonationCenter] = useState<DonationCenter | null>(null);
    const [cityError, setCityError] = useState<string | null>(null);
    const orderJustPlacedRef = React.useRef(false);
    const [selectedRedemption, setSelectedRedemption] = useState<ActiveRedemption | null>(null);

    const isPhoneValid = phone.length >= 7 && phone.length <= 17 && /^\+?\d+$/.test(phone);

    // Auto-login guiado para Guest Checkout (máximo un intento para evitar loops)
    const guestLoginAttempted = useRef(false);
    useEffect(() => {
        if (!authLoading && !isAuthenticated && !guestLoginAttempted.current) {
            guestLoginAttempted.current = true;
            loginAsGuest().catch(err => {
                logger.error("Failed to login as guest", err);
                error(t('checkout_session_error'));
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
        const newCosts: Record<string, DeliveryCalculationResult> = {};

        venueGroups.forEach((groupItems, venueId) => {
            const venue = venuesData[venueId];
            if (!venue) return;

            const subtotal = groupItems.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0);
            const userLat = latitude ?? 4.6097;
            const userLng = longitude ?? -74.0817;

            const result = calculateDeliveryFee(
                venue,
                userLat,
                userLng,
                subtotal
            );
            newCosts[venueId] = result;
            if (!result.possible) {
                logger.warn(`Delivery fee fallback para venue ${venueId}: ${result.reason || JSON.stringify(result)}`);
            }
        });
        setDeliveryCosts(newCosts);

    }, [venuesData, items, deliveryMethod]);


    // Validate City Consistency
    useEffect(() => {
        const validateCity = async () => {
            setCityError(null);
            if (!city) return;

            const cityMatch = (a: string, b: string) => {
                const na = a.trim().toLowerCase();
                const nb = b.trim().toLowerCase();
                return na.includes(nb) || nb.includes(na);
            };
            for (const [venueId] of venueGroups.entries()) {
                const venue = venuesData[venueId];
                if (venue && venue.city && city && !cityMatch(venue.city, city)) {
                    setCityError(t('checkout_city_error', { name: venue.name, city: venue.city, userCity: city }));
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
            const hasFreeDelivery = user?.rescattoPass?.isActive && 
                                  user?.rescattoPass?.status === 'active' && 
                                  user?.rescattoPass?.benefits?.freeDelivery;

            if (hasFreeDelivery) {
                deliveryFee = 0;
            } else {
                const calc = deliveryCosts[venueId];
                if (calc && calc.possible) {
                    deliveryFee = calc.fee;
                } else {
                    deliveryFee = DEFAULT_DELIVERY_FEE;
                }
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

    const activeDiscount = selectedRedemption?.discountAmount ?? 0;

    const availableRedemptions = (user?.redemptions ?? []).filter(
        r => !r.usedAt && new Date(r.expiresAt) > new Date()
    );

    const calculateCo2Impact = () => {
        const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
        let baseImpact = itemsCount * 0.5;

        if (deliveryMethod === 'pickup') {
            baseImpact += 0.3;
        } else if (deliveryMethod === 'donation') {
            baseImpact += 0.2;
        }

        return Number(baseImpact.toFixed(1));
    };

    const estimatedCo2 = calculateCo2Impact();

    const estimatedPoints = React.useMemo(() => {
        const moneySaved = items.reduce((sum, item) => sum + ((item.originalPrice - item.discountedPrice) * item.quantity), 0);
        const pointsFromSavings = Math.floor(moneySaved / 1000);
        const pointsFromCo2 = Math.floor(estimatedCo2 * 10);
        return Math.min(pointsFromSavings + pointsFromCo2, 500);
    }, [items, estimatedCo2]);

    const handleUnavailableProductsError = (err: any): boolean => {
        const products = Array.isArray(err?.details?.products) ? err.details.products : [];
        if (products.length === 0) return false;

        const productIds = new Set<string>();
        const productNames: string[] = [];

        for (const product of products) {
            if (typeof product?.productId === 'string' && product.productId.length > 0) {
                productIds.add(product.productId);
            }
            if (typeof product?.name === 'string' && product.name.length > 0) {
                productNames.push(product.name);
            }
        }

        if (productIds.size === 0) return false;

        items.forEach(item => {
            if (productIds.has(item.id)) {
                removeFromCart(item.id);
            }
        });

        const uniqueNames = Array.from(new Set(productNames));
        const preview = uniqueNames.slice(0, 2).join(', ');
        const hasMore = uniqueNames.length > 2;
        error(`${t('checkout_expired_removed')} ${preview || ''}${hasMore ? '...' : ''}`);
        navigate('/app/cart');
        return true;
    };


    const handlePlaceOrder = async () => {
        try {
            if (!user || user.isGuest) {
                error(t('checkout_login_required'));
                sessionStorage.setItem('rescatto_post_login_redirect', '/app/checkout');
                navigate('/login');
                return;
            }

            const expiredItems = items.filter(item => isProductExpired(item.availableUntil));
            if (expiredItems.length > 0) {
                expiredItems.forEach(item => removeFromCart(item.id));
                error(t('checkout_expired_removed'));
                navigate('/app/cart');
                return;
            }

            const validation = safeParseCheckoutForm({
                address: address || undefined,
                phone: phone,
                deliveryMethod,
                selectedDonationCenterId: selectedDonationCenter?.id
            });

            if (!validation.success) {
                error(validation.error.issues[0]?.message || t('checkout_invalid_data'));
                return;
            }

            if (cityError) {
                error(cityError);
                return;
            }

            if (deliveryMethod === 'delivery') {
                for (const [venueId] of venueGroups.entries()) {
                    const calc = deliveryCosts[venueId];
                    if (calc && !calc.possible) {
                        error(t('checkout_delivery_impossible', { reason: calc.reason || '' }));
                        return;
                    }
                }
            }

            orderJustPlacedRef.current = true;
            await processOrder({
                paymentMethod: 'cash',
                deliveryMethod,
                address,
                phoneDigits: phone,
                selectedDonationCenter,
                estimatedCo2,
                selectedRedemption,
                calculateOrderTotals
            });
        } catch (err: any) {
            logger.error("Error in handlePlaceOrder:", err);
            error(t('checkout_order_error') || "Error al procesar el pedido");
        }
    };


    useEffect(() => {
        if (items.length === 0 && !loading && !orderJustPlacedRef.current && !authLoading && isAuthenticated) {
            navigate('/app/cart');
        }
    }, [items.length, navigate, loading, authLoading, isAuthenticated]);

    if (authLoading || (!isAuthenticated && !loading)) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-500 font-medium">{t('checkout_preparing')}</p>
            </div>
        );
    }

    if (items.length === 0) {
        if (showNotifModal && user) {
            return (
                <NotificationPermissionModal
                    userId={user.id}
                    onClose={() => {
                        setShowNotifModal(false);
                        navigate(pendingNavPath);
                    }}
                />
            );
        }
        return null;
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/30 to-gray-50 p-6 overflow-x-hidden">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate('/app/cart')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-all font-bold active:scale-95 px-2 py-1"
                    >
                        <ArrowLeft size={20} />
                        {t('checkout_back_cart')}
                    </button>

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
                            <h1 className="text-4xl font-bold mb-2 drop-shadow-lg">{t('checkout_almost_ready')}</h1>
                            <p className="text-lg opacity-90 flex items-center gap-2">
                                <Leaf size={20} className="text-emerald-300" />
                                {t('checkout_co2_savings', { amount: formatKgCO2(estimatedCo2) })}
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
                                    <span className="text-xs sm:text-sm">{t('checkout_method_delivery')}</span>
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('pickup')}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${deliveryMethod === 'pickup'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <Store size={18} />
                                    <span className="text-xs sm:text-sm">{t('checkout_method_pickup')}</span>
                                </button>
                                <button
                                    onClick={() => setDeliveryMethod('donation')}
                                    className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${deliveryMethod === 'donation'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <Heart size={18} className={deliveryMethod === 'donation' ? 'fill-white' : ''} />
                                    <span className="text-xs sm:text-sm">{t('checkout_method_donation')}</span>
                                </button>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    {deliveryMethod === 'delivery' ? <MapPin className="text-emerald-600" size={20} /> : deliveryMethod === 'pickup' ? <Store className="text-emerald-600" size={20} /> : <Heart className="text-emerald-600" size={20} />}
                                    {deliveryMethod === 'delivery' ? t('checkout_info_delivery') : deliveryMethod === 'pickup' ? t('checkout_info_pickup') : t('checkout_info_donation')}
                                </h3>

                                <div className="space-y-4">
                                    {deliveryMethod === 'delivery' && (
                                        <div className="animate-fadeIn">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t('checkout_address_label')}
                                            </label>
                                            <input
                                                type="text"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                placeholder="Ej: Calle 123 #45-67, Bogotá"
                                                className="w-full bg-white px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base transition-all"
                                                required
                                            />
                                        </div>
                                    )}

                                    {deliveryMethod === 'pickup' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeIn">
                                            <p className="text-blue-800 text-sm flex items-center gap-2">
                                                <Store size={16} />
                                                {t('checkout_pickup_reminder')}
                                            </p>
                                        </div>
                                    )}

                                    {deliveryMethod === 'donation' && (
                                        <div className="animate-fadeIn space-y-4">
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                <p className="text-emerald-800 text-sm">
                                                    <Heart className="inline mr-2 text-emerald-500" size={18} />
                                                    {t('checkout_donation_thanks')}
                                                </p>
                                            </div>

                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t('checkout_donation_destiny')}
                                            </label>
                                            <DonationCenterSelector
                                                onSelect={setSelectedDonationCenter}
                                                selectedCenterId={selectedDonationCenter?.id}
                                            />
                                        </div>
                                    )}

                                    <PhoneInput
                                        label={t('checkout_phone_label')}
                                        value={phone}
                                        onChange={setPhone}
                                        error={phone.length > 0 && !isPhoneValid ? t('checkout_phone_error') : undefined}
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <CreditCard className="text-emerald-600" size={20} />
                                    {t('checkout_payment_method')}
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
                                                {deliveryMethod === 'delivery' ? t('checkout_payment_cash_delivery') : t('checkout_payment_cash_pickup')}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {deliveryMethod === 'delivery' ? t('checkout_payment_cash_desc_delivery') : t('checkout_payment_cash_desc_pickup')}
                                            </p>
                                        </div>
                                    </label>

                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-4">{t('checkout_product_summary')}</h3>

                                {Array.from(venueGroups.entries()).map(([venueId, venueItems]) => (
                                    <div key={venueId} className="mb-4 pb-4 border-b last:border-0">
                                        <p className="text-sm font-semibold text-gray-600 mb-2">{t('checkout_venue_name', { name: venuesData[venueId]?.name || venueId })}</p>
                                        <div className="space-y-2">
                                            {venueItems.map(item => (
                                                <div key={item.id} className="flex justify-between text-sm">
                                                    <span className="text-gray-700">
                                                        {item.quantity}x {item.name}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {formatCOP(item.discountedPrice * item.quantity)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Subtotal per venue */}
                                        <div className="mt-2 text-right text-xs text-gray-500">
                                            {t('checkout_venue_subtotal', { 
                                                subtotal: formatCOP(calculateOrderTotals(venueId, venueItems).subtotal),
                                                fee: formatCOP(calculateOrderTotals(venueId, venueItems).deliveryFee),
                                                dist: (deliveryCosts[venueId]?.distance || 0).toFixed(1)
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-6">
                                <h3 className="font-bold text-lg mb-4">{t('checkout_title')}</h3>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-gray-600">
                                        <span>{t('cart_subtotal')}</span>
                                        <span>{formatCOP(Array.from(venueGroups.entries()).reduce((sum, [vid, vitems]) => sum + calculateOrderTotals(vid, vitems).subtotal, 0))}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>{t('cart_delivery')} ({venueGroups.size} {venueGroups.size === 1 ? t('checkout_venue_one') : t('checkout_venue_many')})</span>
                                        {deliveryMethod === 'delivery' ? (
                                            <div className="text-right">
                                                {user?.rescattoPass?.isActive && user?.rescattoPass?.benefits?.freeDelivery ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-gray-400 line-through text-xs">
                                                            {formatCOP(Array.from(venueGroups.keys()).reduce((sum, vid) => sum + (calculateOrderTotals(vid, venueGroups.get(vid) || []).deliveryFee), 0))}
                                                        </span>
                                                        <span className="text-emerald-600 font-black flex items-center gap-1">
                                                            <Zap size={12} className="fill-emerald-600" />
                                                            {t('checkout_pass_free')}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span>{formatCOP(Array.from(venueGroups.keys()).reduce((sum, vid) => sum + (calculateOrderTotals(vid, venueGroups.get(vid) || []).deliveryFee), 0))}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-emerald-600 font-semibold">{deliveryMethod === 'pickup' ? t('checkout_free_pickup') : t('checkout_free_donation')}</span>
                                        )}
                                    </div>

                                    {/* Canjes de puntos disponibles */}
                                    {availableRedemptions.length > 0 && (
                                        <div className="border-2 border-emerald-100 rounded-2xl p-4 bg-emerald-50/50 space-y-3 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-black text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider">
                                                    <Gift size={14} className="text-emerald-500" /> 
                                                    {t('checkout_rewards')}
                                                </p>
                                                <span className="bg-emerald-200 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                    {availableRedemptions.length} {t('checkout_available')}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {availableRedemptions.map(r => (
                                                    <button
                                                        key={r.id}
                                                        onClick={() => setSelectedRedemption(prev => prev?.id === r.id ? null : r)}
                                                        className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all active:scale-[0.97] ${selectedRedemption?.id === r.id
                                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
                                                            : 'bg-white border-white text-emerald-700 hover:border-emerald-200 shadow-sm'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-1.5 rounded-lg transition-colors ${selectedRedemption?.id === r.id ? 'bg-white/20' : 'bg-emerald-50'}`}>
                                                                <Tag size={16} className={selectedRedemption?.id === r.id ? 'text-white' : 'text-emerald-600'} />
                                                            </div>
                                                            <span className="truncate">{r.label}</span>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedRedemption?.id === r.id ? 'border-white bg-white text-emerald-600' : 'border-emerald-100 bg-white'}`}>
                                                            {selectedRedemption?.id === r.id && <span className="text-[10px] font-black">✓</span>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedRedemption && (
                                                <p className="text-[10px] text-emerald-600 font-bold text-center animate-pulse">
                                                    ✨ {t('checkout_auto_discount')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Descuento activo */}
                                    {activeDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-700 font-semibold">
                                            <span className="flex items-center gap-1">
                                                <Tag size={13} /> {t('checkout_redemption_discount')}
                                            </span>
                                            <span>-{formatCOP(activeDiscount)}</span>
                                        </div>
                                    )}
                                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                                        <span>{t('cart_total')}</span>
                                        <span className="text-emerald-600">{formatCOP(getGrandTotal())}</span>
                                    </div>
                                    <div className="flex justify-end mt-1">
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                                            <Leaf size={10} /> {t('checkout_impact_leaf', { amount: formatKgCO2(estimatedCo2) })}
                                        </span>
                                    </div>
                                </div>

                                {paymentMethod === 'cash' ? (
                                    <button
                                        onClick={user?.isGuest ? () => { sessionStorage.setItem('rescatto_post_login_redirect', '/app/checkout'); navigate('/login'); } : handlePlaceOrder}
                                        disabled={loading || !!cityError}
                                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        {loading ? (
                                            <>
                                                <span className="animate-spin text-xl">⏳</span>
                                                <span>{t('checkout_processing')}</span>
                                            </>
                                        ) : user?.isGuest ? (
                                            <span>{t('checkout_login_continue')}</span>
                                        ) : (
                                            <>
                                                <Wallet size={24} />
                                                <span>
                                                    {deliveryMethod === 'delivery' ? t('checkout_btn_confirm') : deliveryMethod === 'pickup' ? t('checkout_btn_reserve') : t('checkout_btn_donate')}
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
                                    {t('checkout_terms_checkout')}
                                    {deliveryMethod === 'pickup' && ` ${t('checkout_pickup_id_reminder')}`}
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
