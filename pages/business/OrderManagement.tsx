import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderStatus, Permission, UserRole } from '../../types';
import { PermissionGate } from '../../components/PermissionGate';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Package, Clock, CheckCircle, ChefHat, MessageSquare, Search, RotateCw, Heart, MapPin, Truck, X, User, ChevronDown } from 'lucide-react';
import { formatCOP, formatKgCO2 } from '../../utils/formatters';
import { useNotifications } from '../../context/NotificationContext';
import { Leaf, Gift } from 'lucide-react';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { dataService } from '../../services/dataService';
import { logger } from '../../utils/logger';
import { usePaginatedOrders } from '../../hooks/usePaginatedOrders';
import { useQueryClient } from '@tanstack/react-query';

export const OrderManagement: React.FC = () => {
    const [searchParams] = useSearchParams();
    const initialSearch = searchParams.get('search') || '';

    const { user } = useAuth();
    const { createChat, openChat, currentChat, closeChat } = useChat();
    const { success, error: showError } = useToast();
    const { sendNotification } = useNotifications();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'all' | OrderStatus>('all');
    const [searchTerm, setSearchTerm] = useState(initialSearch);

    // Driver assignment
    const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
    const [drivers, setDrivers] = useState<{ id: string; fullName: string; email: string }[]>([]);
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    const targetVenues = useMemo(() => {
        if (!user) return undefined;
        if (user.role === UserRole.SUPER_ADMIN) return 'all';
        if (user.venueIds && user.venueIds.length > 0) return user.venueIds;
        if (user.venueId) return user.venueId;
        return undefined;
    }, [user]);

    // Hook Paginado para el Historial
    const { 
        data: paginatedData, 
        isLoading: loading, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage,
        refetch 
    } = usePaginatedOrders(targetVenues, { status: filter, search: searchTerm });

    // Aplanar las páginas de React Query en un solo array de pedidos
    const flatOrders = useMemo(() => {
        return paginatedData?.pages.flatMap(page => page.data) || [];
    }, [paginatedData]);

    const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, { status: newStatus });

            // Identificar la data actual para los contadores si finalizamos (COMPLETED)
            const currentOrder = flatOrders.find(o => o.id === orderId);

            if (newStatus === OrderStatus.COMPLETED && currentOrder) {
                await dataService.updateOrderStatus(orderId, newStatus, {
                    venueId: currentOrder.venueId,
                    amount: currentOrder.totalAmount
                });
            } else {
                await dataService.updateOrderStatus(orderId, newStatus);
            }

            // Optimistic update en la cache de React Query
            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) => o.id === orderId ? { ...o, status: newStatus } : o)
                    }))
                };
            });

            success(`Pedido actualizado a ${getStatusLabel(newStatus)}`);

            // --- NOTIFICATIONS ---
            const order = flatOrders.find(o => o.id === orderId);
            if (order) {
                if (newStatus === OrderStatus.PAID) {
                    await sendNotification(order.customerId, '💰 Pago Confirmado', `Hemos recibido tu pago para el pedido #${order.id.slice(0, 8)}.`, 'success');
                } else if (newStatus === OrderStatus.IN_PREPARATION) {
                    await sendNotification(order.customerId, '👨‍🍳 Pedido en Preparación', `Tu pedido se está preparando en el restaurante.`, 'info');
                } else if (newStatus === OrderStatus.READY_PICKUP) {
                    await sendNotification(order.customerId, '✅ Pedido Listo', `Tu pedido está listo para ser recogido o enviado.`, 'success');
                }
            }
        } catch (err) {
            logger.error('Error updating order:', err);
            showError('Error al actualizar el pedido');
        }
    };

    const handleChatWithCustomer = async (order: Order) => {
        try {
            // Evitamos getDoc para prevenir errores de permisos
            const chat = await createChat(
                order.customerId,
                order.customerName || 'Cliente',
                UserRole.CUSTOMER,
                'customer-venue',
                order.id
            );

            await openChat(chat.id);
            success('Chat abierto');
        } catch (error) {
            logger.error('Error opening chat:', error);
            showError('Error al abrir el chat');
        }
    };

    const handleChatWithDriver = async (order: Order) => {
        if (!order.driverId) {
            showError('No hay conductor asignado aún');
            return;
        }

        try {
            // Evitamos getDoc y usamos datos genéricos o del pedido para el conductor
            // ya que los locales TIENEN permiso para leer conductores según firestore.rules
            // pero es mejor ser consistentes si no necesitamos datos extra.
            const chat = await createChat(
                order.driverId,
                'Conductor',
                UserRole.DRIVER,
                'venue-driver',
                order.id
            );

            await openChat(chat.id);
            success('Chat abierto');
        } catch (error) {
            logger.error('Error opening chat:', error);
            showError('Error al abrir el chat');
        }
    };

    const openAssignDriver = async (order: Order) => {
        setAssigningOrder(order);
        setLoadingDrivers(true);
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'DRIVER')));
            setDrivers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        } catch (err) {
            logger.error('Error loading drivers:', err);
            showError('Error al cargar conductores');
        } finally {
            setLoadingDrivers(false);
        }
    };

    const assignDriver = async (driverId: string) => {
        if (!assigningOrder) return;
        try {
            await updateDoc(doc(db, 'orders', assigningOrder.id), { driverId });
            
            // Optimistic cache update
            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) => o.id === assigningOrder.id ? { ...o, driverId } : o)
                    }))
                };
            });
            
            success('Conductor asignado correctamente');
            setAssigningOrder(null);
        } catch (err) {
            logger.error('Error assigning driver:', err);
            showError('Error al asignar conductor');
        }
    };

    const getStatusLabel = (status: OrderStatus): string => {
        const labels: Record<string, string> = {
            [OrderStatus.PENDING]: 'Pendiente',
            [OrderStatus.PAID]: 'Pagado',
            [OrderStatus.IN_PREPARATION]: 'En Preparación',
            [OrderStatus.READY_PICKUP]: 'Listo para Recoger',
            [OrderStatus.DRIVER_ACCEPTED]: 'Conductor Asignado',
            [OrderStatus.IN_TRANSIT]: 'En Camino',
            [OrderStatus.COMPLETED]: 'Completado',
            [OrderStatus.MISSED]: 'Perdido',
            [OrderStatus.DISPUTED]: 'Disputado',
        };
        return labels[status] ?? status;
    };

    const getStatusBadge = (status: OrderStatus) => {
        const badges: Record<string, string> = {
            [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            [OrderStatus.PAID]: 'bg-blue-100 text-blue-800 border-blue-300',
            [OrderStatus.IN_PREPARATION]: 'bg-amber-100 text-amber-800 border-amber-300',
            [OrderStatus.READY_PICKUP]: 'bg-green-100 text-green-800 border-green-300',
            [OrderStatus.DRIVER_ACCEPTED]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            [OrderStatus.IN_TRANSIT]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            [OrderStatus.COMPLETED]: 'bg-gray-100 text-gray-800 border-gray-300',
            [OrderStatus.MISSED]: 'bg-red-100 text-red-800 border-red-300',
            [OrderStatus.DISPUTED]: 'bg-purple-100 text-purple-800 border-purple-300',
        };

        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badges[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {getStatusLabel(status)}
            </span>
        );
    };

    // Ya no filtramos localmente, la data del hook `usePaginatedOrders` ya viene filtrada
    const filteredOrders = flatOrders;

    const activeOrders = flatOrders.filter(o =>
        o.status === OrderStatus.PENDING ||
        o.status === OrderStatus.PAID ||
        o.status === OrderStatus.IN_PREPARATION ||
        o.status === OrderStatus.READY_PICKUP ||
        o.status === OrderStatus.DRIVER_ACCEPTED
    );

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <>
        <div className="space-y-6 overflow-x-hidden">
            {/* Fila 1: título + contador + botón refresh */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ChefHat className="text-emerald-600" />
                        Gestión de Pedidos
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} activo{activeOrders.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <button
                    onClick={() => {
                        if (user?.venueId) {
                            refetch();
                        }
                    }}
                    className="bg-white border border-gray-200 text-gray-600 p-3 rounded-xl hover:bg-gray-50 transition shadow-sm flex items-center justify-center active:scale-95 flex-shrink-0"
                    title="Refrescar pedidos"
                >
                    <RotateCw size={22} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Fila 2: filtros — scroll horizontal propio, ancho completo */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                    onClick={() => setFilter('all')}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === 'all'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setFilter(OrderStatus.PENDING)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === OrderStatus.PENDING
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setFilter(OrderStatus.PAID)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === OrderStatus.PAID
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Pagados
                </button>
                <button
                    onClick={() => setFilter(OrderStatus.IN_PREPARATION)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === OrderStatus.IN_PREPARATION
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    En Cocina
                </button>
                <button
                    onClick={() => setFilter(OrderStatus.READY_PICKUP)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === OrderStatus.READY_PICKUP
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Listos
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar pedido por nombre, ID o producto..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {
                filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <Package className="mx-auto mb-4 text-gray-300" size={64} />
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No hay pedidos</h3>
                        <p className="text-gray-500">
                            {filter === 'all'
                                ? 'Aún no has recibido pedidos'
                                : `No hay pedidos con estado "${getStatusLabel(filter as OrderStatus)}"`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredOrders.map(order => (
                            <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                {/* Order Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Pedido #{order.id.slice(0, 8)}</p>
                                        <h3 className="font-bold text-lg text-gray-800">{order.customerName}</h3>
                                    </div>
                                    {getStatusBadge(order.status)}
                                </div>

                                {order.isDonation && (
                                    <div className="mb-4 flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-100 animate-pulse">
                                        <Heart size={16} className="fill-red-500" />
                                        <span className="text-sm font-bold uppercase tracking-tight">Para Donación: {order.donationCenterName}</span>
                                    </div>
                                )}

                                {/* Time Info */}
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                                    <Clock size={16} />
                                    <span>
                                        {new Date(order.createdAt).toLocaleString('es-ES', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>

                                {/* Products */}
                                <div className="border-t border-gray-100 pt-3 mb-3">
                                    <p className="text-xs font-semibold text-gray-600 mb-2">Productos:</p>
                                    <div className="space-y-1">
                                        {order.products.map((product, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-gray-700">
                                                    {product.quantity}x {product.name}
                                                </span>
                                                <span className="font-semibold text-gray-800">
                                                    {formatCOP((product.price ?? product.discountedPrice ?? product.originalPrice) * product.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Delivery Info */}
                                <div className="border-t border-gray-100 pt-3 mb-4">
                                    {!order.isDonation ? (
                                        <>
                                            <p className="text-xs text-gray-600"><strong>Dirección:</strong> {order.deliveryAddress}</p>
                                            <p className="text-xs text-gray-600"><strong>Teléfono:</strong> {order.phone}</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-600 font-medium flex items-center gap-1">
                                            <MapPin size={12} className="text-emerald-500" />
                                            Entregar en: {order.donationCenterName}
                                        </p>
                                    )}
                                </div>

                                {/* Total */}
                                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                                    <div className="flex flex-col gap-1 items-end">
                                        <span className="text-2xl font-bold text-emerald-600">
                                            {formatCOP(order.totalAmount)}
                                        </span>
                                        <div className="flex gap-2">
                                            {order.estimatedCo2 && (
                                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Leaf size={10} /> -{formatKgCO2(order.estimatedCo2)}
                                                </span>
                                            )}
                                            {order.pointsEarned && (
                                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Gift size={10} /> +{order.pointsEarned} pts
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <PermissionGate requires={Permission.MANAGE_ORDERS}>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            {order.status === OrderStatus.PENDING && order.paymentMethod === 'cash' && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, OrderStatus.PAID)}
                                                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 active:scale-95 transition-all duration-200 text-sm font-bold"
                                                >
                                                    Confirmar Pago
                                                </button>
                                            )}

                                            {order.status === OrderStatus.PENDING && order.paymentMethod === 'card' && (
                                                <div className="w-full text-center text-sm text-indigo-600 font-bold py-3 bg-indigo-50 rounded-xl border border-indigo-200 shadow-sm animate-pulse">
                                                    Esperando confirmación del pago online
                                                </div>
                                            )}

                                            {order.status === OrderStatus.PAID && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PREPARATION)}
                                                    className="w-full px-4 py-3 bg-amber-500 text-white rounded-xl shadow-sm hover:bg-amber-600 active:scale-95 transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
                                                >
                                                    <ChefHat size={18} />
                                                    Cocinar
                                                </button>
                                            )}

                                            {order.status === OrderStatus.IN_PREPARATION && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, OrderStatus.READY_PICKUP)}
                                                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={18} />
                                                    Marcar Listo
                                                </button>
                                            )}

                                            {order.status === OrderStatus.READY_PICKUP && (
                                                <div className="flex flex-col gap-2 w-full">
                                                    <div className="w-full text-center text-sm text-gray-500 font-bold py-3 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                                                        Esperando recogida
                                                    </div>
                                                    {order.deliveryAddress && (
                                                        <button
                                                            onClick={() => openAssignDriver(order)}
                                                            className="w-full px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl hover:bg-indigo-100 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                        >
                                                            <Truck size={16} />
                                                            {order.driverId ? 'Reasignar Conductor' : 'Asignar Conductor'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {order.status === OrderStatus.DRIVER_ACCEPTED && (
                                                <div className="w-full text-center text-sm text-blue-600 font-bold py-3 bg-blue-50 rounded-xl border border-blue-200 shadow-sm animate-pulse">
                                                    Conductor en camino
                                                </div>
                                            )}

                                            {order.status === OrderStatus.IN_TRANSIT && (
                                                <div className="w-full text-center text-sm text-purple-600 font-bold py-3 bg-purple-50 rounded-xl border border-purple-200 shadow-sm">
                                                    En reparto
                                                </div>
                                            )}
                                        </div>

                                        {/* Chat Buttons */}
                                        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100">
                                            <button
                                                onClick={() => handleChatWithCustomer(order)}
                                                className="flex-1 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                                            >
                                                <MessageSquare size={16} />
                                                Chat Cliente
                                            </button>

                                            {order.driverId && (
                                                <button
                                                    onClick={() => handleChatWithDriver(order)}
                                                    className="flex-1 px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                                                >
                                                    <MessageSquare size={16} />
                                                    Chat Conductor
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </PermissionGate>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Pagination Controls */}
            {hasNextPage && (
                <div className="flex justify-center mt-8 pb-4">
                    <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-6 py-3 bg-white text-emerald-700 border border-emerald-200 rounded-xl shadow-sm hover:bg-emerald-50 active:scale-95 transition-all duration-200 font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <RotateCw className="animate-spin text-emerald-500" size={18} />
                                Cargando más...
                            </>
                        ) : (
                            <>
                                <ChevronDown size={20} />
                                Cargar más historial
                            </>
                        )}
                    </button>
                </div>
            )}
            {/* Chat Window Toggle (Specific order context) */}
            {currentChat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-300">
                        <ChatWindow 
                            onClose={() => closeChat()} 
                            showBackButton={false}
                        />
                    </div>
                </div>
            )}
        </div>

            {/* Driver Assignment Modal */}
            {assigningOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-5 border-b">
                            <div>
                                <h3 className="font-bold text-gray-900">Asignar Conductor</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Pedido #{assigningOrder.id.slice(0, 8)} · {assigningOrder.customerName}</p>
                            </div>
                            <button onClick={() => setAssigningOrder(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 max-h-72 overflow-y-auto">
                            {loadingDrivers ? (
                                <div className="py-8 text-center text-gray-400 text-sm">Cargando conductores...</div>
                            ) : drivers.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-sm">No hay conductores registrados</div>
                            ) : (
                                <div className="space-y-2">
                                    {drivers.map(driver => (
                                        <button
                                            key={driver.id}
                                            onClick={() => assignDriver(driver.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-indigo-50 hover:border-indigo-200 ${assigningOrder.driverId === driver.id ? 'bg-indigo-50 border-indigo-300' : 'border-gray-100'}`}
                                        >
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                                {driver.fullName?.charAt(0)?.toUpperCase() || <User size={14} />}
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-medium text-gray-800 text-sm">{driver.fullName}</p>
                                                <p className="text-xs text-gray-500">{driver.email}</p>
                                            </div>
                                            {assigningOrder.driverId === driver.id && (
                                                <span className="text-xs text-indigo-600 font-bold">Asignado</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default OrderManagement;
