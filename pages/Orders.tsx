import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, UserRole } from '../types';
import { Clock, CheckCircle, Package, RotateCw, UtensilsCrossed, AlertCircle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { LoadingSpinner } from '../components/customer/common/Loading';

const Orders: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isVenueMissing, setIsVenueMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const { user } = useAuth();
  const { showToast } = useToast();

  const venueIdsKey = useMemo(() => JSON.stringify(user?.venueIds), [user?.venueIds]);

  useEffect(() => {
    if (!user) return;
    loadOrders(true);
    // loadOrders también se usa en el botón "cargar más"; incluirla como dep causaría loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.venueId, venueIdsKey, user?.role]);

  const resolveTargetVenues = () => {
    let targetVenues: string | string[] | 'all' = 'all';
    if (user?.role !== UserRole.SUPER_ADMIN) {
      if (user?.venueIds && user.venueIds.length > 0) {
        targetVenues = user.venueIds;
      } else if (user?.venueId) {
        targetVenues = user.venueId;
      } else {
        return null;
      }
    }
    return targetVenues;
  };

  const loadOrders = async (initial = false) => {
    const targetVenues = resolveTargetVenues();
    if (!targetVenues) {
      setOrders([]);
      setIsVenueMissing(true);
      return;
    }
    setIsVenueMissing(false);
    if (initial) {
      setLoading(true);
      setOrders([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const page = await dataService.getOrdersPage(targetVenues, initial ? null : lastDoc, 20);
      setOrders(prev => initial ? page.orders : [...prev, ...page.orders]);
      setLastDoc(page.lastDoc);
      setHasMore(page.hasMore);
    } catch (error) {
      showToast('error', t('orders_error_load'));
    } finally {
      if (initial) setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await dataService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      showToast('success', t('orders_updated_status', { status: newStatus }));
    } catch (error) {
      showToast('error', t('orders_error_update'));
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PAID: return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">{t('badge_to_prepare')}</span>;
      case OrderStatus.IN_PREPARATION: return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold animate-pulse">{t('badge_cooking')}</span>;
      case OrderStatus.READY: return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold animate-pulse">{t('badge_ready_pickup')}</span>;
      case OrderStatus.DRIVER_ASSIGNED: return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{t('badge_driver_en_route')}</span>;
      case OrderStatus.IN_TRANSIT: return <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-bold">{t('badge_in_transit')}</span>;
      case OrderStatus.COMPLETED: return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{t('badge_completed')}</span>;
      case OrderStatus.MISSED: return <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold">{t('badge_not_picked_up')}</span>;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'ACTIVE') return [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.IN_TRANSIT
    ].includes(o.status);
    return o.status === OrderStatus.COMPLETED || o.status === OrderStatus.MISSED;
  });

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('orders_mgmt_title')}</h1>
          <p className="text-sm text-gray-500">{t('orders_mgmt_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Conectado en tiempo real"
            className="bg-white border border-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center"
            title="Conectado en tiempo real"
          >
            <RotateCw size={18} />
          </button>
          <div role="tablist" className="flex space-x-1.5 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <button
              role="tab"
              aria-selected={activeTab === 'ACTIVE'}
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${activeTab === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {t('orders_tab_active')}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'HISTORY'}
              onClick={() => setActiveTab('HISTORY')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {t('orders_tab_history')}
            </button>
          </div>
        </div>
      </div>

      {isVenueMissing && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <span className="font-bold">{t('attention', 'Atención')}:</span> {t('orders_no_venue_warning')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de Estadísticas para la Pestaña Activa */}
      {activeTab === 'ACTIVE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-200 p-2 rounded-lg text-blue-700"><Package size={20} /></div>
              <div>
                <p className="text-sm text-blue-900 font-medium">{t('orders_stat_to_prepare')}</p>
                <p className="text-2xl font-bold text-blue-700">{orders.filter(o => o.status === OrderStatus.PAID).length}</p>
              </div>
            </div>
          </div>
          {/* Nueva Tarjeta: En Preparación */}
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-200 p-2 rounded-lg text-orange-700"><CheckCircle size={20} /></div>
              <div>
                <p className="text-sm text-orange-900 font-medium">{t('orders_stat_cooking')}</p>
                <p className="text-2xl font-bold text-orange-700">{orders.filter(o => o.status === OrderStatus.IN_PREPARATION).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-200 p-2 rounded-lg text-green-700"><Clock size={20} /></div>
              <div>
                <p className="text-sm text-green-900 font-medium">{t('orders_stat_pickup')}</p>
                <p className="text-2xl font-bold text-green-700">{orders.filter(o => o.status === OrderStatus.READY).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-200 p-2 rounded-lg text-indigo-700"><Package size={20} /></div>
              <div>
                <p className="text-sm text-indigo-900 font-medium">{t('orders_stat_driver')}</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {orders.filter(o => o.status === OrderStatus.DRIVER_ASSIGNED || o.status === OrderStatus.IN_TRANSIT).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cuadrícula de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <Package size={48} className="mx-auto mb-3 opacity-50" />
            <p>{t('orders_empty_category')}</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${order.status === OrderStatus.IN_PREPARATION ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100'}`}>
              <div className={`p-4 border-b flex justify-between items-start ${order.status === OrderStatus.IN_PREPARATION ? 'bg-orange-50' : 'bg-gray-50/50'}`}>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">#{order.metadata?.orderNumber?.slice(-4) || order.id.slice(0, 4)}</h3>
                  <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="p-4 flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                    {order.customerName.charAt(0)}
                  </div>
                  <span className="font-bold text-gray-800 text-lg">{order.customerName}</span>
                </div>

                <div className="space-y-3 mb-4">
                  {order.products.map((prod, idx) => (
                    <div key={idx} className="flex justify-between items-center text-base p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-800 font-medium flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{prod.quantity}x</span>
                        {prod.name}
                      </span>
                    </div>
                  ))}
                  {order.deliveryNotes && (
                    <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 italic border border-yellow-200">
                      {t('orders_delivery_note', { note: order.deliveryNotes })}
                    </div>
                  )}
                </div>

                <div className="text-sm text-red-600 font-bold flex items-center gap-1 bg-red-50 p-2 rounded mb-2 border border-red-100">
                  <Clock size={14} />
                  <span>{t('orders_delivery_time_label')} {new Date(order.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {((order as any).driverName || order.driverId) && (
                  <div className="text-sm text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 p-2 rounded mb-2 border border-indigo-100">
                    <Package size={14} />
                    <span>{t('orders_driver_label', { name: (order as any).driverName || t('orders_assigned', 'Asignado') })}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100">
                {order.status === OrderStatus.PAID && (
                  <button
                    onClick={() => handleStatusChange(order.id, OrderStatus.IN_PREPARATION)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-lg active:scale-95"
                  >
                    <UtensilsCrossed size={20} />
                    {t('orders_start_cooking')}
                  </button>
                )}
                {order.status === OrderStatus.IN_PREPARATION && (
                  <button
                    onClick={() => handleStatusChange(order.id, OrderStatus.READY)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-lg animate-pulse active:scale-95"
                  >
                    <CheckCircle size={20} />
                    {t('orders_mark_ready')}
                  </button>
                )}
                {order.status === OrderStatus.READY && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('orders_delivery_code_ph')}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      />
                      <button
                        onClick={() => handleStatusChange(order.id, OrderStatus.COMPLETED)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-emerald-100"
                      >
                        {t('orders_deliver_btn')}
                      </button>
                    </div>
                  </div>
                )}
                {(order.status === OrderStatus.COMPLETED || order.status === OrderStatus.MISSED) && (
                  <button disabled className="w-full bg-gray-200 text-gray-400 font-medium py-2 rounded-lg cursor-not-allowed">
                    {t('orders_archived')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => loadOrders(false)}
            disabled={loadingMore}
            className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loadingMore ? t('loading') : t('orders_load_more')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Orders;
