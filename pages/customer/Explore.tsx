import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, Tag, Clock, ShoppingBag, Filter, ArrowLeft, X, LayoutGrid, RefreshCw } from 'lucide-react';
import { useLocation } from '../../context/LocationContext';
import { venueService } from '../../services/venueService';
import { productService } from '../../services/productService';
import { Venue, Product, ProductType } from '../../types';
import { ProductSmallCard } from '../../components/customer/home/ProductSmallCard';
import { isVenueOpen } from '../../utils/venueAvailability';
import { calculateDistance } from '../../services/locationService';
import { logger } from '../../utils/logger';
import { SEO } from '../../components/common/SEO';

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

    // Sin ubicación: redistribuir pesos
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

    const activeSort = searchParams.get('sort') || 'recommended';
    const activeType = searchParams.get('type') || 'all';
    const activeDiscount = Number(searchParams.get('minDiscount') || 0);
    const activeDistance = Number(searchParams.get('maxDistance') || 0);
    const activeExpires = Number(searchParams.get('expiresIn') || 0);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [allVenues, allProducts] = await Promise.all([
                    venueService.getAllVenues(),
                    productService.getAllActiveProducts()
                ]);
                setVenues(allVenues);
                setProducts(allProducts);
            } catch (err) {
                logger.error('Explore: Load failed', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const venuesById = useMemo(() => {
        const map = new Map<string, Venue>();
        venues.forEach(v => map.set(v.id, v));
        return map;
    }, [venues]);

    const filteredAndSortedProducts = useMemo(() => {
        let result = products.filter(p => {
            const venue = venuesById.get(p.venueId);
            if (!venue || !isVenueOpen(venue)) return false;

            // Type Filter
            if (activeType !== 'all' && p.type !== activeType) return false;

            // Discount Filter
            const price = p.dynamicDiscountedPrice || p.discountedPrice;
            const discountPct = (p.originalPrice - price) / p.originalPrice;
            if (activeDiscount > 0 && discountPct < activeDiscount / 100) return false;

            // Distance Filter
            if (activeDistance > 0 && latitude != null && longitude != null) {
                const dist = calculateDistance(latitude, longitude, venue.latitude, venue.longitude);
                if (dist == null || dist > activeDistance) return false;
            }

            // Expiry Filter
            if (activeExpires > 0) {
                const hoursLeft = (new Date(p.availableUntil).getTime() - Date.now()) / (1000 * 60 * 60);
                if (hoursLeft > activeExpires) return false;
            }

            return true;
        });

        // Sorting
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
            // Default: recommended
            result.sort((a, b) => {
                const scoreA = computeExploreScore(a, venuesById.get(a.venueId)!, latitude || undefined, longitude || undefined);
                const scoreB = computeExploreScore(b, venuesById.get(b.venueId)!, latitude || undefined, longitude || undefined);
                return scoreB - scoreA;
            });
        }

        return result;
    }, [products, venuesById, activeSort, activeType, activeDiscount, activeDistance, activeExpires, latitude, longitude]);

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
            <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
                <p className="text-gray-400 font-bold">{t('loading')}...</p>
            </div>
        );
    }

    return (
        <div className="pb-32 bg-brand-bg min-h-screen">
             <SEO 
                title={t('explore_title')} 
                description={t('explore_desc') || 'Encuentra los mejores productos cerca de ti'}
            />
            {/* Header Sticky */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 mb-5">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('explore_title')}</h1>
                    </div>

                    {/* Filters Row 1: Types & Sort */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-gray-50">
                        <div className="flex items-center gap-2 pr-3 border-r border-gray-100">
                             <LayoutGrid size={16} className="text-gray-400" />
                             <select 
                                value={activeSort}
                                onChange={(e) => setFilter('sort', e.target.value)}
                                className="bg-transparent text-sm font-black text-gray-900 focus:outline-none cursor-pointer"
                             >
                                <option value="recommended">{t('sort_recommended')}</option>
                                <option value="distance">{t('sort_distance')}</option>
                                <option value="discount">{t('sort_discount')}</option>
                                <option value="endingSoon">{t('sort_ending_soon')}</option>
                             </select>
                        </div>

                        {/* Type Chips */}
                        <div className="flex gap-2 px-1">
                            {[
                                { id: 'all', label: t('type_all') },
                                { id: ProductType.SURPRISE_PACK, label: t('type_packs') },
                                { id: ProductType.SPECIFIC_DISH, label: t('type_dishes') }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setFilter('type', type.id)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
                                        activeType === type.id 
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200'
                                    }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filters Row 2: Distance, Discount, Expiry */}
                    <div className="flex gap-4 overflow-x-auto no-scrollbar">
                        {/* Distance Filter */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('filter_distance')}</span>
                            <div className="flex gap-2">
                                {[1, 2.5, 5, 10].map(d => (
                                    <button
                                        key={d}
                                        disabled={latitude == null}
                                        onClick={() => setFilter('maxDistance', d)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                                            activeDistance === d
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : 'bg-white border-gray-100 text-gray-500 disabled:opacity-30 disabled:grayscale'
                                        }`}
                                    >
                                        {d}km
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Discount Filter */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('filter_discount')}</span>
                            <div className="flex gap-2">
                                {[20, 40, 60].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setFilter('minDiscount', d)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                                            activeDiscount === d
                                            ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-500/20'
                                            : 'bg-white border-gray-100 text-gray-500'
                                        }`}
                                    >
                                        ≥{d}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Expiry Filter */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">{t('filter_expires')}</span>
                            <div className="flex gap-2">
                                {[1, 2, 4, 12].map(h => (
                                    <button
                                        key={h}
                                        onClick={() => setFilter('expiresIn', h)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                                            activeExpires === h
                                            ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/20'
                                            : 'bg-white border-gray-100 text-gray-500'
                                        }`}
                                    >
                                        ≤{h}h
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* No location warning */}
                    {latitude == null && (
                         <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 animate-fadeIn">
                            <MapPin size={16} className="text-amber-600" />
                            <span className="text-[11px] font-bold text-amber-800">{t('enable_location_for_distance')}</span>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-8">
                {/* Active Filters Summary */}
                {(activeType !== 'all' || activeDiscount > 0 || activeDistance > 0 || activeExpires > 0) && (
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-sm font-bold text-gray-500">
                           {filteredAndSortedProducts.length} {t('results_found') || 'resultados encontrados'}
                        </span>
                        <button 
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                            <RefreshCw size={14} />
                            {t('clear_filters')}
                        </button>
                    </div>
                )}

                {filteredAndSortedProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredAndSortedProducts.map(product => (
                            <ProductSmallCard
                                key={product.id}
                                product={product}
                                venueName={venuesById.get(product.venueId)?.name || ''}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 px-6">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Search size={40} className="text-gray-300" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">{t('no_results')}</h3>
                        <p className="text-gray-500 mb-8 max-w-xs mx-auto">{t('try_adjusting_filters')}</p>
                        <button 
                            onClick={clearFilters} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                            {t('clear_filters')}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Explore;
