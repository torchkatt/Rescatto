import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';
import { venueService } from '../../services/venueService';
import { productService } from '../../services/productService';
import { Venue, Product, ProductType } from '../../types';
import { PackCard } from '../../components/customer/home/PackCard';
import { isVenueOpen } from '../../utils/venueAvailability';
import { calculateDistance } from '../../services/locationService';
import { logger } from '../../utils/logger';
import { SEO } from '../../components/common/SEO';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

// UI Components
import { FilterChip } from '../../components/ui/FilterChip';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/customer/common/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';

const PAGE_SIZE = 20;

const computeExploreScore = (
  product: Product,
  venue: Venue,
  userLat?: number,
  userLng?: number
): number => {
  const price = product.dynamicDiscountedPrice || product.discountedPrice;
  const discountPct = product.originalPrice > 0
    ? (product.originalPrice - price) / product.originalPrice
    : 0;
  const discountScore = Math.min(discountPct / 0.8, 1);

  const hoursLeft = (new Date(product.availableUntil).getTime() - Date.now()) / (1000 * 60 * 60);
  const expiryScore = 1 - Math.min(Math.max(hoursLeft, 0) / 6, 1);

  if (userLat != null && userLng != null) {
    const dist = calculateDistance(userLat, userLng, venue.latitude, venue.longitude) ?? 10;
    const distanceScore = 1 - Math.min(dist / 10, 1);
    return 0.45 * discountScore + 0.35 * expiryScore + 0.20 * distanceScore;
  }

  return 0.55 * discountScore + 0.45 * expiryScore;
};

