import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, doc, getDoc, getDocs, limit, updateDoc, startAfter, QueryDocumentSnapshot, DocumentData, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderStatus, Venue, UserRole, Product, ProductType } from '../../types';
import { useCart } from '../../context/CartContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Sparkles } from 'lucide-react';
import { Package, Clock, CheckCircle, XCircle, Truck, MessageSquare, Star, ArrowLeft, ShoppingCart, Share2, AlertTriangle, Ban } from 'lucide-react';
import { RatingModal } from '../../components/rating/RatingModal';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { logger } from '../../utils/logger';
import { GuestConversionBanner } from '../../components/customer/common/GuestConversionBanner';
import { formatCOP } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import TrackingMap from '../../components/customer/orders/TrackingMap';

export const MyOrders: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderIdParam = searchParams.get('orderId');
    const highlightParam = searchParams.get('highlight');

    const { user } = useAuth();
    const { createChat, openChat } = useChat();
    const { addToCart } = useCart();
    const { success, error: showError } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
    const [showChatWindow, setShowChatWindow] = useState(false);
    const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
    useEscapeKey(() => setShowChatWindow(false), showChatWindow);
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
    const highlightRef = useRef<HTMLDivElement | null>(null);

    // Scroll a la orden destacada cuando se navega desde una notificación FCM
    useEffect(() => {
        if (!highlightParam || loading || orders.length === 0) return;
        if (highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightParam, loading, orders.length]);

    // Carga inicial con paginación
    useEffect(() => {
        if (!user) return;
        loadOrders(true);
    }, [user?.id]);

    const loadOrders = async (initial = false) => {
        if (!user) return;
        if (initial) {
            setLoading(true);
            setOrders([]);
            setLastDoc(null);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const constraints: any[] = [
                where('customerId', '==', user.id),
                orderBy('createdAt', 'desc'),
            ];
            if (!initial && lastDoc) constraints.push(startAfter(lastDoc));
            const q = query(collection(db, 'orders'), ...constraints, limit(20));
            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as Order[];
            setOrders(prev => initial ? ordersData : [...prev, ...ordersData]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === 20);
        } catch (error) {
            logger.error('Error loading orders:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const findExistingOrderChatId = async (orderId: string, type: string): Promise<string | null> => {
        const chatsSnapshot = await getDocs(query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user?.id || ''),
            limit(20)
        ));
        const existingChat = chatsSnapshot.docs.find(d => {
            const data = d.data();
            return (data.orderId || '') === orderId && data.type === type;
        });
        return existingChat?.id || null;
    };

    const handleChatWithVenue = async (order: Order) => {
        try {
            if (!user?.id) {
                showError('Debes iniciar sesión para abrir el chat.');
                return;
            }
            setChatLoadingOrderId(order.id);

            // Prioridad 1: reutilizar el chat de venue ya existente para esta orden.
            const existingChatId = await findExistingOrderChatId(order.id, 'customer-venue');
            if (existingChatId) {
                await openChat(existingChatId);
                setShowChatWindow(true);
                success('Chat abierto');
                return;
            }

            // Siempre usar el backend como fuente de verdad para obtener el dueño correcto,
            // ignorando la caché local o metadata antigua del pedido.
            let venueContactUserId: string | string[] | null = null;
            let venueContactName: string =
                (order.metadata || {}).venueName ||
                (order.metadata || {}).venueDisplayName ||
                'Restaurante';

            try {
                const resolveVenueChatTarget = httpsCallable(functions, 'resolveVenueChatTarget');
                const targetResult: any = await resolveVenueChatTarget({ orderId: order.id });
                if (targetResult?.data?.userIds || targetResult?.data?.userId) {
                    venueContactUserId = targetResult.data.userIds || targetResult.data.userId;
                    venueContactName = targetResult.data.userName || venueContactName;
                }
            } catch (resolveErr) {
                logger.warn('No se pudo resolver el contacto de chat del restaurante:', resolveErr);
            }

            // Fallback a documento de sede cuando falla la función (muy raro)
            if (!venueContactUserId) {
                const venueDoc = await getDoc(doc(db, 'venues', order.venueId));
                if (venueDoc.exists()) {
                    const venueData = venueDoc.data() as Venue;
                    venueContactUserId =
                        (venueData as any).ownerId ||
                        (venueData as any).ownerUid ||
                        (venueData as any).managerId ||
                        (venueData as any).userId ||
                        null;
                    venueContactName = venueData.name || venueContactName;
                }
            }

            if (!venueContactUserId || (typeof venueContactUserId !== 'string' && !Array.isArray(venueContactUserId))) {
                showError('El restaurante aún no tiene chat activo. Intenta más tarde o contacta soporte.');
                return;
            }

            const newChat = await createChat(
                venueContactUserId,
                venueContactName,
                UserRole.VENUE_OWNER,
                'customer-venue',
                order.id
            );

            await openChat(newChat.id);
            setShowChatWindow(true);
            success(`Chat abierto con ${venueContactName}`);
        } catch (error: any) {
            logger.error('Error opening chat:', error);
            const code = String(error?.code || '');
            if (code.includes('permission-denied')) {
                showError('No tienes permisos para abrir este chat.');
            } else {
                showError('Error al abrir el chat. Intenta de nuevo.');
            }
        } finally {
            setChatLoadingOrderId(null);
        }
    };

    const handleChatWithDriver = async (order: Order) => {
        if (!order.driverId) {
            showError('No hay conductor asignado aún');
            return;
        }

        setChatLoadingOrderId(order.id);
        try {
            // Buscar exclusivamente el chat de tipo customer-driver para esta orden
            const existingChatId = await findExistingOrderChatId(order.id, 'customer-driver');

            const driverName = (order as any).driverName || 'Conductor';
            const chat = existingChatId
                ? { id: existingChatId }
                : await createChat(
                    order.driverId,
                    driverName,
                    UserRole.DRIVER,
                    'customer-driver',
                    order.id
                );

            await openChat(chat.id);
            setShowChatWindow(true);
            success('Chat abierto');
        } catch (error) {
            logger.error('Error opening chat:', error);
            showError('Error al abrir el chat');
        } finally {
            setChatLoadingOrderId(null);
        }
    };

    const handleReorder = (order: Order) => {
        // Solo re-añadir productos con ID real en Firestore para evitar crash en createOrder
        const validProducts = order.products.filter(p => !!p.productId);

        if (validProducts.length === 0) {
            // Sin IDs reales no podemos verificar disponibilidad — llevar al venue
            navigate(`/app/venue/${order.venueId}`);
            success('Te llevamos al restaurante para elegir productos frescos 🛍️');
            return;
        }

        validProducts.forEach(product => {
            const cartProduct: Product = {
                id: product.productId!,
                venueId: order.venueId,
                name: product.name,
                type: ProductType.SURPRISE_PACK,
                originalPrice: product.originalPrice,
                discountedPrice: product.discountedPrice ?? product.price,
                quantity: 1,
                imageUrl: product.imageUrl || product.image || '',
                availableUntil: '', // El servidor valida disponibilidad real al pagar
                isDynamicPricing: false,
            };
            addToCart(cartProduct, order.metadata?.venueName);
        });
        success('Productos agregados. Verifica disponibilidad antes de pagar 🛒');
        navigate('/app/cart');
    };

    const handleConfirmReceived = async (order: Order) => {
        if (!order?.id) return;
        try {
            setConfirmingOrderId(order.id);
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, {
                status: OrderStatus.COMPLETED,
                receivedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            success(t('orders_received_success'));
        } catch (error) {
            logger.error('Error confirming received order:', error);
            showError(t('orders_received_error'));
        } finally {
            setConfirmingOrderId(null);
        }
    };

    const handleCancelOrder = async (orderId: string) => {
        try {
            const cancelOrderByClient = httpsCallable(functions, 'cancelOrderByClient');
            await cancelOrderByClient({ orderId });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.CANCELLED, cancellationReason: 'CLIENT_CANCELLED' } : o));
            success('Pedido cancelado');
        } catch (error: any) {
            logger.error('Error cancelling order:', error);
            showError(error?.message || 'No se pudo cancelar el pedido');
        }
    };

    const handleConfirmDelivery = async (orderId: string) => {
        try {
            setConfirmingOrderId(orderId);
            const confirmDelivery = httpsCallable(functions, 'confirmDelivery');
            await confirmDelivery({ orderId });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.COMPLETED, awaitingClientConfirmation: false } : o));
            success('¡Entrega confirmada!');
        } catch (error: any) {
            logger.error('Error confirming delivery:', error);
            showError(error?.message || 'Error al confirmar entrega');
        } finally {
            setConfirmingOrderId(null);
        }
    };

    const handleDisputeDelivery = async (orderId: string) => {
        try {
            const disputeDelivery = httpsCallable(functions, 'disputeDelivery');
            await disputeDelivery({ orderId });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.DISPUTED, awaitingClientConfirmation: false } : o));
            success('Disputa abierta. Te contactaremos pronto.');
        } catch (error: any) {
            logger.error('Error disputing delivery:', error);
            showError(error?.message || 'Error al abrir disputa');
        }
    };

    const getStatusBadge = (status: OrderStatus, order?: Order) => {
        if (status === OrderStatus.IN_TRANSIT && order?.awaitingClientConfirmation) {
            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                    <AlertTriangle size={14} />
                    Confirmar entrega
                </span>
            );
        }

        const badges: Record<string, { color: string; icon: React.ElementType; label: string }> = {
            [OrderStatus.PENDING]: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: t('status_pending') },
            [OrderStatus.PAID]: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: t('status_paid') },
            [OrderStatus.ACCEPTED]: { color: 'bg-sky-100 text-sky-800', icon: CheckCircle, label: 'Aceptado' },
            [OrderStatus.IN_PREPARATION]: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t('status_prep') },
            [OrderStatus.READY]: { color: 'bg-purple-100 text-purple-800', icon: Package, label: t('status_ready') },
            [OrderStatus.AWAITING_DRIVER]: { color: 'bg-orange-100 text-orange-800', icon: Truck, label: 'Buscando domiciliario' },
            [OrderStatus.DRIVER_ASSIGNED]: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: 'Domiciliario asignado' },
            [OrderStatus.IN_TRANSIT]: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: t('status_transit') },
            [OrderStatus.COMPLETED]: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: t('status_completed') },
            [OrderStatus.CANCELLED]: { color: 'bg-red-100 text-red-800', icon: Ban, label: 'Cancelado' },
            [OrderStatus.MISSED]: { color: 'bg-red-100 text-red-800', icon: XCircle, label: t('status_missed') },
            [OrderStatus.DISPUTED]: { color: 'bg-purple-100 text-purple-800', icon: AlertTriangle, label: 'En disputa' },
        };

        const badge = badges[status] ?? { color: 'bg-gray-100 text-gray-700', icon: Clock, label: status };
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <Icon size={14} />
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return <LoadingSpinner fullPage />;
    }

    const unratedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED && !o.rated);

    return (
        <div className="min-h-screen bg-gray-50 pb-nav overflow-x-hidden">
            {/* Header */}
            <header className="bg-white sticky top-0 pt-safe-top z-40 shadow-sm border-b border-gray-100">
                <div className="px-4 py-3 flex items-center justify-between max-w-4xl mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/app')}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Package size={20} className="text-emerald-500" />
                            <h1 className="text-lg font-bold text-gray-900">{t('orders_title')}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        {t('orders_live')}
                    </div>
                </div>
            </header>

            <main className="p-4 sm:p-6 max-w-4xl mx-auto">
                {orderIdParam && (
                    <div className="mb-6 space-y-3 animate-fadeIn">
                        <GuestConversionBanner context="post-order" />
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center flex-wrap gap-4">
                            <div className="flex items-center gap-3 text-emerald-800">
                                <div className="bg-emerald-200 p-2 rounded-full"><Package size={20} /></div>
                                <div>
                                    <p className="font-bold">{t('orders_booked')}</p>
                                    <p className="text-sm opacity-80">{t('order_id')} {orderIdParam}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const newParams = new URLSearchParams(searchParams);
                                    newParams.delete('orderId');
                                    navigate({ search: newParams.toString() }, { replace: true });
                                }}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 underline"
                            >
                                {t('orders_view_all')}
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                try {
                                    if (navigator.share) {
                                        await navigator.share({
                                            title: '¡He rescatado comida con Rescatto!',
                                            text: 'Acabo de salvar comida deliciosa de ser desperdiciada y ahorré dinero. ¡Únete a la lucha contra el desperdicio en Rescatto!',
                                            url: window.location.origin
                                        });
                                    } else {
                                        await navigator.clipboard.writeText(`¡Acabo de salvar comida deliciosa con Rescatto! Únete a la lucha contra el desperdicio: ${window.location.origin}`);
                                        success('¡Mensaje copiado al portapapeles!');
                                    }
                                } catch (err) {
                                    logger.log('Share canceled or failed', err);
                                }
                            }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
                        >
                            <Share2 size={20} />
                            {t('orders_share')}
                        </button>
                    </div>
                )}

                {/* Smart Rating Banner (Zero Friction UX) */}
                {!orderIdParam && unratedOrders.length > 0 && (
                    <div className="mb-6 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                        <div className="absolute -right-4 -top-4 text-white/20">
                            <Star size={100} className="fill-current rotate-12" />
                        </div>
                        <div className="relative z-10 text-white">
                            <h3 className="text-xl font-black mb-1 flex items-center gap-2">
                                <Star size={24} className="fill-current text-white" />
                                {t('orders_rating_title')}
                            </h3>
                            <p className="font-medium text-amber-900 text-sm">
                                {t('orders_rating_desc', { count: unratedOrders.length })}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setRatingOrder(unratedOrders[0]);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full sm:w-auto relative z-10 bg-white text-amber-600 hover:bg-amber-50 px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 whitespace-nowrap ring-4 ring-white/20"
                        >
                            {t('orders_rate_now')}
                        </button>
                    </div>
                )}

                {orders.length === 0 && !orderIdParam ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="relative mb-6">
                            <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center">
                                <Package size={52} className="text-emerald-400" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                <Sparkles size={16} className="text-white" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">{t('orders_first_mission')}</h2>
                        <p className="text-gray-500 text-sm max-w-xs mb-1">
                            {t('orders_first_mission_desc')}
                        </p>
                        <p className="text-emerald-600 text-xs font-semibold mb-8">
                            {t('orders_streak_starts')}
                        </p>
                        <button
                            onClick={() => navigate('/app')}
                            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-600/30"
                        >
                            {t('cart_view_deals')}
                        </button>
                        <button
                            onClick={() => navigate('/app/impact')}
                            className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {t('orders_what_is_impact')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders
                            .filter(o => !orderIdParam || o.id === orderIdParam)
                            .map(order => (
                                <div
                                    key={order.id}
                                    ref={order.id === highlightParam ? highlightRef : null}
                                    className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-500 ${order.id === highlightParam ? 'border-emerald-400 ring-2 ring-emerald-300 shadow-emerald-100' : 'border-gray-100'}`}
                                >
                                    {/* Mapa de Seguimiento (Logística Fase 3) */}
                                    {(order.status === OrderStatus.DRIVER_ASSIGNED || order.status === OrderStatus.IN_TRANSIT) && (
                                        <TrackingOrderMap order={order} />
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            {order.metadata?.venueName && (
                                                <button
                                                    onClick={() => navigate(`/app/venue/${order.venueId}`)}
                                                    className="flex items-center gap-1.5 mb-1 group"
                                                >
                                                    <span className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-tight">
                                                        {order.metadata.venueName}
                                                    </span>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                                    </svg>
                                                </button>
                                            )}
                                            <p className="text-xs text-gray-400">
                                                #{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleDateString(i18n.language, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        {getStatusBadge(order.status, order)}
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 mb-4">
                                        <p className="text-sm font-semibold text-gray-600 mb-2">{t('orders_products')}</p>
                                        <div className="space-y-1">
                                            {order.products.map((product, idx) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="text-gray-700">
                                                        {product.quantity}x {product.name}
                                                    </span>
                                                    <span className="font-semibold">
                                                        {formatCOP((product.price || product.originalPrice) * product.quantity)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 pb-4 space-y-2">
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>{t('cart_subtotal')}</span>
                                            <span>{formatCOP(order.subtotal || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>{t('cart_delivery')}</span>
                                            <span>{formatCOP(order.deliveryFee || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                            <div className="text-sm text-gray-600">
                                                <p><strong>{t('orders_address')}</strong> {order.deliveryAddress}</p>
                                                <p><strong>{t('orders_phone')}</strong> {order.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500">{t('cart_total')}</p>
                                                <p className="text-2xl font-bold text-emerald-600">
                                                    {formatCOP(order.totalAmount)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Banner de confirmación de entrega por domiciliario */}
                                    {order.awaitingClientConfirmation && (
                                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                                            <AlertTriangle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                                            <p className="text-sm text-yellow-800 font-medium">
                                                El domiciliario marcó el pedido como entregado. ¿Lo recibiste?
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                                        {/* Cancelar — solo cuando está PENDING */}
                                        {order.status === OrderStatus.PENDING && (
                                            <button
                                                onClick={() => handleCancelOrder(order.id)}
                                                className="flex-1 px-4 py-3 bg-red-50 text-red-700 border border-red-100 rounded-xl hover:bg-red-100 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                                            >
                                                <Ban size={18} />
                                                Cancelar pedido
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleChatWithVenue(order)}
                                            disabled={chatLoadingOrderId === order.id}
                                            className="flex-1 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {chatLoadingOrderId === order.id
                                                ? <span className="animate-spin text-base">⏳</span>
                                                : <MessageSquare size={18} />
                                            }
                                            {t('orders_btn_venue_chat')}
                                        </button>

                                        {order.driverId && (
                                            <button
                                                onClick={() => handleChatWithDriver(order)}
                                                disabled={chatLoadingOrderId === order.id}
                                                className="flex-1 px-4 py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {chatLoadingOrderId === order.id
                                                    ? <span className="animate-spin text-base">⏳</span>
                                                    : <MessageSquare size={18} />
                                                }
                                                {t('orders_btn_driver_chat')}
                                            </button>
                                        )}

                                        {/* Confirmar recogida en local (pickup) */}
                                        {order.status === OrderStatus.READY && order.deliveryMethod !== 'delivery' && (
                                            <button
                                                onClick={() => handleConfirmReceived(order)}
                                                disabled={confirmingOrderId === order.id}
                                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {confirmingOrderId === order.id
                                                    ? <span className="animate-spin text-base">⏳</span>
                                                    : <CheckCircle size={18} />
                                                }
                                                {t('orders_received_confirm')}
                                            </button>
                                        )}

                                        {/* Confirmar / disputar entrega domiciliaria */}
                                        {order.awaitingClientConfirmation && (
                                            <>
                                                <button
                                                    onClick={() => handleConfirmDelivery(order.id)}
                                                    disabled={confirmingOrderId === order.id}
                                                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {confirmingOrderId === order.id
                                                        ? <span className="animate-spin text-base">⏳</span>
                                                        : <CheckCircle size={18} />
                                                    }
                                                    Sí, lo recibí
                                                </button>
                                                <button
                                                    onClick={() => handleDisputeDelivery(order.id)}
                                                    className="flex-1 px-4 py-3 bg-red-50 text-red-700 border border-red-100 rounded-xl hover:bg-red-100 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                                                >
                                                    <AlertTriangle size={18} />
                                                    No lo recibí
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Botón de Calificación para Pedidos Completados */}
                                    {order.status === OrderStatus.COMPLETED && !order.rated && (
                                        <div className="pt-3">
                                            <button
                                                onClick={() => setRatingOrder(order)}
                                                className="w-full px-4 py-3.5 bg-yellow-400 text-yellow-900 rounded-xl hover:bg-yellow-500 shadow-md active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 font-bold text-sm"
                                            >
                                                <Star size={18} className="fill-current" />
                                                {t('orders_rate_exp')}
                                            </button>
                                        </div>
                                    )}

                                    {order.rated && order.status === OrderStatus.COMPLETED && (
                                        <div className="pt-3">
                                            <div className="w-full px-4 py-3 bg-green-50 text-green-700 border border-green-100 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-sm">
                                                <CheckCircle size={18} />
                                                {t('orders_already_rated')}
                                            </div>
                                        </div>
                                    )}

                                    {/* Reorder — available for completed or missed orders */}
                                    {(order.status === OrderStatus.COMPLETED || order.status === OrderStatus.MISSED) && (
                                        <div className="pt-3">
                                            <button
                                                onClick={() => handleReorder(order)}
                                                className="w-full px-4 py-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                                            >
                                                <ShoppingCart size={18} />
                                                {t('orders_reorder')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        {/* Skeleton mientras el nuevo pedido llega vía onSnapshot */}
                        {orderIdParam && !orders.some(o => o.id === orderIdParam) && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-emerald-100">
                                <div className="flex justify-between items-start mb-4 animate-pulse">
                                    <div className="space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-36" />
                                        <div className="h-3 bg-gray-200 rounded w-28" />
                                    </div>
                                    <div className="h-7 bg-emerald-100 rounded-full w-28" />
                                </div>
                                <div className="space-y-2 border-t pt-4 animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                </div>
                                <div className="flex items-center gap-2.5 mt-4 pt-4 border-t text-emerald-600">
                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                    <p className="text-sm font-semibold">{t('orders_confirming')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal de Calificación */}
            {ratingOrder && (
                <RatingModal
                    order={ratingOrder}
                    onClose={() => setRatingOrder(null)}
                    onSuccess={() => {
                        // onSnapshot actualiza automáticamente; solo cerramos el modal
                        setRatingOrder(null);
                    }}
                />
            )}

            {/* Modal de Ventana de Chat */}
            {showChatWindow && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowChatWindow(false)}
                >
                    <div
                        className="w-full max-w-2xl h-[min(70vh,600px)] mx-3 sm:mx-4 rounded-2xl overflow-hidden shadow-2xl cursor-default pb-[env(safe-area-inset-bottom)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ChatWindow 
                            onClose={() => setShowChatWindow(false)} 
                            showBackButton={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Helper component to handle driver location subscription for a single order
 */
const TrackingOrderMap: React.FC<{ order: Order }> = ({ order }) => {
    const [driverLoc, setDriverLoc] = useState<{ lat: number, lng: number } | undefined>();
    const [venueLoc, setVenueLoc] = useState<{ lat: number, lng: number } | undefined>();

    useEffect(() => {
        if (!order.driverId) return;
        
        // Listener para ubicación del driver
        const unsubDriver = onSnapshot(doc(db, 'users', order.driverId), (snap) => {
            const data = snap.data();
            if (data?.lastLocation) {
                setDriverLoc({
                    lat: data.lastLocation.latitude,
                    lng: data.lastLocation.longitude
                });
            }
        });

        // Obtener ubicación del venue (una vez es suficiente)
        getDoc(doc(db, 'venues', order.venueId)).then(snap => {
            const data = snap.data();
            if (data?.latitude && data?.longitude) {
                setVenueLoc({ lat: data.latitude, lng: data.longitude });
            }
        });

        return () => unsubDriver();
    }, [order.driverId, order.venueId]);

    // Coordenadas de destino del cliente (si están en el pedido)
    const destLoc = (order as any).customerLat && (order as any).customerLng 
        ? { lat: (order as any).customerLat, lng: (order as any).customerLng }
        : undefined;

    return (
        <TrackingMap 
            orderStatus={order.status}
            driverCoords={driverLoc}
            venueCoords={venueLoc}
            destinationCoords={destLoc}
        />
    );
};

export default MyOrders;
