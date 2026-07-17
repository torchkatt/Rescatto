import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sellerService } from '../../services/sellerService';
import { listingService } from '../../services/listingService';
import { venueService } from '../../services/venueService';
import { Seller, Listing, ListingType, RatingStats } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/customer/common/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ArrowLeft, MapPin, Star, ShoppingCart, Search, X, Heart, Package, Wrench, Download, Clock } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { getRatingStats } from '../../services/ratingService';
import { logger } from '../../utils/logger';
import { formatCOP } from '../../utils/formatters';
import { SEO } from '../../components/common/SEO';
import { ErrorState } from '../../components/common/ErrorState';
import { useRetry } from '../../hooks/useRetry';
import { useTranslation } from 'react-i18next';

// ── Listing card helpers ──────────────────────────────────────────────────────

function getListingTypeIcon(type: ListingType): React.ReactNode {
  switch (type) {
    case ListingType.PRODUCT: return <Package size={14} />;
    case ListingType.SERVICE: return <Wrench size={14} />;
    case ListingType.DIGITAL: return <Download size={14} />;
    default: return <Package size={14} />;
  }
}

function getListingTypeLabel(type: ListingType, t: any): string {
  switch (type) {
    case ListingType.PRODUCT: return t('seller_type_product', 'Producto');
    case ListingType.SERVICE: return t('seller_type_service', 'Servicio');
    case ListingType.DIGITAL: return t('seller_type_digital', 'Digital');
    default: return type;
  }
}

function getDiscountBadge(original: number, price: number): string {
  if (!original || original <= 0 || price >= original) return '';
  const pct = Math.round((1 - price / original) * 100);
  if (pct >= 60) return `🔥 -${pct}%`;
  if (pct >= 40) return `-${pct}%`;
  return `-${pct}%`;
}

const LISTING_TABS: Array<{ type: 'all' | ListingType; icon: string }> = [
  { type: 'all', icon: '📋' },
  { type: ListingType.PRODUCT, icon: '📦' },
  { type: ListingType.SERVICE, icon: '🛠️' },
  { type: ListingType.DIGITAL, icon: '💾' },
];

