import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionService } from '../../../services/transactionService';
import { Transaction, TransactionStatus } from '../../../types';
import { Package, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { logger } from '../../../utils/logger';

interface RecentOrdersProps {
  buyerId: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En Progreso',
  READY: 'Listo',
  IN_TRANSIT: 'En Camino',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  DISPUTED: 'Disputado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  READY: 'bg-green-100 text-green-700',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DISPUTED: 'bg-red-100 text-red-700',
};

export const RecentOrders: React.FC<RecentOrdersProps> = ({ buyerId }) => {
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await transactionService.getByBuyer(buyerId, null, 5);
        if (!cancelled) setOrders(result.transactions);
      } catch (e) {
        logger.error('RecentOrders: error loading', e);
        if (!cancelled) setError('No se pudieron cargar los pedidos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [buyerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-xl p-4 border border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl text-red-600 text-sm">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Package size={24} className="text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm font-medium">Aún no tienes pedidos</p>
        <p className="text-gray-400 text-xs mt-1">Tus compras aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => navigate(`/app/orders?highlight=${order.id}`)}
          className="w-full bg-white rounded-xl p-4 border border-gray-100 shadow-sm 
            hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 
            transition-all duration-200 text-left active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {order.lineItems?.[0]?.title || `Pedido #${order.id.slice(0, 8)}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Clock size={12} />
                {new Date(order.createdAt).toLocaleDateString('es-CO', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
            <span className="text-xs text-gray-400">
              {order.lineItems?.length || 0} producto{(order.lineItems?.length || 0) !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-black text-emerald-600">
              ${(order.totalAmount || 0).toLocaleString('es-CO')}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default RecentOrders;
