import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { venueService } from '../../services/venueService';
import { Venue, RatingStats, Product } from '../../types';
import { getRatingStats } from '../../services/ratingService';
import { useTranslation } from 'react-i18next';
import { isVenueOpen } from '../../utils/venueAvailability';
import { useLocation } from '../../context/LocationContext';
import { OnboardingTour } from '../../components/customer/OnboardingTour';
import { calculateDistance } from '../../services/locationService';
import { productService } from '../../services/productService';
import { logger } from '../../utils/logger';
import { SEO } from '../../components/common/SEO';
import { ErrorState } from '../../components/common/ErrorState';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

// New Components
import { Skeleton } from '../../components/ui/Skeleton';
import { HeroSection } from '../../components/customer/home/HeroSection';
import { ProductsSection } from '../../components/customer/home/ProductsSection';
import { VenuesSection } from '../../components/customer/home/VenuesSection';

const CustomerHome: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { city, latitude, longitude } = useLocation();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Data Maps
  const [venueExpiryMap, setVenueExpiryMap] = useState<Map<string, string>>(new Map());
  const [venueStockMap, setVenueStockMap] = useState<Map<string, number>>(new Map());
  const [venueProductCountMap, setVenueProductCountMap] = useState<Map<string, number>>(new Map());
  const [dynamicVenueIds, setDynamicVenueIds] = useState<Set<string>>(new Set());
  const [venueRatingMap, setVenueRatingMap] = useState<Map<string, RatingStats>>(new Map());
  const [allActiveProducts, setAllActiveProducts] = useState<Product[]>([]);

  // Pagination
  const [venuesLastDoc, setVenuesLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreVenues, setHasMoreVenues] = useState(true);
  const [loadingMoreVenues, setLoadingMoreVenues] = useState(false);

  const { onOpenLocation, onOpenSearch } = useOutletContext<{
    openImpact: () => void;
    onOpenLocation: () => void;
    onOpenSearch: () => void;
  }>();

  const userId = user?.id;

  useEffect(() => {
    const fetchInitial = async () => {
      if (loading === false && !userId) return;
      setFetchError(null);
      try {
        setLoading(true);
        const [venuesPage, expiryMap, stockResult, dynIds, activeProductsPage] = await Promise.all([
          venueService.getAllVenuesPage(city || undefined, null, 20),
          venueService.getExpiringProductsByVenue(),
          venueService.getStockCountByVenue(),
          venueService.getDynamicPricingVenueIds(),
          productService.getAllActiveProductsPage(city || undefined, null, 50), // Load more for discovery
        ]);

        setVenues(venuesPage.venues);
        setVenuesLastDoc(venuesPage.lastDoc);
        setHasMoreVenues(venuesPage.hasMore);
        setVenueExpiryMap(expiryMap);
        setVenueStockMap(stockResult.stockMap);
        setVenueProductCountMap(stockResult.productCountMap);
        setDynamicVenueIds(dynIds);
        setAllActiveProducts(activeProductsPage.products);

        const ratingMap = new Map<string, RatingStats>();
        await Promise.all(
          venuesPage.venues.map(async (v) => {
            try {
              const stats = await getRatingStats(v.id, 'venue');
              if (stats) ratingMap.set(v.id, stats);
            } catch (e) { /* silent */ }
          })
        );
        setVenueRatingMap(ratingMap);
      } catch (error: any) {
        if (error?.code !== 'permission-denied') {
          logger.error('Error fetching home data:', error);
          setFetchError(error instanceof Error ? error : new Error('Error al cargar datos'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [userId, city]);

  const loadMoreVenues = async () => {
    if (!hasMoreVenues || loadingMoreVenues) return;
    setLoadingMoreVenues(true);
    try {
      const nextPage = await venueService.getAllVenuesPage(city || undefined, venuesLastDoc, 20);
      setVenues((prev) => [...prev, ...nextPage.venues]);
      setVenuesLastDoc(nextPage.lastDoc);
      setHasMoreVenues(nextPage.hasMore);

      if (nextPage.venues.length > 0) {
        const newRatings = new Map<string, RatingStats>(venueRatingMap);
        await Promise.all(
          nextPage.venues.map(async (v) => {
            try {
              const stats = await getRatingStats(v.id, 'venue');
              if (stats) newRatings.set(v.id, stats);
            } catch (e) { /* silent */ }
          })
        );
        setVenueRatingMap(newRatings);
      }
    } catch (error) {
      logger.error('Error loading more venues:', error);
    } finally {
      setLoadingMoreVenues(false);
    }
  };

  const userLocation = useMemo(() => 
    latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : undefined
  , [latitude, longitude]);

  const sortedVenues = useMemo(() => {
    if (!userLocation) return venues;
    return [...venues].sort((a, b) => {
      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      return (distA || 999) - (distB || 999);
    });
  }, [venues, userLocation]);

  const allVenuesSorted = useMemo(() => {
    const open: Venue[] = [];
    const closed: Venue[] = [];
    sortedVenues.forEach((v) => {
      if (isVenueOpen(v) && venueStockMap.has(v.id)) {
        open.push(v);
      } else {
        closed.push(v);
      }
    });
    return [...open, ...closed];
  }, [sortedVenues, venueStockMap]);

  const venuesById = useMemo(() => {
    const map = new Map<string, Venue>();
    venues.forEach((v) => map.set(v.id, v));
    return map;
  }, [venues]);

  const venueNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    venues.forEach((v) => map.set(v.id, v.name));
    return map;
  }, [venues]);

  const heroDeal = useMemo(() => {
    if (allActiveProducts.length === 0) return null;
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    let best: { product: Product; score: number; discountPct: number } | null = null;

    for (const p of allActiveProducts) {
      const venue = venuesById.get(p.venueId);
      if (!venue || !isVenueOpen(venue)) continue;
      if (p.originalPrice <= 0) continue;

      const price = p.dynamicDiscountedPrice || p.discountedPrice;
      const discountPct = (p.originalPrice - price) / p.originalPrice;
      const msLeft = new Date(p.availableUntil).getTime() - now;
      if (msLeft <= 0 || msLeft > TWENTY_FOUR_HOURS) continue;

      const urgencyScore = 1 - msLeft / TWENTY_FOUR_HOURS;
      const score = discountPct * 0.6 + urgencyScore * 0.4;

      if (!best || score > best.score) {
        best = { product: p, score, discountPct: Math.round(discountPct * 100) };
      }
    }

    return best;
  }, [allActiveProducts, venuesById]);

  const bestDiscountProducts = useMemo(() => {
    return allActiveProducts
      .filter((p) => {
        const venue = venuesById.get(p.venueId);
        return venue && isVenueOpen(venue) && p.originalPrice > 0;
      })
      .map((p) => {
        const price = p.dynamicDiscountedPrice || p.discountedPrice;
        const discountPct = (p.originalPrice - price) / p.originalPrice;
        return { product: p, discountPct };
      })
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, 10)
      .map((x) => x.product);
  }, [allActiveProducts, venuesById]);

  const endingSoonProducts = useMemo(() => {
    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    return allActiveProducts
      .filter((p) => {
        const venue = venuesById.get(p.venueId);
        if (!venue || !isVenueOpen(venue)) return false;
        const msLeft = new Date(p.availableUntil).getTime() - now;
        return msLeft > 0 && msLeft <= FOUR_HOURS;
      })
      .sort((a, b) => new Date(a.availableUntil).getTime() - new Date(b.availableUntil).getTime())
      .slice(0, 10);
  }, [allActiveProducts, venuesById]);

  if (loading) {
    return (
      <div className="p-6 space-y-12">
        <Skeleton.Card variant="section-header" />
        <Skeleton.Card variant="pack-featured" count={1} className="max-w-4xl mx-auto" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton.Card variant="pack-compact" count={5} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton.Card variant="venue-card" count={4} />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <ErrorState
        error={fetchError}
        title="No pudimos cargar los restaurantes"
        message="Verifica tu conexión a internet e intenta de nuevo."
        resetErrorBoundary={() => {
          setFetchError(null);
          setLoading(true);
        }}
      />
    );
  }

  const activeVenues = allVenuesSorted
    .filter((v) => isVenueOpen(v) && (venueStockMap.get(v.id) || 0) > 0)
    .slice(0, 10);

  return (
    <div className="pb-nav bg-brand-bg min-h-screen">
      <SEO title={t('explore')} description={t('home_subtitle')} />

      <main className="max-w-[1600px] mx-auto lg:px-6 lg:pt-10">
        <div className="flex flex-col">
          {/* Hero & Top Content */}
          <HeroSection
            user={user}
            heroDeal={heroDeal}
            venueNamesMap={venueNamesMap}
            activeVenues={activeVenues}
            venueProductCountMap={venueProductCountMap}
            userLocation={userLocation}
            city={city}
            onOpenLocation={onOpenLocation}
            onOpenSearch={onOpenSearch}
          />

          {/* Products Discovery */}
          <div className="px-6 lg:px-0">
            <ProductsSection
              endingSoonProducts={endingSoonProducts}
              bestDiscountProducts={bestDiscountProducts}
              venueNamesMap={venueNamesMap}
            />
          </div>

          {/* Venues Discovery */}
          <VenuesSection
            venues={allVenuesSorted}
            userLocation={userLocation}
            venueRatingMap={venueRatingMap}
            venueStockMap={venueStockMap}
            venueProductCountMap={venueProductCountMap}
            venueExpiryMap={venueExpiryMap}
            dynamicVenueIds={dynamicVenueIds}
            hasMoreVenues={hasMoreVenues}
            loadMoreVenues={loadMoreVenues}
            loadingMoreVenues={loadingMoreVenues}
          />
        </div>
      </main>

      {/* Onboarding */}
      {user && user.hasSeenOnboarding === false && (
        <OnboardingTour onComplete={() => window.location.reload()} />
      )}
    </div>
  );
};

export default CustomerHome;
