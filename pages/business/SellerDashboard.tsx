import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
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
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { ListingImageUpload } from '../../components/customer/listing/ListingImageUpload';
import { sellerService } from '../../services/sellerService';
import { transactionService } from '../../services/transactionService';
import { bookingService } from '../../services/bookingService';
import { listingService } from '../../services/listingService';
import { categoryService } from '../../services/categoryService';
import {
  Seller,
  Transaction,
  Booking,
  Listing,
  ListingType,
  DeliveryMethod,
  BookingStatus,
  TransactionStatus,
  Category,
  CategoryAttribute,
} from '../../types';
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

  // ── Listing CRUD modal state ─────────────────────────────────────────────

  const confirm = useConfirm();

  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [savingListing, setSavingListing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listingForm, setListingForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    type: ListingType.PRODUCT,
    price: '',
    quantity: '',
    deliveryMethods: [] as DeliveryMethod[],
    attributes: {} as Record<string, string>,
    images: [] as string[],
  });

  const resetListingForm = () => {
    setListingForm({
      title: '',
      description: '',
      categoryId: '',
      type: ListingType.PRODUCT,
      price: '',
      quantity: '',
      deliveryMethods: [],
      attributes: {},
      images: [],
    });
    setEditingListingId(null);
  };

  const reloadListings = useCallback(async () => {
    if (!sellerId) return;
    try {
      const l = await listingService.getListingsBySeller(sellerId);
      setListings(l);
    } catch {
      showToast('error', 'Error al actualizar listados');
    }
  }, [sellerId, showToast]);

  // ── Load categories when modal opens ─────────────────────────────────────

  useEffect(() => {
    if (isListingModalOpen && categories.length === 0) {
      (async () => {
        try {
          const cats = await categoryService.getRootCategories();
          setCategories(cats);
        } catch {
          // categories will be empty — user sees empty dropdown
        }
      })();
    }
  }, [isListingModalOpen, categories.length]);

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

  // ── Listing CRUD handlers ────────────────────────────────────────────────

  const openCreateListing = () => {
    resetListingForm();
    setIsListingModalOpen(true);
  };

  const openEditListing = (listing: Listing) => {
    setListingForm({
      title: listing.title,
      description: listing.description,
      categoryId: listing.categoryId,
      type: listing.type,
      price: String(listing.price),
      quantity: listing.quantity != null ? String(listing.quantity) : '',
      deliveryMethods: [...listing.deliveryMethods],
      attributes:
        typeof listing.attributes === 'object' && listing.attributes !== null
          ? Object.fromEntries(
              Object.entries(listing.attributes as Record<string, any>)
                .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                .map(([k, v]) => [k, String(v)]),
            )
          : {},
      images: [...listing.images],
    });
    setEditingListingId(listing.id);
    setIsListingModalOpen(true);
  };

  const handleListingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!listingForm.title.trim() || !listingForm.description.trim() || !listingForm.categoryId || !listingForm.price) {
      showToast('warning', 'Completa todos los campos requeridos');
      return;
    }

    const priceNum = parseFloat(listingForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast('warning', 'El precio debe ser un número válido');
      return;
    }

    const quantityNum = listingForm.quantity ? parseInt(listingForm.quantity) : undefined;
    if (listingForm.quantity && (isNaN(quantityNum!) || quantityNum! < 1)) {
      showToast('warning', 'La cantidad debe ser mayor a cero');
      return;
    }

    setSavingListing(true);

    try {
      const baseData = {
        sellerId: sellerId!,
        categoryId: listingForm.categoryId,
        type: listingForm.type,
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        images: listingForm.images,
        price: priceNum,
        quantity: listingForm.type === ListingType.SERVICE ? undefined : (quantityNum ?? 1),
        attributes: listingForm.attributes,
        isActive: true,
        isFeatured: false,
        deliveryMethods: listingForm.deliveryMethods.length > 0
          ? listingForm.deliveryMethods
          : [DeliveryMethod.PICKUP],
        stats: { views: 0, sales: 0, rating: 0 },
      };

      if (editingListingId) {
        await listingService.updateListing(editingListingId, baseData);
        showToast('success', 'Listing actualizado exitosamente');
      } else {
        await listingService.createListing(baseData);
        showToast('success', 'Listing creado exitosamente');
      }

      setIsListingModalOpen(false);
      resetListingForm();
      await reloadListings();
    } catch (err) {
      logger.error('SellerDashboard: error saving listing', err);
      showToast('error', editingListingId ? 'Error al actualizar el listing' : 'Error al crear el listing');
    } finally {
      setSavingListing(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    const confirmed = await confirm({
      title: '¿Eliminar listing?',
      message: 'Esta acción no se puede deshacer. El listing se eliminará permanentemente.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await listingService.deleteListing(listingId);
      showToast('success', 'Listing eliminado exitosamente');
      await reloadListings();
    } catch (err) {
      logger.error('SellerDashboard: error deleting listing', err);
      showToast('error', 'Error al eliminar el listing');
    }
  };

  // ── Delivery method toggle helper ───────────────────────────────────────

  const toggleDeliveryMethod = (method: DeliveryMethod) => {
    setListingForm((prev) => ({
      ...prev,
      deliveryMethods: prev.deliveryMethods.includes(method)
        ? prev.deliveryMethods.filter((m) => m !== method)
        : [...prev.deliveryMethods, method],
    }));
  };

  const deliveryMethodLabels: Record<DeliveryMethod, string> = {
    [DeliveryMethod.PICKUP]: 'Recogida',
    [DeliveryMethod.SHIPPING]: 'Envío',
    [DeliveryMethod.DIGITAL]: 'Digital',
    [DeliveryMethod.IN_PERSON]: 'En persona',
  };

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
          {seller.ownerId === user?.id && (
            <button
              onClick={openCreateListing}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
            >
              <Plus size={18} />
              Crear Listing
            </button>
          )}
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
                className="p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
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
                {seller.ownerId === user?.id && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditListing(listing); }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={12} />
                      Editar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteListing(listing.id); }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing CRUD Modal */}
      {isListingModalOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-hidden animate-in fade-in duration-300"
          onClick={() => { if (!savingListing) { setIsListingModalOpen(false); resetListingForm(); } }}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-200 cursor-default max-h-[90vh] overflow-y-auto flex flex-col border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Package size={20} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  {editingListingId ? 'Editar Listing' : 'Nuevo Listing'}
                </h3>
              </div>
              <button
                onClick={() => { setIsListingModalOpen(false); resetListingForm(); }}
                disabled={savingListing}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-50 rounded-full transition-colors disabled:opacity-30"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleListingSubmit} className="space-y-5">
              {/* Título */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: iPhone 15 Pro 256GB"
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                  value={listingForm.title}
                  onChange={e => setListingForm({ ...listingForm, title: e.target.value })}
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Descripción *
                </label>
                <textarea
                  required
                  placeholder="Describe tu producto o servicio..."
                  rows={3}
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium resize-none"
                  value={listingForm.description}
                  onChange={e => setListingForm({ ...listingForm, description: e.target.value })}
                />
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Categoría *
                </label>
                <select
                  required
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                  value={listingForm.categoryId}
                  onChange={e => setListingForm({ ...listingForm, categoryId: e.target.value })}
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Tipo *
                </label>
                <select
                  required
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                  value={listingForm.type}
                  onChange={e => setListingForm({ ...listingForm, type: e.target.value as ListingType })}
                >
                  <option value={ListingType.PRODUCT}>Producto</option>
                  <option value={ListingType.SERVICE}>Servicio</option>
                  <option value={ListingType.DIGITAL}>Digital</option>
                </select>
              </div>

              {/* Precio */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Precio (COP) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="100"
                  placeholder="Ej: 50000"
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                  value={listingForm.price}
                  onChange={e => setListingForm({ ...listingForm, price: e.target.value })}
                />
              </div>

              {/* Cantidad */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Cantidad {listingForm.type === ListingType.SERVICE ? '(opcional — ilimitado si se deja vacío)' : '*'}
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={listingForm.type === ListingType.SERVICE ? 'Vacío = ilimitado' : 'Ej: 10'}
                  className="w-full px-5 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-gray-900 font-medium"
                  value={listingForm.quantity}
                  onChange={e => setListingForm({ ...listingForm, quantity: e.target.value })}
                />
              </div>

              {/* Métodos de entrega */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Métodos de entrega
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(DeliveryMethod).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleDeliveryMethod(method)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 border ${
                        listingForm.deliveryMethods.includes(method)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {deliveryMethodLabels[method]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Atributos dinámicos (key-value) */}
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2 hover:text-gray-600">
                  Atributos adicionales
                  <span className="text-emerald-500 text-xs">(opcional)</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {Object.entries(listingForm.attributes).map(([key, value], i) => (
                    <div key={i} className="flex gap-2 items-center animate-in fade-in">
                      <input
                        type="text"
                        placeholder="Clave"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-emerald-500 outline-none"
                        value={key}
                        onChange={e => {
                          const newAttrs = { ...listingForm.attributes };
                          delete newAttrs[key];
                          const newKey = e.target.value;
                          newAttrs[newKey || `attr_${Date.now()}`] = value;
                          setListingForm({ ...listingForm, attributes: newAttrs });
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Valor"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-emerald-500 outline-none"
                        value={value}
                        onChange={e => {
                          const newAttrs = { ...listingForm.attributes };
                          newAttrs[key] = e.target.value;
                          setListingForm({ ...listingForm, attributes: newAttrs });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newAttrs = { ...listingForm.attributes };
                          delete newAttrs[key];
                          setListingForm({ ...listingForm, attributes: newAttrs });
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setListingForm({
                        ...listingForm,
                        attributes: { ...listingForm.attributes, '': '' },
                      });
                    }}
                    className="w-full py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={14} />
                    Añadir atributo
                  </button>
                </div>
              </details>

              {/* Imágenes */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Imágenes
                </label>
                <ListingImageUpload
                  images={listingForm.images}
                  onImagesChange={(urls) => setListingForm({ ...listingForm, images: urls })}
                  maxImages={5}
                  sellerId={sellerId!}
                  listingId={editingListingId ?? undefined}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsListingModalOpen(false); resetListingForm(); }}
                  disabled={savingListing}
                  className="flex-1 py-4 text-gray-500 hover:bg-gray-100 rounded-2xl transition-colors font-black uppercase tracking-widest text-[10px] disabled:opacity-30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingListing}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 hover:shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] active:scale-95 disabled:opacity-50"
                >
                  {savingListing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {editingListingId ? 'Guardar Cambios' : 'Crear Listing'}
                </button>
              </div>
            </form>
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