export const SellerDetail: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { executeWithRetry } = useRetry();
  const { success, error } = useToast();
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [listingSearch, setListingSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ListingType>('all');

  const loadSellerData = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      // 1. Intentar sellerService primero (nuevo), fallback a venueService (legacy)
      let sellerData = await executeWithRetry(
        () => sellerService.getById(id),
        { maxRetries: 2, initialDelay: 800 }
      );

      // Dual-read fallback: si no encuentra en sellers, busca en venues
      if (!sellerData) {
        const venueData = await venueService.getVenueById(id);
        if (venueData) {
          // Convertir Venue a Seller via el mismo adapter que usa sellerService internamente
          // Como no podemos llamar a venueToSeller (es privada), construimos manualmente
          sellerData = {
            id: venueData.id,
            name: venueData.name,
            type: 'food' as any,
            categoryIds: [],
            ownerId: venueData.ownerId || '',
            location: {
              lat: venueData.latitude,
              lng: venueData.longitude,
              address: venueData.address,
              city: venueData.city || '',
              neighborhood: (venueData as any).neighborhood,
            },
            logo: venueData.logoUrl || venueData.imageUrl,
            coverImage: venueData.coverImageUrl,
            description: '',
            contact: { phone: venueData.phone },
            rating: venueData.rating || 0,
            stats: {
              totalTransactions: venueData.stats?.totalOrders || 0,
              totalRevenue: venueData.stats?.totalRevenue || 0,
            },
            isActive: true,
            subscription: 'free',
            createdAt: new Date().toISOString(),
          } as Seller;
        }
      }

      setSeller(sellerData);

      if (sellerData) {
        // 2. Cargar listings y rating stats en paralelo
        const [listingsResult, statsResult] = await Promise.allSettled([
          executeWithRetry(
            () => listingService.getListingsBySeller(id),
            { maxRetries: 2, initialDelay: 800 }
          ),
          getRatingStats(id, 'venue'),
        ]);

        if (listingsResult.status === 'fulfilled') {
          setListings(listingsResult.value);
        } else {
          logger.error('Failed to load listings:', listingsResult.reason);
        }

        if (statsResult.status === 'fulfilled' && statsResult.value) {
          setRatingStats(statsResult.value);
        }
      }
    } catch (err: any) {
      logger.error('Failed to load seller', err);
      setLoadError(err instanceof Error ? err : new Error('Error al cargar el vendedor'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sellerId) loadSellerData(sellerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredListings = useMemo(() => {
    return listings.filter(l => {
      const matchesSearch = !listingSearch ||
        l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
        (l.description || '').toLowerCase().includes(listingSearch.toLowerCase());
      const matchesType = selectedType === 'all' || l.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [listings, listingSearch, selectedType]);

  // Counts per tab
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: listings.length };
    listings.forEach(l => {
      counts[l.type] = (counts[l.type] || 0) + 1;
    });
    return counts;
  }, [listings]);

  // ── Loading / Error / Empty states ────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-8" data-testid="seller-detail-skeleton">
      <Skeleton.Block h={256} w="100%" rounded="md" />
      <div className="max-w-7xl mx-auto px-4">
        <Skeleton.Block h={32} w="60%" rounded="lg" className="mb-4" />
        <Skeleton.Block h={16} w="40%" rounded="md" className="mb-6" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map(i => <Skeleton.Block key={i} h={36} w={100} rounded="full" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton.Block h={160} w="100%" rounded="xl" />
              <Skeleton.Block h={20} w="80%" rounded="md" />
              <Skeleton.Block h={16} w="50%" rounded="md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loadError) return (
    <ErrorState
      error={loadError}
      title="No pudimos cargar el vendedor"
      message="Verifica tu conexión e intenta de nuevo."
      resetErrorBoundary={() => { if (sellerId) loadSellerData(sellerId); }}
    />
  );

  if (!seller) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('seller_not_found', 'Vendedor no encontrado')}</h2>
          <Button onClick={() => navigate('/app')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {t('venue_back_home')}
          </Button>
        </div>
      </div>
    );
  }

  const displayRating = ratingStats && ratingStats.totalRatings > 0
    ? ratingStats
    : seller.rating > 0 ? { averageRating: seller.rating, totalRatings: 0 } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title={seller.name}
        description={t('seller_seo_desc', { name: seller.name, address: seller.location.address, defaultValue: `Explora lo que ofrece ${seller.name}. ${seller.location.address}.` })}
        image={seller.coverImage || seller.logo}
        type="website"
      />

      {/* ── HERO ── */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-56 md:h-72 lg:h-80 xl:h-[360px] overflow-hidden relative">
          {seller.coverImage ? (
            <img
              src={seller.coverImage}
              alt={seller.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/25" />

          {/* Floating Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-safe left-4 mt-4 z-50 p-3 bg-white/80 backdrop-blur-md rounded-full shadow-lg text-gray-800 hover:bg-white active:scale-95 transition-all"
          >
            <ArrowLeft size={20} className="text-gray-800" />
          </button>

          {/* Favorite button */}
          {sellerId && (
            <button
              onClick={() => toggleFavorite(sellerId)}
              aria-label={isFavorite(sellerId) ? t('venue_remove_fav') : t('venue_add_fav')}
              className="absolute top-safe right-4 mt-4 p-2.5 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 border border-white/20 shadow-lg active:scale-90 transition-all"
            >
              <Heart
                size={20}
                className={isFavorite(sellerId) ? 'text-red-400 fill-red-400' : 'text-white'}
              />
            </button>
          )}

          {/* Desktop: seller name overlay */}
          <div className="absolute bottom-0 left-0 right-0 hidden lg:block px-8 pb-8">
            <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 bg-emerald-500/90 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {t('seller_active', 'Activo')}
                </span>
                <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-tight">
                  {seller.name}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  {displayRating && (
                    <div className="flex items-center gap-1.5">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-white font-black">{displayRating.averageRating.toFixed(1)}</span>
                      {displayRating.totalRatings > 0 && (
                        <span className="text-white/60 text-sm">({displayRating.totalRatings})</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-white/80 text-sm">
                    <Package size={14} />
                    <span>{t('seller_listings_count', { count: listings.length, defaultValue: `${listings.length} publicaciones` })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70 text-sm">
                    <MapPin size={14} />
                    <span>{seller.location.address}</span>
                  </div>
                </div>
              </div>
              {seller.logo && (
                <img
                  src={seller.logo}
                  alt={seller.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30 shadow-2xl flex-shrink-0"
                />
              )}
            </div>
          </div>
        </div>

        {/* Mobile: seller info card */}
        <div className="lg:hidden max-w-7xl mx-auto px-4 -mt-12 relative z-10 pb-2">
          <div className="bg-white rounded-2xl px-4 py-4 shadow-xl border border-gray-100/80">
            <div className="flex items-center gap-3">
              {seller.logo ? (
                <img
                  src={seller.logo}
                  alt={seller.name}
                  className="w-14 h-14 rounded-xl object-cover border border-gray-100 shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                  {seller.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h1 className="text-base font-black text-gray-900 leading-tight">{seller.name}</h1>
                  <span className="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t('seller_active', 'Activo')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  {displayRating && (
                    <span className="flex items-center gap-1">
                      <Star size={11} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-gray-700">{displayRating.averageRating.toFixed(1)}</span>
                      {displayRating.totalRatings > 0 && (
                        <span className="text-gray-400">({displayRating.totalRatings})</span>
                      )}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Package size={11} className="text-indigo-600" />
                    <span>{listings.length} publicaciones</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400">
                  <MapPin size={10} className="flex-shrink-0" />
                  <span className="truncate">{seller.location.address}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: info bar */}
        <div className="hidden lg:block bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{listings.length} {t('seller_listings', 'publicaciones')}</span>
              {listings.length > 0 && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="text-indigo-600 font-bold">
                    {typeCounts[ListingType.PRODUCT] || 0} {t('seller_type_product', 'Productos')} ·{' '}
                    {typeCounts[ListingType.SERVICE] || 0} {t('seller_type_service', 'Servicios')} ·{' '}
                    {typeCounts[ListingType.DIGITAL] || 0} {t('seller_type_digital', 'Digital')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── LISTINGS SECTION ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 pb-10">

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            {t('seller_listings_title', 'Publicaciones')}
          </h2>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {filteredListings.length} {t('prod_of', 'de')} {listings.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={17} />
          <input
            type="text"
            placeholder={t('seller_search_ph', 'Buscar publicación...')}
            value={listingSearch}
            onChange={e => setListingSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm transition-all"
          />
          {listingSearch && (
            <button
              onClick={() => setListingSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Type tabs */}
        <div className="relative mb-5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {LISTING_TABS.map(tab => (
              <button
                key={tab.type}
                onClick={() => setSelectedType(tab.type)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  selectedType === tab.type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.type === 'all'
                  ? t('cat_all')
                  : getListingTypeLabel(tab.type, t)
                }
                {typeCounts[tab.type] !== undefined && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    selectedType === tab.type ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {typeCounts[tab.type]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none lg:hidden" />
        </div>

        {/* Empty states */}
        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center border border-gray-100 shadow-sm">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold text-gray-700 mb-1">{t('seller_no_listings', 'No hay publicaciones todavía')}</p>
            <p className="text-sm text-gray-400">{t('seller_check_back', 'Vuelve más tarde para ver qué ofrece este vendedor')}</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
            <Search size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="font-bold text-gray-600 mb-1">{t('venue_no_results', { query: listingSearch })}</p>
            <button
              onClick={() => { setListingSearch(''); setSelectedType('all'); }}
              className="mt-2 text-indigo-600 text-sm font-bold hover:underline"
            >
              {t('venue_clear_filters')}
            </button>
          </div>
        ) : (
          <>
            {/* Mobile: horizontal cards */}
            <div className="flex flex-col gap-3 lg:hidden">
              {filteredListings.map(listing => {
                const imageUrl = listing.images?.[0];
                const hasDiscount = listing.originalPrice && listing.originalPrice > listing.price;
                const discountBadge = hasDiscount ? getDiscountBadge(listing.originalPrice!, listing.price) : '';
                const discountPct = hasDiscount ? Math.round((1 - listing.price / listing.originalPrice!) * 100) : 0;

                return (
                  <div
                    key={listing.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
                    onClick={() => navigate(`/app/listing/${listing.id}`)}
                  >
                    <div className="flex gap-0">
                      {/* Image */}
                      <div className="relative w-28 h-28 flex-shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl">
                            {listing.type === ListingType.PRODUCT ? '📦' : listing.type === ListingType.SERVICE ? '🛠️' : '💾'}
                          </div>
                        )}
                        {discountBadge && (
                          <div className="absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-lg text-white bg-indigo-600">
                            {discountBadge}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                        <div>
                          <p className="font-black text-gray-900 text-sm leading-tight line-clamp-2 mb-0.5">{listing.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-indigo-600 font-bold">
                              {getListingTypeLabel(listing.type, t)}
                            </span>
                          </div>
                          {listing.type === ListingType.SERVICE && listing.attributes?.duration && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                              <Clock size={10} />
                              <span>{listing.attributes.duration}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div>
                            <p className="text-base font-black leading-none text-indigo-600">
                              {formatCOP(listing.price)}
                            </p>
                            {hasDiscount && (
                              <p className="text-[11px] text-gray-400 line-through">{formatCOP(listing.originalPrice!)}</p>
                            )}
                          </div>
                          {listing.type !== ListingType.SERVICE && listing.quantity !== undefined && listing.quantity <= 5 && listing.quantity > 0 && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              {listing.quantity === 1 ? '¡Último!' : `¡Solo ${listing.quantity}!`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: grid */}
            <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredListings.map(listing => {
                const imageUrl = listing.images?.[0];
                const hasDiscount = listing.originalPrice && listing.originalPrice > listing.price;
                const discountBadge = hasDiscount ? getDiscountBadge(listing.originalPrice!, listing.price) : '';
                const discountPct = hasDiscount ? Math.round((1 - listing.price / listing.originalPrice!) * 100) : 0;

                return (
                  <div
                    key={listing.id}
                    className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group border ${
                      discountPct >= 50 ? 'border-red-100 hover:border-red-200' : 'border-gray-100 hover:border-indigo-200'
                    }`}
                    onClick={() => navigate(`/app/listing/${listing.id}`)}
                  >
                    <div className="relative overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={listing.title}
                          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl">
                          {listing.type === ListingType.PRODUCT ? '📦' : listing.type === ListingType.SERVICE ? '🛠️' : '💾'}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                      {/* Type badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-black text-gray-700 shadow-sm">
                        {getListingTypeIcon(listing.type)}
                        <span>{getListingTypeLabel(listing.type, t)}</span>
                      </div>

                      {discountBadge && (
                        <div className={`absolute top-2 right-2 px-2 py-1 rounded-xl text-white text-[11px] font-black shadow-md ${
                          discountPct >= 50 ? 'bg-red-500' : 'bg-indigo-600'
                        }`}>
                          {discountBadge}
                        </div>
                      )}

                      {/* Service-specific: duration badge */}
                      {listing.type === ListingType.SERVICE && listing.attributes?.duration && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Clock size={10} />
                          {listing.attributes.duration}
                        </div>
                      )}

                      {/* Digital-specific: download badge */}
                      {listing.type === ListingType.DIGITAL && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Download size={10} />
                          {t('seller_digital_download', 'Descarga')}
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-black text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2 text-sm leading-snug">
                        {listing.title}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 mb-3">{listing.description}</p>

                      {/* Attributes row — varies by type */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {listing.type === ListingType.PRODUCT && listing.quantity !== undefined && listing.quantity > 0 && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            {listing.quantity} {t('seller_stock', 'en stock')}
                          </span>
                        )}
                        {listing.type === ListingType.SERVICE && listing.attributes?.modality && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {listing.attributes.modality}
                          </span>
                        )}
                        {listing.type === ListingType.DIGITAL && listing.attributes?.fileFormat && (
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                            {listing.attributes.fileFormat}
                          </span>
                        )}
                      </div>

                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <p className="text-xl font-black text-indigo-600">
                            {formatCOP(listing.price)}
                          </p>
                          {hasDiscount && (
                            <p className="text-xs text-gray-400 line-through">{formatCOP(listing.originalPrice!)}</p>
                          )}
                        </div>
                        {hasDiscount && (
                          <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            discountPct >= 50 ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {t('venue_savings', { amount: formatCOP(listing.originalPrice! - listing.price) })}
                          </div>
                        )}
                      </div>

                      {/* CTA button */}
                      <Button
                        onClick={e => { e.stopPropagation(); navigate(`/app/listing/${listing.id}`); }}
                        className="w-full font-black text-sm"
                      >
                        {listing.type === ListingType.PRODUCT && (
                          <><ShoppingCart size={15} />{' '}{t('seller_view_product', 'Ver producto')}</>
                        )}
                        {listing.type === ListingType.SERVICE && (
                          <><Clock size={15} />{' '}{t('seller_book_service', 'Reservar')}</>
                        )}
                        {listing.type === ListingType.DIGITAL && (
                          <><Download size={15} />{' '}{t('seller_get_digital', 'Obtener')}</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SellerDetail;