const Explore: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { latitude, longitude } = useLocation();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);

  const activeSort = searchParams.get('sort') || 'recommended';
  const activeType = searchParams.get('type') || 'all';
  const activeDiscount = Number(searchParams.get('minDiscount') || 0);
  const activeDistance = Number(searchParams.get('maxDistance') || 0);
  const activeExpires = Number(searchParams.get('expiresIn') || 0);
  const activeCategory = searchParams.get('category') || 'all';
  const activeIsRescue = searchParams.get('isRescue') === 'true';

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [allVenues, productsPage] = await Promise.all([
          venueService.getAllVenues(),
          productService.getAllActiveProductsPage(undefined, null, PAGE_SIZE)
        ]);
        setVenues(allVenues);
        setProducts(productsPage.products);
        setProductsLastDoc(productsPage.lastDoc);
        setHasMoreProducts(productsPage.hasMore);
      } catch (err) {
        logger.error('Explore: Load failed', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMoreProducts || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await productService.getAllActiveProductsPage(undefined, productsLastDoc, PAGE_SIZE);
      setProducts(prev => [...prev, ...nextPage.products]);
      setProductsLastDoc(nextPage.lastDoc);
      setHasMoreProducts(nextPage.hasMore);
    } catch (err) {
      logger.error('Explore: Load more failed', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMoreProducts, loadingMore, productsLastDoc]);

  const venuesById = useMemo(() => {
    const map = new Map<string, Venue>();
    venues.forEach(v => map.set(v.id, v));
    return map;
  }, [venues]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(p => {
      const venue = venuesById.get(p.venueId);
      if (!venue || !isVenueOpen(venue)) return false;

      if (activeType !== 'all' && p.type !== activeType) return false;

      const price = p.dynamicDiscountedPrice || p.discountedPrice;
      const discountPct = (p.originalPrice - price) / p.originalPrice;
      if (activeDiscount > 0 && discountPct < activeDiscount / 100) return false;

      if (activeDistance > 0 && latitude != null && longitude != null) {
        const dist = calculateDistance(latitude, longitude, venue.latitude, venue.longitude);
        if (dist == null || dist > activeDistance) return false;
      }

      if (activeExpires > 0) {
        const hoursLeft = (new Date(p.availableUntil).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursLeft > activeExpires) return false;
      }

      if (activeIsRescue && p.isRescue === false) return false;
      
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;

      return true;
    });

    if (activeSort === 'distance' && latitude != null && longitude != null) {
      result.sort((a, b) => {
        const venueA = venuesById.get(a.venueId)!;
        const venueB = venuesById.get(b.venueId)!;
        const distA = calculateDistance(latitude, longitude, venueA.latitude, venueA.longitude) ?? 999;
        const distB = calculateDistance(latitude, longitude, venueB.latitude, venueB.longitude) ?? 999;
        return distA - distB;
      });
    } else if (activeSort === 'discount') {
      result.sort((a, b) => {
        const priceA = a.dynamicDiscountedPrice || a.discountedPrice;
        const discA = (a.originalPrice - priceA) / a.originalPrice;
        const priceB = b.dynamicDiscountedPrice || b.discountedPrice;
        const discB = (b.originalPrice - priceB) / b.originalPrice;
        return discB - discA;
      });
    } else if (activeSort === 'endingSoon') {
      result.sort((a, b) => new Date(a.availableUntil).getTime() - new Date(b.availableUntil).getTime());
    } else {
      result.sort((a, b) => {
        const scoreA = computeExploreScore(a, venuesById.get(a.venueId)!, latitude || undefined, longitude || undefined);
        const scoreB = computeExploreScore(b, venuesById.get(b.venueId)!, latitude || undefined, longitude || undefined);
        return scoreB - scoreA;
      });
    }

    return result;
  }, [products, venuesById, activeSort, activeType, activeDiscount, activeDistance, activeExpires, activeIsRescue, activeCategory, latitude, longitude]);

  const setFilter = (key: string, value: string | number) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 0 || value === 'all' || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value.toString());
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
          <div className="w-48 h-8 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1,2,3,4].map(i => <div key={i} className="w-24 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="space-y-3">
              <div className="aspect-[4/3] rounded-2xl bg-gray-100 animate-pulse" />
              <div className="w-full h-4 rounded bg-gray-100 animate-pulse" />
              <div className="w-2/3 h-4 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-nav bg-brand-bg min-h-screen">
      <SEO
        title={t('explore_title')}
        description={t('explore_desc') || 'Encuentra los mejores productos cerca de ti'}
      />
      
      {/* Header Sticky */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 pt-safe-top">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-5">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors group">
              <ArrowLeft size={24} className="group-active:scale-90 transition-transform" />
            </button>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('explore_title')}</h1>
          </div>

          {/* Type Chips */}
          <FilterChip.Group
            value={activeType}
            onChange={(val) => setFilter('type', val as string)}
            className="mb-6"
          >
            <FilterChip value="all">{t('type_all')}</FilterChip>
            <FilterChip value={ProductType.SURPRISE_PACK} icon="🎁">{t('type_packs')}</FilterChip>
            <FilterChip value={ProductType.SPECIFIC_DISH} icon="🍽">{t('type_dishes')}</FilterChip>
            <FilterChip value="isRescue" isSelected={activeIsRescue} onClick={() => setFilter('isRescue', activeIsRescue ? 'false' : 'true')} icon="🍃">
              Rescate
            </FilterChip>
          </FilterChip.Group>

          {/* Quick Filters Row */}
          <div className="flex gap-6 overflow-x-auto no-scrollbar py-1">
            {/* Sort Dropdown */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Ordenar por</span>
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={activeSort}
                  onChange={(e) => setFilter('sort', e.target.value)}
                  className="bg-transparent text-xs font-black text-gray-900 focus:outline-none cursor-pointer"
                >
                  <option value="recommended">{t('sort_recommended')}</option>
                  <option value="distance">{t('sort_distance')}</option>
                  <option value="discount">{t('sort_discount')}</option>
                  <option value="endingSoon">{t('sort_ending_soon')}</option>
                </select>
              </div>
            </div>

            {/* Distance Filter */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('filter_distance')}</span>
              <FilterChip.Group
                value={activeDistance.toString()}
                onChange={(val) => setFilter('maxDistance', val as string)}
                gap="xs"
              >
                {[1, 2.5, 5, 10].map(d => (
                  <FilterChip key={d} value={d.toString()} disabled={latitude == null} className="!py-1.5 !px-3 !text-[10px]">
                    {d}km
                  </FilterChip>
                ))}
              </FilterChip.Group>
            </div>

            {/* Discount Filter */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('filter_discount')}</span>
              <FilterChip.Group
                value={activeDiscount.toString()}
                onChange={(val) => setFilter('minDiscount', val as string)}
                gap="xs"
              >
                {[20, 40, 60].map(d => (
                  <FilterChip key={d} value={d.toString()} className="!py-1.5 !px-3 !text-[10px]">
                    ≥{d}%
                  </FilterChip>
                ))}
              </FilterChip.Group>
            </div>
          </div>

          {/* No location warning */}
          {latitude == null && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 animate-fadeInUp">
              <MapPin size={16} className="text-amber-600" />
              <span className="text-[11px] font-black text-amber-800">{t('enable_location_for_distance')}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        {/* Results Summary */}
        <div className="flex items-center justify-between mb-8">
          <SectionHeader
            title={`${filteredAndSortedProducts.length} ${t('results_found') || 'resultados'}`}
            size="sm"
            className="mb-0"
          />
          {(activeType !== 'all' || activeDiscount > 0 || activeDistance > 0 || activeExpires > 0 || activeCategory !== 'all' || activeIsRescue) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <RefreshCw size={14} />
              {t('clear_filters')}
            </button>
          )}
        </div>

        {filteredAndSortedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredAndSortedProducts.map(product => (
                <PackCard
                  key={product.id}
                  product={product}
                  venueName={venuesById.get(product.venueId)?.name}
                  variant="compact"
                />
              ))}
            </div>
            {hasMoreProducts && (
              <div className="mt-12 flex justify-center pb-12">
                <Button
                  variant="secondary"
                  onClick={loadMore}
                  isLoading={loadingMore}
                  className="px-8 rounded-full font-black"
                >
                  {loadingMore ? t('loading') : t('load_more_products')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Search size={48} />}
            title={t('no_results')}
            description={t('try_adjusting_filters')}
            action={{
              label: t('clear_filters'),
              onClick: clearFilters,
              variant: 'outline'
            }}
            size="lg"
          />
        )}
      </main>
    </div>
  );
};

export default Explore;
