import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderStatus, Venue, UserRole, Product, ProductType } from '../../types';
import { useCart } from '../../context/CartContext';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Sparkles } from 'lucide-react';
import { Package, Clock, CheckCircle, XCircle, Truck, MessageSquare, Star, ArrowLeft, ShoppingCart, Share2 } from 'lucide-react';
import { RatingModal } from '../../components/rating/RatingModal';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { logger } from '../../utils/logger';
import { GuestConversionBanner } from '../../components/customer/common/GuestConversionBanner';
import { formatCOP } from '../../utils/formatters';

export const MyOrders: React.FC = () => {
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
    const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
    const [showChatWindow, setShowChatWindow] = useState(false);
    const [chatLoadingOrderId, setChatLoadingOrderId] = useState<string | null>(null);
    const highlightRef = useRef<HTMLDivElement | null>(null);

    // Scroll a la orden destacada cuando se navega desde una notificación FCM
    useEffect(() => {
        if (!highlightParam || loading || orders.length === 0) return;
        if (highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightParam, loading, orders.length]);

    // Suscripción en tiempo real — los pedidos se actualizan automáticamente
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const q = query(
            collection(db, 'orders'),
            where('customerId', '==', user.id),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const ordersData = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                })) as Order[];
                setOrders(ordersData);
                setLoading(false);
            },
            (error) => {
                logger.error('Error en suscripción de pedidos:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.id]);

    const findExistingOrderChatId = async (orderId: string, type: string): Promise<string | null> => {
        const chatsSnapshot = await getDocs(query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user?.id || ''),
            limit(100)
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

            const metadata = (order.metadata || {}) as Record<string, any>;
            let venueContactUserId: string | null =
                metadata.venueOwnerId ||
                metadata.venueContactUserId ||
                null;
            let venueContactName: string =
                metadata.venueName ||
                metadata.venueDisplayName ||
                'Restaurante';

            // Prioridad 2: resolver por backend (fuente de verdad basada en la orden).
            if (!venueContactUserId) {
                try {
                    const resolveVenueChatTarget = httpsCallable(functions, 'resolveVenueChatTarget');
                    const targetResult: any = await resolveVenueChatTarget({ orderId: order.id });
                    venueContactUserId = targetResult?.data?.userId || null;
                    venueContactName = targetResult?.data?.userName || venueContactName;
                } catch (resolveErr) {
                    logger.warn('No se pudo resolver el contacto de chat del restaurante:', resolveErr);
                }
            }

            // Prioridad 3: fallback a documento de sede cuando existe.
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

            if (!venueContactUserId || typeof venueContactUserId !== 'string') {
                showError('Este pedido aún no tiene un contacto de chat disponible.');
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

    const getStatusBadge = (status: OrderStatus) => {
        const badges: Record<string, { color: string; icon: React.ElementType; label: string }> = {
            [OrderStatus.PENDING]: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
            [OrderStatus.PAID]: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Pagado' },
            [OrderStatus.IN_PREPARATION]: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: 'En Preparación' },
            [OrderStatus.READY_PICKUP]: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'Listo para Recoger' },
            [OrderStatus.DRIVER_ACCEPTED]: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: 'Conductor Asignado' },
            [OrderStatus.IN_TRANSIT]: { color: 'bg-indigo-100 text-indigo-800', icon: Truck, label: 'En Camino' },
            [OrderStatus.COMPLETED]: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completado' },
            [OrderStatus.MISSED]: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Perdido' },
            [OrderStatus.DISPUTED]: { color: 'bg-purple-100 text-purple-800', icon: XCircle, label: 'Disputado' },
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
        <div className="min-h-screen bg-gray-50 p-6 overflow-x-hidden">
            <div className="max-w-4xl mx-auto">
                {/* Botón de Volver */}
                <button
                    onClick={() => navigate('/app')}
                    className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 mb-4 transition-colors group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Volver a Explorar</span>
                </button>

                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Package className="text-emerald-600" />
                        Mis Pedidos
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        En vivo
                    </div>
                </div>

                {orderIdParam && (
                    <div className="mb-6 space-y-3 animate-fadeIn">
                        <GuestConversionBanner context="post-order" />
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center flex-wrap gap-4">
                            <div className="flex items-center gap-3 text-emerald-800">
                                <div className="bg-emerald-200 p-2 rounded-full"><Package size={20} /></div>
                                <div>
                                    <p className="font-bold">¡Pedido reservado con éxito!</p>
                                    <p className="text-sm opacity-80">Pedido ID: {orderIdParam}</p>
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
                                Ver todos mis pedidos
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
                            ¡Comparte tu rescate y ayúdanos a llevar el mensaje! 🌍
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
                                ¡Tienes reseñas pendientes!
                            </h3>
                            <p className="font-medium text-amber-900 text-sm">
                                Cuéntanos sobre tu rescate y gana puntos extra en {unratedOrders.length} pedido(s).
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setRatingOrder(unratedOrders[0]);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full sm:w-auto relative z-10 bg-white text-amber-600 hover:bg-amber-50 px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 whitespace-nowrap ring-4 ring-white/20"
                        >
                            Calificar Ahora
                        </button>
                    </div>
                )}

                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="relative mb-6">
                            <div className="w-28 h-28 bg-emerald-50 rounded-full flex items-center justify-center">
                                <Package size={52} className="text-emerald-400" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                <Sparkles size={16} className="text-white" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">¡Tu primera misión te espera!</h2>
                        <p className="text-gray-500 text-sm max-w-xs mb-1">
                            Cada pedido rescata comida del desperdicio y te gana puntos de impacto.
                        </p>
                        <p className="text-emerald-600 text-xs font-semibold mb-8">
                            🌱 Tu racha de rescates empieza hoy
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
                            ¿Qué es el impacto?
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
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Pedido #{order.id.slice(0, 8)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(order.createdAt).toLocaleDateString('es-CO', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 mb-4">
                                        <p className="text-sm font-semibold text-gray-600 mb-2">Productos:</p>
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
                                            <span>Subtotal</span>
                                            <span>{formatCOP(order.subtotal || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-600">
                                            <span>Domicilio</span>
                                            <span>{formatCOP(order.deliveryFee || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                            <div className="text-sm text-gray-600">
                                                <p><strong>Dirección:</strong> {order.deliveryAddress}</p>
                                                <p><strong>Teléfono:</strong> {order.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500">Total</p>
                                                <p className="text-2xl font-bold text-emerald-600">
                                                    {formatCOP(order.totalAmount)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                                        <button
                                            onClick={() => handleChatWithVenue(order)}
                                            disabled={chatLoadingOrderId === order.id}
                                            className="flex-1 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 shadow-sm active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {chatLoadingOrderId === order.id
                                                ? <span className="animate-spin text-base">⏳</span>
                                                : <MessageSquare size={18} />
                                            }
                                            Chat Restaurante
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
                                                Chat Conductor
                                            </button>
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
                                                ¡Califica tu Experiencia!
                                            </button>
                                        </div>
                                    )}

                                    {order.rated && order.status === OrderStatus.COMPLETED && (
                                        <div className="pt-3">
                                            <div className="w-full px-4 py-3 bg-green-50 text-green-700 border border-green-100 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-sm">
                                                <CheckCircle size={18} />
                                                Ya calificaste este pedido
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
                                                Pedir de Nuevo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

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
                        className="w-full max-w-2xl h-[min(78vh,600px)] mx-3 sm:mx-4 rounded-2xl overflow-hidden shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ChatWindow onClose={() => setShowChatWindow(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyOrders;
