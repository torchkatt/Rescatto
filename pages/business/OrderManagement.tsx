import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';
import { Order, OrderStatus, Permission, UserRole } from '../../types';
import { PermissionGate } from '../../components/PermissionGate';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { Package, Clock, CheckCircle, ChefHat, MessageSquare, Search, RotateCw, Heart, MapPin, Truck, X, User, ChevronDown, ThumbsUp, ThumbsDown, Send, Users } from 'lucide-react';
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
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    const searchTimeoutRef = useRef<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

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

    useEffect(() => {
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = window.setTimeout(() => {
            setSearchTerm(searchInput.trim());
        }, 350);

        return () => {
            if (searchTimeoutRef.current) {
                window.clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchInput]);


    const normalizeText = (value: string) =>
        value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

    const matchesSearch = (order: Order, queryText: string) => {
        if (!queryText) return true;
        const haystack = normalizeText([
            order.id,
            order.customerName,
            order.metadata?.venueName,
            order.venueId,
            order.city,
            order.paymentMethod,
            order.deliveryMethod,
            getStatusLabel(order.status),
            order.totalAmount?.toString(),
            order.platformFee?.toString(),
            order.venueEarnings?.toString(),
            order.deliveryFee?.toString(),
            order.donationCenterName,
            order.phone,
            order.deliveryAddress,
            ...(order.products?.map(p => p.name) || [])
        ].filter(Boolean).join(' '));

        return haystack.includes(normalizeText(queryText));
    };

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
                if (newStatus === OrderStatus.IN_PREPARATION) {
                    await sendNotification(order.customerId, '👨‍🍳 Pedido en Preparación', `Tu pedido se está preparando en ${order.venueName || 'el restaurante'}.`, 'info');
                } else if (newStatus === OrderStatus.READY) {
                    await sendNotification(order.customerId, '✅ Pedido Listo', `Tu pedido está listo para ${order.deliveryMethod === 'pickup' ? 'recoger' : 'despachar'}.`, 'success');
                } else if (newStatus === OrderStatus.IN_TRANSIT) {
                    await sendNotification(order.customerId, '🚚 Pedido Despachado', `Tu pedido está en camino.`, 'success');
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
            const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'DRIVER'), limit(20)));
            setDrivers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        } catch (err) {
            logger.error('Error loading drivers:', err);
            showError('Error al cargar conductores');
        } finally {
            setLoadingDrivers(false);
        }
    };

    const handleAssignDriver = async (driverId: string) => {
        if (!assigningOrder) return;
        try {
            const assignDriverFn = httpsCallable(functions, 'assignDriver');
            await assignDriverFn({ orderId: assigningOrder.id, driverId });

            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) =>
                            o.id === assigningOrder.id ? { ...o, driverId, status: OrderStatus.DRIVER_ASSIGNED } : o
                        )
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

    const handleAcceptOrder = async (orderId: string) => {
        try {
            const acceptOrderFn = httpsCallable(functions, 'acceptOrder');
            await acceptOrderFn({ orderId });
            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) =>
                            o.id === orderId ? { ...o, status: OrderStatus.ACCEPTED } : o
                        )
                    }))
                };
            });
            success('Pedido aceptado');
        } catch (err) {
            logger.error('Error accepting order:', err);
            showError('Error al aceptar el pedido');
        }
    };

    const handleRejectOrder = async (orderId: string) => {
        try {
            const rejectOrderFn = httpsCallable(functions, 'rejectOrder');
            await rejectOrderFn({ orderId });
            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) =>
                            o.id === orderId ? { ...o, status: OrderStatus.CANCELLED } : o
                        )
                    }))
                };
            });
            success('Pedido rechazado');
        } catch (err) {
            logger.error('Error rejecting order:', err);
            showError('Error al rechazar el pedido');
        }
    };

    const handleReleaseToPool = async (orderId: string) => {
        try {
            const releaseToDriverPoolFn = httpsCallable(functions, 'releaseToDriverPool');
            await releaseToDriverPoolFn({ orderId });
            queryClient.setQueryData(['ordersPaginated', targetVenues, filter, searchTerm], (oldData: any) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((o: Order) =>
                            o.id === orderId ? { ...o, status: OrderStatus.AWAITING_DRIVER } : o
                        )
                    }))
                };
            });
            success('Pedido liberado al pool de repartidores');
        } catch (err) {
            logger.error('Error releasing order:', err);
            showError('Error al liberar el pedido');
        }
    };

    const getStatusLabel = (status: OrderStatus): string => {
        const labels: Record<string, string> = {
            [OrderStatus.PENDING]: 'Pendiente',
            [OrderStatus.PAID]: 'Pagado',
            [OrderStatus.ACCEPTED]: 'Aceptado',
            [OrderStatus.IN_PREPARATION]: 'En Preparación',
            [OrderStatus.READY]: 'Listo',
            [OrderStatus.AWAITING_DRIVER]: 'Buscando Repartidor',
            [OrderStatus.DRIVER_ASSIGNED]: 'Repartidor Asignado',
            [OrderStatus.IN_TRANSIT]: 'En Camino',
            [OrderStatus.COMPLETED]: 'Completado',
            [OrderStatus.CANCELLED]: 'Cancelado',
            [OrderStatus.MISSED]: 'Perdido',
            [OrderStatus.DISPUTED]: 'Disputado',
        };
        return labels[status] ?? status;
    };

    const getStatusBadge = (status: OrderStatus) => {
        const badges: Record<string, string> = {
            [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            [OrderStatus.PAID]: 'bg-blue-100 text-blue-800 border-blue-300',
            [OrderStatus.ACCEPTED]: 'bg-sky-100 text-sky-800 border-sky-300',
            [OrderStatus.IN_PREPARATION]: 'bg-amber-100 text-amber-800 border-amber-300',
            [OrderStatus.READY]: 'bg-green-100 text-green-800 border-green-300',
            [OrderStatus.AWAITING_DRIVER]: 'bg-orange-100 text-orange-800 border-orange-300',
            [OrderStatus.DRIVER_ASSIGNED]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            [OrderStatus.IN_TRANSIT]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
            [OrderStatus.COMPLETED]: 'bg-gray-100 text-gray-800 border-gray-300',
            [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800 border-red-300',
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
    const tableOrders = useMemo(() => {
        if (!isSuperAdmin) return filteredOrders;
        return filteredOrders.filter(order => matchesSearch(order, searchTerm));
    }, [filteredOrders, isSuperAdmin, searchTerm]);

    useEffect(() => {
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
            searchInputRef.current.focus({ preventScroll: true });
        }
    }, [tableOrders.length]);

    const activeOrders = flatOrders.filter(o =>
        o.status === OrderStatus.PENDING ||
        o.status === OrderStatus.PAID ||
        o.status === OrderStatus.ACCEPTED ||
        o.status === OrderStatus.IN_PREPARATION ||
        o.status === OrderStatus.READY ||
        o.status === OrderStatus.AWAITING_DRIVER ||
        o.status === OrderStatus.DRIVER_ASSIGNED ||
        o.status === OrderStatus.IN_TRANSIT
    );

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <>
        <div className="space-y-6 overflow-x-hidden animate-in fade-in duration-700">
            {/* Fila 1: título + contador + botón refresh */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ChefHat className="text-emerald-600" />
                        {isSuperAdmin ? 'Pedidos Corporativos' : 'Gestión de Pedidos'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} activo{activeOrders.length !== 1 ? 's' : ''}
                        {isSuperAdmin && ' · Vista de lectura'}
                    </p>
                </div>

                <button
                    onClick={() => {
                        if (user?.venueId || user?.role === UserRole.SUPER_ADMIN) {
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
                {([
                    { value: 'all', label: 'Todos', color: 'bg-emerald-600' },
                    { value: OrderStatus.PENDING, label: 'Pendientes', color: 'bg-yellow-500' },
                    { value: OrderStatus.ACCEPTED, label: 'Aceptados', color: 'bg-sky-500' },
                    { value: OrderStatus.IN_PREPARATION, label: 'En Cocina', color: 'bg-amber-500' },
                    { value: OrderStatus.READY, label: 'Listos', color: 'bg-green-600' },
                    { value: OrderStatus.AWAITING_DRIVER, label: 'Sin Repartidor', color: 'bg-orange-500' },
                    { value: OrderStatus.DRIVER_ASSIGNED, label: 'Asignado', color: 'bg-indigo-600' },
                    { value: OrderStatus.IN_TRANSIT, label: 'En Camino', color: 'bg-indigo-600' },
                    { value: OrderStatus.COMPLETED, label: 'Completados', color: 'bg-gray-600' },
                ] as const).map(({ value, label, color }) => (
                    <button
                        key={value}
                        onClick={() => setFilter(value as 'all' | OrderStatus)}
                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${filter === value ? `${color} text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <Search className="text-gray-400" size={20} />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por pedido, negocio, ciudad, cliente, estado, pago, entrega..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                    value={searchInput}
                    onChange={(e) => {
                        setSearchInput(e.target.value);
                        requestAnimationFrame(() => {
                            searchInputRef.current?.focus({ preventScroll: true });
                        });
                    }}
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
                ) : isSuperAdmin ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Pedido</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Negocio</th>
                                        <th className="px-4 py-3">Ciudad</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3">Total</th>
                                        <th className="px-4 py-3">Pago</th>
                                        <th className="px-4 py-3">Entrega</th>
                                        <th className="px-4 py-3">Comisión</th>
                                        <th className="px-4 py-3">Ganancia Sede</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {tableOrders.map(order => (
                                        <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                                            <td className="px-4 py-3 text-gray-700">
                                                <div className="font-semibold">#{order.id.slice(0, 8)}</div>
                                                <div className="text-xs text-gray-500">{order.customerName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                {new Date(order.createdAt).toLocaleString('es-ES', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {order.metadata?.venueName || order.venueId}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {order.city || 'N/D'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(order.status)}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                                                {formatCOP(order.totalAmount)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {order.paymentMethod || 'N/D'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {order.deliveryMethod || 'N/D'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                {order.platformFee != null ? formatCOP(order.platformFee) : 'N/D'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                {order.venueEarnings != null ? formatCOP(order.venueEarnings) : 'N/D'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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

                                            {/* PENDING: Aceptar / Rechazar */}
                                            {order.status === OrderStatus.PENDING && (
                                                <>
                                                    <button
                                                        onClick={() => handleAcceptOrder(order.id)}
                                                        className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle size={18} />
                                                        Aceptar Pedido
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectOrder(order.id)}
                                                        className="flex-1 px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        <X size={18} />
                                                        Rechazar
                                                    </button>
                                                </>
                                            )}

                                            {/* ACCEPTED: Iniciar Preparación o Marcar Listo directo */}
                                            {order.status === OrderStatus.ACCEPTED && (
                                                <>
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PREPARATION)}
                                                        className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl shadow-sm hover:bg-amber-600 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        <ChefHat size={18} />
                                                        Iniciar Preparación
                                                    </button>
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, OrderStatus.READY)}
                                                        className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle size={18} />
                                                        Ya Está Listo
                                                    </button>
                                                </>
                                            )}

                                            {/* IN_PREPARATION: Marcar Listo */}
                                            {order.status === OrderStatus.IN_PREPARATION && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, OrderStatus.READY)}
                                                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={18} />
                                                    Marcar Listo
                                                </button>
                                            )}

                                            {/* READY: bifurcación por deliveryMethod + deliveryModel */}
                                            {order.status === OrderStatus.READY && (
                                                <div className="flex flex-col gap-2 w-full">
                                                    {order.deliveryMethod === 'pickup' || !order.deliveryMethod ? (
                                                        <div className="w-full text-center text-sm text-green-700 font-bold py-3 bg-green-50 rounded-xl border border-green-200">
                                                            Listo para recoger — esperando al cliente
                                                        </div>
                                                    ) : order.deliveryModel === 'own_drivers' ? (
                                                        <button
                                                            onClick={() => updateOrderStatus(order.id, OrderStatus.IN_TRANSIT)}
                                                            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                        >
                                                            <Truck size={18} />
                                                            Despachar (domiciliario propio)
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleReleaseToPool(order.id)}
                                                                className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl shadow-sm hover:bg-orange-600 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                            >
                                                                <Users size={18} />
                                                                Liberar al Pool de Repartidores
                                                            </button>
                                                            <button
                                                                onClick={() => openAssignDriver(order)}
                                                                className="w-full px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl hover:bg-indigo-100 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                            >
                                                                <User size={16} />
                                                                Asignar Repartidor Específico
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* AWAITING_DRIVER: asignación manual disponible */}
                                            {order.status === OrderStatus.AWAITING_DRIVER && (
                                                <div className="flex flex-col gap-2 w-full">
                                                    <div className="w-full text-center text-sm text-orange-700 font-bold py-3 bg-orange-50 rounded-xl border border-orange-200 animate-pulse">
                                                        Buscando repartidor disponible...
                                                    </div>
                                                    <button
                                                        onClick={() => openAssignDriver(order)}
                                                        className="w-full px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl hover:bg-indigo-100 active:scale-95 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                                    >
                                                        <User size={16} />
                                                        Asignar Manualmente
                                                    </button>
                                                </div>
                                            )}

                                            {order.status === OrderStatus.DRIVER_ASSIGNED && (
                                                <div className="w-full text-center text-sm text-indigo-700 font-bold py-3 bg-indigo-50 rounded-xl border border-indigo-200 animate-pulse">
                                                    Repartidor asignado — en camino al local
                                                </div>
                                            )}

                                            {order.status === OrderStatus.IN_TRANSIT && (
                                                <div className="w-full text-center text-sm text-purple-600 font-bold py-3 bg-purple-50 rounded-xl border border-purple-200">
                                                    En reparto 🚚
                                                </div>
                                            )}

                                            {order.status === OrderStatus.CANCELLED && (
                                                <div className="w-full text-center text-sm text-red-600 font-bold py-3 bg-red-50 rounded-xl border border-red-200">
                                                    Cancelado
                                                    {order.cancellationReason === 'ACCEPTANCE_TIMEOUT' && ' (sin respuesta)'}
                                                    {order.cancellationReason === 'REJECTED_BY_STAFF' && ' (rechazado por el equipo)'}
                                                    {order.cancellationReason === 'CLIENT_CANCELLED' && ' (cancelado por el cliente)'}
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
                                            onClick={() => handleAssignDriver(driver.id)}
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
