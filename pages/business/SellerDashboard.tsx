import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  Package,
  Star,
  ArrowUpRight,
  Clock,
  Calendar,
  Store,
  TrendingUp,
  AlertCircle,
  PackageOpen,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { sellerService } from '../../services/sellerService';
import { transactionService } from '../../services/transactionService';
import { bookingService } from '../../services/bookingService';
import { listingService } from '../../services/listingService';
import { Seller, Transaction, Booking, Listing, BookingStatus, TransactionStatus } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { getUserVenueId } from '../../utils/getUserVenueId';
import { logger } from '../../utils/logger';

// ─── MetricCard ────────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  subtitle?: string;
}> = ({ title, value, icon, color, trend, subtitle }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-start space-x-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group relative overflow-hidden">
    <div
      className={`p-4 rounded-xl flex-shrink-0 relative z-10`}
      style={{ backgroundColor: `${color}15` }}
    >
      <div className="relative z-10 text-gray-700 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
    </div>
    <div className="flex-1 relative z-10">
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
      {trend && (
        <div className="flex items-center mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
          <ArrowUpRight size={12} className="mr-1" />
          {trend}
        </div>
      )}
      {subtitle && !trend && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
    <div
      className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-500 ease-out"
      style={{ backgroundColor: color }}
    />
  </div>
);

// ─── Status badge helpers ──────────────────────────────────────────────────────

const transactionStatusLabel: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'Pendiente',
  [TransactionStatus.CONFIRMED]: 'Confirmada',
  [TransactionStatus.IN_PROGRESS]: 'En progreso',
  [TransactionStatus.READY]: 'Listo',
  [TransactionStatus.IN_TRANSIT]: 'En tránsito',
  [TransactionStatus.COMPLETED]: 'Completada',
  [TransactionStatus.CANCELLED]: 'Cancelada',
  [TransactionStatus.DISPUTED]: 'Disputada',
};

const transactionStatusColor: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'bg-amber-100 text-amber-700',
  [TransactionStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [TransactionStatus.IN_PROGRESS]: 'bg-indigo-100 text-indigo-700',
  [TransactionStatus.READY]: 'bg-cyan-100 text-cyan-700',
  [TransactionStatus.IN_TRANSIT]: 'bg-purple-100 text-purple-700',
  [TransactionStatus.COMPLETED]: 'bg-emerald-100 text-emerald-700',
  [TransactionStatus.CANCELLED]: 'bg-red-100 text-red-700',
  [TransactionStatus.DISPUTED]: 'bg-orange-100 text-orange-700',
};

const bookingStatusLabel: Record<BookingStatus, string> = {
  [BookingStatus.CONFIRMED]: 'Confirmada',
  [BookingStatus.CANCELLED]: 'Cancelada',
  [BookingStatus.ATTENDED]: 'Atendida',
  [BookingStatus.NO_SHOW]: 'No asistió',
};

