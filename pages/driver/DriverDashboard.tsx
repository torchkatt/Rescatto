import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { OrderStatus, Venue, UserRole } from '../../types';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Truck, MapPin, Phone, Package, DollarSign, Star, Award, LogOut, Search, Filter, X, SlidersHorizontal, ArrowUpDown, PhoneCall, Navigation, MessageSquare } from 'lucide-react';
import { getRatingStats } from '../../services/ratingService';
import { RatingDisplay } from '../../components/rating/RatingDisplay';
import { RatingStats } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { logger } from '../../utils/logger';


interface DeliveryOrder {
    id: string;
    customerName: string;
    venueId: string;
    deliveryAddress: string;
    phone: string;
    totalAmount: number;
    deliveryFee?: number;
    status: OrderStatus;
    createdAt: string;
    customerId: string;
    venueName?: string;
    venueAddress?: string;
    venuePhone?: string;
    products: Array<{
        name: string;
        quantity: number;
    }>;
}

interface VenueCache {
    [id: string]: Venue;
}

export const DriverDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { createChat, openChat } = useChat();
    const { showToast } = useToast();
    const { sendNotification } = useNotifications();
    const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
    const [myDeliveries, setMyDeliveries] = useState<DeliveryOrder[]>([]);
    const [completedOrders, setCompletedOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'available' | 'mine'>('available');
    const [driverStats, setDriverStats] = useState<RatingStats | null>(null);
    const [venueCache, setVenueCache] = useState<VenueCache>({});
    const [gpsError, setGpsError] = useState<string | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'amount'>('recent');
    const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus.DRIVER_ACCEPTED | OrderStatus.IN_TRANSIT>('all');

    useEffect(() => {
        if (!user || user.role !== UserRole.DRIVER) return;

        // Subscribe to available orders
        const unsubscribeAvailable = dataService.subscribeToAvailableOrders((orders) => {
            setAvailableOrders(orders as DeliveryOrder[]);
            setLoading(false);
        });

        let unsubscribeMyDeliveries: () => void;

        if (user?.id) {
            getRatingStats(user.id, 'user').then(stats => {
                setDriverStats(stats);
            });

            // Subscribe to my deliveries (activas + históricas para stats)
            unsubscribeMyDeliveries = dataService.subscribeToDriverDeliveries(user.id, (orders) => {
                const active = orders.filter(o =>
                    o.status === OrderStatus.DRIVER_ACCEPTED ||
                    o.status === OrderStatus.IN_TRANSIT
                );
                const completed = orders.filter(o => o.status === OrderStatus.COMPLETED);
                setMyDeliveries(active as DeliveryOrder[]);
                setCompletedOrders(completed as DeliveryOrder[]);
            });
        }

        // Location Check
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => setGpsError(null),
                (err) => {
                    if (err.code === 1) setGpsError("Permiso de ubicación denegado. Revisa tu configuración.");
                    else setGpsError("Ubicación no disponible en este momento.");
                }
            );
        }

        return () => {
            unsubscribeAvailable();
            if (unsubscribeMyDeliveries) unsubscribeMyDeliveries();
        };
    }, [user]);

    const handleAcceptOrder = async (orderId: string) => {
        if (!user?.id) {
            showToast('error', 'Error: Usuario no autenticado');
            return;
        }

        try {
            const orderRef = doc(db, 'orders', orderId);

            // Transacción atómica: verifica que el pedido aún esté sin driver antes de asignarlo
            // Esto previene la condición de carrera donde dos drivers intentan el mismo pedido
            const { runTransaction } = await import('firebase/firestore');
            await runTransaction(db, async (transaction) => {
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists()) {
                    throw new Error('El pedido ya no existe.');
                }

                const orderData = orderSnap.data();
                // Si ya tiene un driverId, alguien se adelantó
                if (orderData.driverId) {
                    throw new Error('Este pedido ya fue tomado por otro repartidor.');
                }
                // Si el estado ya cambió a algo más allá de READY_PICKUP/PAID, no aplica
                const pickupableStatuses = [OrderStatus.READY_PICKUP, OrderStatus.PAID, OrderStatus.IN_PREPARATION];
                if (!pickupableStatuses.includes(orderData.status)) {
                    throw new Error('Este pedido ya no está disponible para entrega.');
                }

                transaction.update(orderRef, {
                    driverId: user.id,
                    driverName: user.fullName,
                    status: OrderStatus.DRIVER_ACCEPTED,
                    acceptedAt: new Date().toISOString()
                });
            });

            showToast('success', '¡Pedido aceptado! Ve al restaurante. 🛵');

            const order = availableOrders.find(o => o.id === orderId);
            if (order) {
                await sendNotification(
                    order.customerId,
                    '🛵 Repartidor Asignado',
                    `${user.fullName} ha aceptado tu pedido y va camino al restaurante.`,
                    'info'
                );
            }

            setView('mine');
        } catch (error: any) {
            logger.error('Error accepting order:', error);
            // Mensaje específico para errores de concurrencia vs errores genéricos
            const isRaceCondition = error?.message?.includes('ya fue tomado') || error?.message?.includes('ya no está disponible');
            showToast('error', isRaceCondition
                ? error.message
                : 'Error al aceptar pedido. Intenta de nuevo.'
            );
        }
    };

    const handleConfirmPickup = async (orderId: string) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                status: OrderStatus.IN_TRANSIT
            });
            showToast('success', 'Pedido recogido. ¡Buen viaje!');

            const order = myDeliveries.find(o => o.id === orderId);
            if (order) {
                await sendNotification(order.customerId, '🚀 Pedido en Camino', `Tu pedido ya fue recogido y va hacia tu dirección.`, 'info');
            }
        } catch (error) {
            logger.error('Error confirming pickup:', error);
            showToast('error', 'Error al actualizar estado.');
        }
    };

    const handleConfirmDelivery = async (orderId: string) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                status: OrderStatus.COMPLETED,
                deliveredAt: new Date().toISOString()
            });
            showToast('success', '¡Pedido entregado con éxito!');

            const order = myDeliveries.find(o => o.id === orderId);
            if (order) {
                await sendNotification(order.customerId, '🎉 Pedido Entregado', `¡Buen provecho! Tu pedido ha sido entregado.`, 'success');
            }
        } catch (error) {
            logger.error('Error confirming delivery:', error);
            showToast('error', 'Error al finalizar entrega.');
        }
    };

    const openGoogleMaps = (address: string) => {
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    };

    const handleCall = (phoneNumber: string) => {
        window.location.href = `tel:${phoneNumber}`;
    };

    const handleChatWithVenue = async (order: DeliveryOrder) => {
        try {
            const venue = venueCache[order.venueId];
            if (!venue) {
                showToast('error', 'No se pudo encontrar el restaurante');
                return;
            }

            // Buscar al dueño del restaurante
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('venueId', '==', order.venueId),
                where('role', '==', UserRole.VENUE_OWNER)
            );

            const venueOwnerSnapshot = await getDocs(q);
            const venueOwner = venueOwnerSnapshot.empty ? null : { id: venueOwnerSnapshot.docs[0].id, ...venueOwnerSnapshot.docs[0].data() };

            const chat = await createChat(
                venueOwner?.id || order.venueId, // Fallback a venueId si no hay dueño real
                venue.name,
                UserRole.VENUE_OWNER,
                'venue-driver',
                order.id
            );

            await openChat(chat.id);
            navigate('/chat');
        } catch (error) {
            logger.error('Error opening venue chat:', error);
            showToast('error', 'Error al abrir el chat con el restaurante');
        }
    };

    const handleChatWithCustomer = async (order: DeliveryOrder) => {
        try {
            // No necesitamos obtener el documento del usuario (que puede dar error de permisos)
            // ya que tenemos el customerId y customerName en el pedido.
            const chat = await createChat(
                order.customerId,
                order.customerName || 'Cliente',
                UserRole.CUSTOMER,
                'customer-driver',
                order.id
            );

            await openChat(chat.id);
            navigate('/chat');
        } catch (error) {
            logger.error('Error opening customer chat:', error);
            showToast('error', 'Error al abrir el chat con el cliente');
        }
    };

    const getVenueInfo = async (venueId: string) => {
        if (venueCache[venueId]) return venueCache[venueId];
        const venue = await dataService.getVenue(venueId);
        if (venue) {
            setVenueCache(prev => ({ ...prev, [venueId]: venue }));
            return venue;
        }
        return null;
    };

    // ─── Computed earnings stats ───────────────────────────────────────────────
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthName = now.toLocaleDateString('es-CO', { month: 'long' });

    /** Suma de deliveryFee de ordenes COMPLETED del mes actual */
    const earningsThisMonth = completedOrders
        .filter(o => {
            const d = new Date(o.createdAt);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum, o) => {
            // El driver gana la deliveryFee — fallback a 0 si no está disponible
            const fee = (o as any).deliveryFee ?? 0;
            return sum + fee;
        }, 0);

    /** Total histórico de todos los pedidos completados */
    const totalEarningsAllTime = completedOrders.reduce((sum, o) => {
        return sum + ((o as any).deliveryFee ?? 0);
    }, 0);

    const formatCOP = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    const filterAndSortOrders = (orders: DeliveryOrder[]) => {
        return orders
            .filter(order => {
                const venue = venueCache[order.venueId];
                const matchesSearch =
                    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (venue?.name && venue.name.toLowerCase().includes(searchQuery.toLowerCase()));

                const matchesStatus = view === 'available' || statusFilter === 'all' || order.status === statusFilter;

                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => {
                if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    };

    const filteredAvailable = filterAndSortOrders(availableOrders);
    const filteredMine = filterAndSortOrders(myDeliveries);

    const OrderCard: React.FC<{ order: DeliveryOrder; isMyDelivery?: boolean }> = ({ order, isMyDelivery }) => {
        const [venue, setVenue] = useState<Venue | null>(venueCache[order.venueId] || null);

        useEffect(() => {
            if (!venue) {
                getVenueInfo(order.venueId).then(setVenue);
            }
        }, [order.venueId]);

        return (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-lg transition-all duration-300">
                <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                            Pedido #{order.id.slice(-6)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${order.status === OrderStatus.READY_PICKUP ? 'bg-orange-100 text-orange-600' :
                            order.status === OrderStatus.PAID ? 'bg-blue-100 text-blue-600' :
                                order.status === OrderStatus.IN_PREPARATION ? 'bg-amber-100 text-amber-600' :
                                    order.status === OrderStatus.DRIVER_ACCEPTED ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-emerald-100 text-emerald-600'
                            }`}>
                            {order.status === OrderStatus.READY_PICKUP ? 'Listo para Recoger' :
                                order.status === OrderStatus.PAID ? 'Pagado (Nuevo)' :
                                    order.status === OrderStatus.IN_PREPARATION ? 'En Preparación' :
                                        order.status === OrderStatus.DRIVER_ACCEPTED ? 'Aceptado' :
                                            'En Tránsito'}
                        </span>
                    </div>
                    <h3 className="font-extrabold text-lg text-gray-800 leading-tight">
                        {order.customerName}
                    </h3>
                </div>

                <div className="p-5 flex-1 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase">
                            <Package size={14} className="flex-shrink-0" /> Restaurante
                        </div>
                        <p className="font-bold text-gray-700">{venue?.name || 'Cargando restaurante...'}</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => venue && openGoogleMaps(venue.address)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-95 border border-transparent hover:border-emerald-100"
                            >
                                <Navigation size={14} /> Cómo llegar
                            </button>
                            <button
                                onClick={() => venue && handleCall(venue.phone || 'N/A')}
                                className="p-2.5 aspect-square bg-gray-50 text-gray-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-90 border border-transparent hover:border-blue-100"
                            >
                                <PhoneCall size={18} />
                            </button>
                            <button
                                onClick={() => handleChatWithVenue(order)}
                                className="p-2.5 aspect-square bg-gray-50 text-blue-600 rounded-xl hover:bg-blue-50 transition-all active:scale-90 border border-transparent hover:border-blue-100"
                                title="Chat con Restaurante"
                            >
                                <MessageSquare size={18} />
                            </button>
                        </div>
                    </div>

                    <hr className="border-gray-50" />

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase">
                            <MapPin size={14} className="flex-shrink-0" /> Cliente
                        </div>
                        <p className="text-sm font-medium text-gray-600">{order.deliveryAddress}</p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => openGoogleMaps(order.deliveryAddress)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-95 border border-transparent hover:border-emerald-100"
                            >
                                <Navigation size={14} /> Cómo llegar
                            </button>
                            <button
                                onClick={() => handleCall(order.phone)}
                                className="p-2.5 aspect-square bg-gray-50 text-gray-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-90 border border-transparent hover:border-blue-100"
                            >
                                <PhoneCall size={18} />
                            </button>
                            <button
                                onClick={() => handleChatWithCustomer(order)}
                                className="p-2.5 aspect-square bg-gray-50 text-blue-600 rounded-xl hover:bg-blue-50 transition-all active:scale-90 border border-transparent hover:border-blue-100"
                                title="Chat con Cliente"
                            >
                                <MessageSquare size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-50">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Tu Ganancia</p>
                                <p className="text-xl font-black text-emerald-600">
                                    ${order.deliveryFee ? order.deliveryFee.toFixed(2) : '0.00'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Valor Pedido</p>
                                <p className="text-xl font-black text-gray-700">
                                    ${order.totalAmount.toFixed(2)}
                                </p>
                            </div>
                            <div className="text-right hidden lg:block">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Artículos</p>
                                <p className="text-sm font-bold text-gray-600">
                                    {order.products.reduce((acc, p) => acc + p.quantity, 0)} items
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gray-50/50">
                    {!isMyDelivery ? (
                        <button
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-emerald-100"
                        >
                            Aceptar Entrega
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {order.status === OrderStatus.DRIVER_ACCEPTED && (
                                <button
                                    onClick={() => handleConfirmPickup(order.id)}
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-blue-100"
                                >
                                    Ya recogí el pedido
                                </button>
                            )}
                            {order.status === OrderStatus.IN_TRANSIT && (
                                <button
                                    onClick={() => handleConfirmDelivery(order.id)}
                                    className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-emerald-100"
                                >
                                    Confirmar Entrega
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-800 flex items-center gap-3">
                        <Truck className="text-emerald-600" size={32} />
                        Rescatto Driver
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">Panel de control de {user?.fullName}</p>
                </div>
                <button
                    onClick={logout}
                    className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Cerrar Sesión"
                >
                    <LogOut size={24} />
                </button>
            </div>

            {/* GPS Error Alert */}
            {gpsError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700 text-sm font-bold animate-pulse">
                    <MapPin size={20} />
                    {gpsError}
                </div>
            )}

            {/* View Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setView('available')}
                    className={`flex-1 md:flex-none px-6 py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all ${view === 'available'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                        : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                        }`}
                >
                    Disponibles ({availableOrders.length})
                </button>
                <button
                    onClick={() => setView('mine')}
                    className={`flex-1 md:flex-none px-6 py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all ${view === 'mine'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                        : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                        }`}
                >
                    Mis Entregas ({myDeliveries.length})
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por ID, cliente o restaurante..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium transition-all text-base outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 active:scale-90"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full md:w-48 pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-gray-700 appearance-none transition-all cursor-pointer outline-none"
                        >
                            <option value="recent">Más Recientes</option>
                            <option value="amount">Mayor Valor</option>
                        </select>
                        <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>

                    {view === 'mine' && (
                        <div className="relative flex-1 md:flex-none">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="w-full md:w-48 pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-sm text-gray-700 appearance-none transition-all cursor-pointer outline-none"
                            >
                                <option value="all">Todos los estados</option>
                                <option value={OrderStatus.DRIVER_ACCEPTED}>Hacia Restaurante</option>
                                <option value={OrderStatus.IN_TRANSIT}>En Tránsito</option>
                            </select>
                            <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        </div>
                    )}
                </div>
            </div>

            {/* Driver Stats Section */}
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-100">
                <div className="flex items-center gap-3 mb-4">
                    <Award className="text-emerald-600" size={28} />
                    <h2 className="text-xl font-bold text-gray-800">Tus Estadísticas</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Entregas completadas */}
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="text-blue-600" size={20} />
                            <span className="text-sm text-gray-600 font-medium">Entregas</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {completedOrders.length}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Totales completadas</p>
                    </div>

                    {/* Calificación */}
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Star className="text-yellow-500" size={20} />
                            <span className="text-sm text-gray-600 font-medium">Calificación</span>
                        </div>
                        {driverStats && driverStats.totalRatings > 0 ? (
                            <div>
                                <p className="text-3xl font-bold text-gray-800">
                                    {driverStats.averageRating.toFixed(1)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {driverStats.totalRatings} calificaciones
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-2xl font-bold text-gray-400">-</p>
                                <p className="text-xs text-gray-500 mt-1">Sin calificaciones aún</p>
                            </div>
                        )}
                    </div>

                    {/* Ganancias del mes — cálculo real */}
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="text-green-600" size={20} />
                            <span className="text-sm text-gray-600 font-medium">Ganancias</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-800 leading-none">
                            {formatCOP(earningsThisMonth)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{monthName}</p>
                        {totalEarningsAllTime > 0 && earningsThisMonth !== totalEarningsAllTime && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                Total: {formatCOP(totalEarningsAllTime)}
                            </p>
                        )}
                    </div>
                </div>

                {driverStats && driverStats.totalRatings > 0 && (
                    <div className="mt-4 bg-white rounded-xl p-4">
                        <RatingDisplay stats={driverStats} showBreakdown={true} />
                    </div>
                )}
            </div>

            {/* Available Orders */}
            {view === 'available' && (
                <div>
                    {filteredAvailable.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-100">
                            <Package className="mx-auto mb-4 text-gray-200" size={64} />
                            <h2 className="text-2xl font-bold text-gray-400 mb-2">
                                {searchQuery ? 'Sin resultados para tu búsqueda' : 'No hay pedidos disponibles'}
                            </h2>
                            <p className="text-gray-400">
                                {searchQuery ? 'Prueba con otros términos de búsqueda' : 'Vuelve más tarde para ver nuevos pedidos'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAvailable.map(order => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* My Deliveries */}
            {view === 'mine' && (
                <div>
                    {filteredMine.length === 0 ? (
                        <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-100">
                            <Truck className="mx-auto mb-4 text-gray-200" size={64} />
                            <h2 className="text-2xl font-bold text-gray-400 mb-2">
                                {searchQuery ? 'Sin resultados para tu búsqueda' : 'No tienes entregas activas'}
                            </h2>
                            <p className="text-gray-400">
                                {searchQuery ? 'Prueba con otros términos de búsqueda' : 'Acepta pedidos disponibles para comenzar'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMine.map(order => (
                                <OrderCard key={order.id} order={order} isMyDelivery />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DriverDashboard;
