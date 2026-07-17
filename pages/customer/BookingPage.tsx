import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { listingService } from '../../services/listingService';
import { sellerService } from '../../services/sellerService';
import { Listing, Seller } from '../../types';
import { useToast } from '../../context/ToastContext';
import BookingSlotPicker from '../../components/customer/booking/BookingSlotPicker';
import { SEO } from '../../components/common/SEO';
import { ErrorState } from '../../components/common/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/customer/common/Button';
import { ArrowLeft, Clock, MapPin, Star, Calendar, Wrench, Info } from 'lucide-react';
import { formatCOP } from '../../utils/formatters';
import { logger } from '../../utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera slots disponibles: próximos 7 días, de 8 AM a 6 PM, cada hora.
 * En producción, estos vendrían de la disponibilidad real del seller.
 */
function generateAvailableSlots(): string[] {
  const slots: string[] = [];
  const now = new Date();
  const startHour = 8;
  const endHour = 18;

  for (let day = 0; day < 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    date.setMinutes(0, 0, 0);

    for (let hour = startHour; hour <= endHour; hour++) {
      date.setHours(hour);
      // Skip past slots on today
      if (day === 0 && date.getTime() <= now.getTime()) continue;
      slots.push(date.toISOString());
    }
  }

  return slots;
}

/** Calcula endTime a partir de startTime + duración. */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
}

// ─── Component ───────────────────────────────────────────────────────────────

const BookingPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  // Data
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Booking state
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState('');

  // Duración del servicio desde attributes o default 60 min
  const duration = useMemo(() => {
    const attrDuration = listing?.attributes?.duration;
    if (typeof attrDuration === 'number') return attrDuration;
    if (typeof attrDuration === 'string') {
      const parsed = parseInt(attrDuration, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 60; // default 1 hora
  }, [listing]);

  // Slots disponibles
  const availableSlots = useMemo(() => generateAvailableSlots(), []);

  // ─── Data loading ────────────────────────────────────────────────────────────

  const loadData = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const listingData = await listingService.getListingById(id);
      if (!listingData) {
        setListing(null);
        return;
      }
      setListing(listingData);

      // Cargar seller usando sellerId del listing
      if (listingData.sellerId) {
        const sellerData = await sellerService.getById(listingData.sellerId);
        setSeller(sellerData);
      }
    } catch (err: any) {
      logger.error('BookingPage loadData error:', err);
      setLoadError(err instanceof Error ? err : new Error('Error al cargar la información'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (listingId) loadData(listingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  // ─── Booking confirmation ────────────────────────────────────────────────────

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !listing || !listingId) return;

    setConfirming(true);
    try {
      const endTime = calculateEndTime(selectedSlot, duration);
      const createBookingFn = httpsCallable<
        { sellerId: string; listingId: string; startTime: string; endTime: string; notes?: string },
        { success: boolean; bookingId: string }
      >(functions, 'createBooking');

      await createBookingFn({
        sellerId: listing.sellerId,
        listingId,
        startTime: selectedSlot,
        endTime,
        notes: notes.trim() || undefined,
      });

      success('¡Reserva confirmada! Revisa tus órdenes para más detalles.');
      navigate('/app/orders', { replace: true });
    } catch (err: any) {
      logger.error('BookingPage confirm error:', err);
      showError(err?.message || 'Error al confirmar la reserva. Intenta de nuevo.');
    } finally {
      setConfirming(false);
    }
  };

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50" data-testid="booking-page-skeleton">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Skeleton.Block h={40} w={40} rounded="full" />
          <Skeleton.Block h={24} w="60%" rounded="md" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Skeleton.Block h={200} w="100%" rounded="2xl" />
        <Skeleton.Block h={32} w="75%" rounded="lg" />
        <Skeleton.Block h={16} w="50%" rounded="md" />
        <Skeleton.Block h={300} w="100%" rounded="2xl" />
      </div>
    </div>
  );

  // ─── Error state ─────────────────────────────────────────────────────────────

  if (loadError) return (
    <ErrorState
      error={loadError}
      title="No pudimos cargar la reserva"
      message="Verifica tu conexión e intenta de nuevo."
      resetErrorBoundary={() => { if (listingId) loadData(listingId); }}
    />
  );

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (!listing) return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <Info size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Servicio no encontrado</h2>
          <p className="text-gray-500 mb-6 text-sm">
            El servicio que buscas no existe o ha sido eliminado.
          </p>
          <Button onClick={() => navigate('/app')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Slug ────────────────────────────────────────────────────────────────────

  const displayRating = listing.stats?.rating || 0;
  const hasDiscount = listing.originalPrice && listing.originalPrice > listing.price;
  const discountPct = hasDiscount
    ? Math.round((1 - listing.price / (listing.originalPrice || listing.price)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={`Reservar: ${listing.title}`}
        description={listing.description?.slice(0, 160) || `Reserva ${listing.title}`}
      />

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Volver"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 text-base truncate flex-1 ml-2">
            Reservar servicio
          </h1>
          <div className="w-10" /> {/* Spacer para centrar */}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Listing info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Image */}
          {listing.images?.[0] ? (
            <div className="h-48 overflow-hidden">
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-48 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Wrench size={48} className="text-white/30" />
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* Title + price */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-gray-900 leading-tight">
                  {listing.title}
                </h2>
                {listing.description && (
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed line-clamp-3">
                    {listing.description}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {hasDiscount && (
                  <span className="block text-xs text-gray-400 line-through">
                    {formatCOP(listing.originalPrice!)}
                  </span>
                )}
                <span className="text-2xl font-black text-emerald-600">
                  {formatCOP(listing.price)}
                </span>
                {hasDiscount && (
                  <span className="block text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                    -{discountPct}%
                  </span>
                )}
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full font-bold">
                <Clock size={12} />
                {duration} min
              </span>
              {displayRating > 0 && (
                <span className="flex items-center gap-1 bg-yellow-50 px-2.5 py-1 rounded-full font-bold text-yellow-700">
                  <Star size={12} className="fill-yellow-500 text-yellow-500" />
                  {displayRating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Seller info card */}
        {seller && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-3">
              Proveedor
            </h3>
            <div className="flex items-center gap-4">
              {/* Logo / Avatar */}
              {seller.logo ? (
                <img
                  src={seller.logo}
                  alt={seller.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-lg">
                    {seller.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{seller.name}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  {seller.location?.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span className="truncate max-w-[180px]">{seller.location.address}</span>
                    </span>
                  )}
                  {seller.rating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star size={12} className="fill-yellow-500 text-yellow-500" />
                      {seller.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time slot picker */}
        <BookingSlotPicker
          availableSlots={availableSlots}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
          duration={duration}
        />

        {/* Notes field */}
        {selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <label className="block text-sm font-bold text-gray-700">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Prefiero horario de la tarde, tengo mascota..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none placeholder:text-gray-400"
            />
          </div>
        )}

        {/* Confirm button */}
        {selectedSlot && (
          <div className="pb-4">
            <button
              onClick={handleConfirmBooking}
              disabled={confirming}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
            >
              {confirming ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Confirmando...
                </>
              ) : (
                <>
                  <Calendar size={20} />
                  Confirmar reserva — {formatCOP(listing.price)}
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              No se realizará ningún cobro hasta que el proveedor confirme la reserva.
            </p>
          </div>
        )}

        {/* Bottom spacer for mobile nav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default BookingPage;