const bookingStatusColor: Record<BookingStatus, string> = {
  [BookingStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [BookingStatus.CANCELLED]: 'bg-red-100 text-red-700',
  [BookingStatus.ATTENDED]: 'bg-emerald-100 text-emerald-700',
  [BookingStatus.NO_SHOW]: 'bg-gray-100 text-gray-700',
};

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

// ─── SellerDashboard ───────────────────────────────────────────────────────────

const SellerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const venueId = getUserVenueId(user);

  // Data state
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);

  // UI state
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sellerId = seller?.id;

  // ── Load seller ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!venueId) {
      setLoadingSeller(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const s = await sellerService.getById(venueId);
        if (!cancelled) {
          setSeller(s);
        }
      } catch (err) {
        logger.error('SellerDashboard: error loading seller', err);
        if (!cancelled) setError('No se pudo cargar la información del vendedor.');
      } finally {
        if (!cancelled) setLoadingSeller(false);
      }
    })();

    return () => { cancelled = true; };
  }, [venueId]);

  // ── Load listings ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sellerId) {
      setLoadingListings(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const l = await listingService.getListingsBySeller(sellerId);
        if (!cancelled) setListings(l);
      } catch (err) {
        logger.error('SellerDashboard: error loading listings', err);
        if (!cancelled) showToast('error', 'Error al cargar listados activos');
      } finally {
        if (!cancelled) setLoadingListings(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId, showToast]);

  // ── Load transactions ────────────────────────────────────────────────────

  useEffect(() => {
    if (!sellerId) {
      setLoadingTransactions(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { transactions } = await transactionService.getBySeller(sellerId);
        if (!cancelled) setRecentTransactions(transactions);
      } catch (err) {
        logger.error('SellerDashboard: error loading transactions', err);
        if (!cancelled) showToast('error', 'Error al cargar transacciones');
      } finally {
        if (!cancelled) setLoadingTransactions(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId, showToast]);

  // ── Load bookings ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sellerId) {
      setLoadingBookings(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { bookings } = await bookingService.getBySeller(sellerId);
        if (!cancelled) {
          // Show only upcoming/confirmed bookings
          const now = new Date().toISOString();
          const upcoming = bookings.filter(
            (b) => b.status === BookingStatus.CONFIRMED && b.startTime >= now
          );
          setUpcomingBookings(upcoming);
        }
      } catch (err) {
        logger.error('SellerDashboard: error loading bookings', err);
        if (!cancelled) showToast('error', 'Error al cargar reservas');
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sellerId, showToast]);

  // ── Derived metrics ──────────────────────────────────────────────────────

  const totalRevenue = seller?.stats?.totalRevenue ?? 0;
  const totalTransactions = seller?.stats?.totalTransactions ?? 0;
  const activeListings = listings.filter((l) => l.isActive).length;
  const averageRating = seller?.rating ?? 0;

  // ── No venueId state ─────────────────────────────────────────────────────

  if (!venueId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store size={64} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Sin sede asignada</h2>
        <p className="text-slate-500 max-w-md">
          No tienes una sede o tienda vinculada a tu cuenta. Contacta a un administrador para configurarla.
        </p>
      </div>
    );
  }

  // ── Full-page loading (initial) ──────────────────────────────────────────

  if (loadingSeller) {
    return <LoadingSpinner fullPage />;
  }

  // ── Seller not found ─────────────────────────────────────────────────────

  if (!seller) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={64} className="text-amber-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Vendedor no encontrado</h2>
        <p className="text-slate-500 max-w-md">
          No se encontró información del vendedor para la sede <strong>{venueId}</strong>. Verifica que el perfil esté correctamente configurado.
        </p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={64} className="text-red-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Error</h2>
        <p className="text-slate-500 max-w-md">{error}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Store className="text-emerald-600" />
            {seller.name}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Panel de vendedor — {seller.location.city}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/product-manager"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
          >
            <Package size={18} />
            Gestionar Productos
          </Link>
          <Link
            to="/order-management"
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <ShoppingCart size={18} />
            Pedidos
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Ingresos Totales"
          value={formatCOP(totalRevenue)}
          icon={<DollarSign size={24} className="text-blue-600" />}
          color="#3B82F6"
        />

        <MetricCard
          title="Total Transacciones"
          value={totalTransactions.toLocaleString('es-CO')}
          icon={<TrendingUp size={24} className="text-purple-600" />}
          color="#8B5CF6"
        />

        <MetricCard
          title="Listados Activos"
          value={activeListings.toLocaleString('es-CO')}
          icon={<PackageOpen size={24} className="text-emerald-600" />}
          color="#10B981"
          subtitle="Productos y servicios publicados"
        />

        <MetricCard
          title="Calificación Promedio"
          value={`${averageRating.toFixed(1)} ★`}
          icon={<Star size={24} className="text-amber-500" />}
          color="#F59E0B"
          subtitle={`${seller.stats.totalTransactions} transacciones`}
        />
      </div>

      {/* Two-column layout: Transactions + Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock size={20} className="text-slate-500" />
              Transacciones Recientes
            </h2>
            <Link
              to="/my-transactions"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
            >
              Ver todas <ArrowUpRight size={12} />
            </Link>
          </div>

          {loadingTransactions ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShoppingCart size={40} className="mb-2 opacity-50" />
              <p className="text-sm">Sin transacciones aún</p>
              <p className="text-xs mt-1">Las ventas aparecerán aquí cuando recibas tu primer pedido.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {recentTransactions.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {tx.lineItems?.[0]?.title || `Transacción #${tx.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-slate-700">
                      {formatCOP(tx.totalAmount)}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        transactionStatusColor[tx.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {transactionStatusLabel[tx.status] || tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-slate-500" />
              Próximas Reservas
            </h2>
            <Link
              to="/order-management"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
            >
              Gestionar <ArrowUpRight size={12} />
            </Link>
          </div>

          {loadingBookings ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Calendar size={40} className="mb-2 opacity-50" />
              <p className="text-sm">Sin reservas próximas</p>
              <p className="text-xs mt-1">Las citas y reservas confirmadas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {upcomingBookings.slice(0, 10).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {booking.listingId ? `Reserva #${booking.listingId.slice(0, 8)}` : `Reserva #${booking.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(booking.startTime)} — {formatDateTime(booking.endTime)}
                    </p>
                    {booking.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 italic truncate">{booking.notes}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        bookingStatusColor[booking.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {bookingStatusLabel[booking.status] || booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Listings quick view */}
      {!loadingListings && listings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PackageOpen size={20} className="text-slate-500" />
              Mis Listados ({activeListings} activos)
            </h2>
            <Link
              to="/product-manager"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
            >
              Gestionar <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.slice(0, 8).map((listing) => (
              <div
                key={listing.id}
                className="p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                {listing.images?.[0] && (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                <h3 className="text-sm font-semibold text-slate-800 truncate">{listing.title}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCOP(listing.price)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      listing.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {listing.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {listing.stats?.sales ?? 0} ventas · {listing.stats?.views ?? 0} vistas
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading overlay for secondary data */}
      {(loadingListings || loadingTransactions || loadingBookings) && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-white rounded-full shadow-lg p-3 border border-slate-200">
            <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
