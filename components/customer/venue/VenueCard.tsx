import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Venue, RatingStats } from '../../../types';
import { Card } from '../common/Card';
import { Star, Heart, Flame, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { Countdown } from '../common/Countdown';
import { calculateDistance } from '../../../services/locationService';
import { useFavorites } from '../../../hooks/useFavorites';
import { useTranslation } from 'react-i18next';
import { isVenueOpen } from '../../../utils/venueAvailability';
import { Badge } from '../../ui/Badge';
import { Button } from '../common/Button';
import { Skeleton } from '../../ui/Skeleton';

interface VenueCardProps {
  venue: Venue;
  userLocation?: { lat: number; lng: number };
  soonestExpiry?: string; // ISO — soonest product expiry within 3h for this venue
  totalStock?: number;    // Total units available across all products
  productCount?: number;  // Number of distinct active products
  isTrending?: boolean;   // Venue has many orders recently
  hasDynamicPricing?: boolean; // At least one product has active dynamic (dropping) price
  ratingStats?: RatingStats | null; // Pre-cargado desde el padre para evitar N+1 queries
  onClick?: (venue: Venue) => void;
  variant?: 'card' | 'row';
  loading?: boolean;
}

// ── Deal Score: 0-100 combining discount + stock urgency + time urgency ────────
function computeDealScore(venue: Venue, soonestExpiry?: string, totalStock?: number): number {
  let score = 0;

  // Stock urgency: low stock = higher score
  if (totalStock !== undefined) {
    if (totalStock <= 2) score += 40;
    else if (totalStock <= 5) score += 25;
    else if (totalStock <= 10) score += 10;
  }

  // Time urgency: expiring soon = higher score
  if (soonestExpiry) {
    const msLeft = new Date(soonestExpiry).getTime() - Date.now();
    const hoursLeft = msLeft / (1000 * 60 * 60);
    if (hoursLeft <= 1) score += 45;
    else if (hoursLeft <= 2) score += 30;
    else if (hoursLeft <= 4) score += 15;
  }

  // Rating boost
  if (venue.rating >= 4.5) score += 15;
  else if (venue.rating >= 4.0) score += 8;

  return Math.min(100, score);
}

export const VenueCard: React.FC<VenueCardProps> = ({
  venue,
  userLocation,
  soonestExpiry,
  totalStock,
  productCount,
  isTrending,
  hasDynamicPricing,
  ratingStats,
  onClick,
  variant = 'card',
  loading,
}) => {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { t } = useTranslation();
  const isFav = isFavorite(venue.id);

  if (loading) {
    return <Skeleton.Card variant={variant === 'card' ? 'venue-card' : 'venue-row'} />;
  }

  const rawDistance = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, venue.latitude, venue.longitude)
    : null;
  const distance = rawDistance !== null && Number.isFinite(rawDistance) ? rawDistance : null;
  const showDistanceBadge = distance !== null && distance <= 120;
  const distanceLabel = distance !== null
    ? (distance < 1 ? '<1 km' : `${distance.toFixed(1)} km`)
    : '';

  const dealScore = computeDealScore(venue, soonestExpiry, totalStock);
  const isHotDeal = dealScore >= 60;
  const isLowStock = totalStock !== undefined && totalStock <= 3;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(venue.id);
  };

  const handleClick = () => {
    if (onClick) onClick(venue);
    else navigate(`/app/venue/${venue.id}`);
  };

  const openStatus = isVenueOpen(venue);

  if (variant === 'row') {
    return (
      <Card
        variant="interactive"
        padding="sm"
        className="flex flex-row gap-3 items-center overflow-hidden"
        onClick={handleClick}
      >
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
          <img
            src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/200/200`}
            alt={venue.name}
            className="w-full h-full object-cover"
          />
          {!openStatus && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-[10px] text-white font-black uppercase">Cerrado</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex justify-between items-start">
            <h3 className="text-sm font-black text-gray-900 truncate pr-2 group-hover:text-emerald-700 transition-colors">
              {venue.name}
            </h3>
            {isTrending && <Badge intent="trending" size="xs" icon={<Flame size={10} />} />}
          </div>
          
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
            <span className="truncate">{venue.neighborhood || venue.city || 'Sede'}</span>
            {distance !== null && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-emerald-600 font-bold whitespace-nowrap">{distanceLabel}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge intent={openStatus ? 'open' : 'closed'} size="xs">
              {openStatus ? t('open_until', { time: venue.closingTime }) : t('closed_now')}
            </Badge>
            {productCount !== undefined && productCount > 0 && (
              <Badge intent="rescue" size="xs">
                {productCount} {productCount === 1 ? t('cart_product') : t('cart_products')}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <Button variant="ghost" size="sm" className="px-1 text-emerald-600">
            <ChevronRight size={20} />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant="interactive"
      padding="none"
      className={`group overflow-hidden flex flex-col h-full ${!openStatus ? 'opacity-70' : ''}`}
      onClick={handleClick}
    >
      <div className="relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
        
        <button
          onClick={handleFavoriteClick}
          className={`absolute top-3 right-3 z-20 p-2 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-90 ${
            isFav ? 'bg-white text-red-500' : 'bg-black/20 text-white hover:bg-white hover:text-red-500'
          }`}
        >
          <Heart size={18} className={isFav ? 'fill-current' : ''} />
        </button>

        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
          {isTrending && (
            <Badge intent="trending" icon={<Flame size={12} />}>
              Trending
            </Badge>
          )}
          {isHotDeal && !isTrending && (
            <Badge intent="hot-deal" icon={<Zap size={12} />}>
              ¡Oferta hot!
            </Badge>
          )}
        </div>

        <img
          src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/600`}
          alt={venue.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2">
          {showDistanceBadge && (
            <Badge intent="distance">
              {distanceLabel}
            </Badge>
          )}
          {soonestExpiry && (
            <div className="scale-90 origin-left">
              <Countdown targetTime={soonestExpiry} showIcon />
            </div>
          )}
        </div>

        {hasDynamicPricing && !isLowStock && (
          <div className="absolute bottom-3 right-3 z-20">
            <Badge intent="dynamic-price" size="xs" icon={<TrendingUp size={10} />}>
              Bajando
            </Badge>
          </div>
        )}

        {(ratingStats?.averageRating ?? 0) > 0 && (
          <div className="absolute bottom-16 left-3 z-20 flex items-center gap-1 text-white font-bold text-sm drop-shadow-md">
            <Star size={14} className="text-yellow-400 fill-current" />
            <span>{ratingStats?.averageRating.toFixed(1)}</span>
            <span className="text-gray-300 text-xs font-normal">({ratingStats?.totalRatings})</span>
          </div>
        )}

        {venue.logoUrl && (
          <div className="absolute -bottom-4 right-4 z-20 w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white mb-6">
            <img src={venue.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-black text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">
            {venue.name}
          </h3>
          {dealScore >= 40 && (
            <div className="flex items-center gap-0.5 ml-2 flex-shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded-lg">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-xs font-black text-emerald-600">{dealScore}%</span>
            </div>
          )}
        </div>

        <p className="text-xs text-emerald-600 font-black uppercase tracking-wider mb-3">
          {venue.businessType || venue.categories?.[0] || 'Rescate'}
        </p>

        <p className="text-sm text-gray-500 flex items-center gap-1 mb-4 truncate">
          <span className="text-emerald-500">📍</span>
          {venue.address}
        </p>

        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <Badge intent={openStatus ? 'open' : 'closed'} size="xs">
              {openStatus ? t('open_until', { time: venue.closingTime }) : t('closed_now')}
            </Badge>
            {productCount !== undefined && productCount > 0 && (
              <span className="text-[10px] font-bold text-gray-400">
                {productCount} {productCount === 1 ? t('cart_product') : t('cart_products')} disp.
              </span>
            )}
          </div>
          
          <Button
            size="sm"
            variant="primary"
            className="rounded-xl font-black px-4"
          >
            Ver <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
