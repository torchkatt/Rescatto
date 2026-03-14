import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { venueService } from '../../services/venueService';
import { Venue, RatingStats, Product } from '../../types';
import { VenueCard } from '../../components/customer/venue/VenueCard';
import { getRatingStats } from '../../services/ratingService';

import { HomeSkeletonLoader } from '../../components/customer/common/Loading';
import { ProductDiscoveryRow } from '../../components/customer/home/ProductDiscoveryRow';
import { ActiveVenueCard } from '../../components/customer/home/ActiveVenueCard';
import { HeroDealCard } from '../../components/customer/home/HeroDealCard';
import { useTranslation } from 'react-i18next';
import { isVenueOpen } from '../../utils/venueAvailability';
import {
    Search, MapPin, User, ShoppingBag, LogOut, ChevronDown, Tag, ChevronRight,
    Heart, Leaf, Flame, TrendingUp, Zap, RefreshCw, Bell, Clock, Star, MessageCircle
} from 'lucide-react';
import { ProductType } from '../../types';
import { Logo } from '../../components/common/Logo';
import { useLocation } from '../../context/LocationContext';
import { LocationSelector } from '../../components/customer/home/LocationSelector';
import { OnboardingTour } from '../../components/customer/OnboardingTour';
import { FlashDealsSection } from '../../components/customer/home/FlashDealBanner';
import { calculateDistance } from '../../services/locationService';
import { productService } from '../../services/productService';
import { logger } from '../../utils/logger';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { SEO } from '../../components/common/SEO';
import { NotificationDisplay } from '../../components/common/NotificationDisplay';
import { DesktopActiveVenues } from '../../components/customer/home/DesktopActiveVenues';
import { ProductSmallCard } from '../../components/customer/home/ProductSmallCard';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const CustomerHome: React.FC = () => {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const { info } = useToast();
    const navigate = useNavigate();
    const { address, city, latitude, longitude } = useLocation();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [venueExpiryMap, setVenueExpiryMap] = useState<Map<string, string>>(new Map());
    const [venueStockMap, setVenueStockMap] = useState<Map<string, number>>(new Map());
    const [venueProductCountMap, setVenueProductCountMap] = useState<Map<string, number>>(new Map());
    const [dynamicVenueIds, setDynamicVenueIds] = useState<Set<string>>(new Set());
    const [venueRatingMap, setVenueRatingMap] = useState<Map<string, RatingStats>>(new Map());
    const [allActiveProducts, setAllActiveProducts] = useState<Product[]>([]);
    const [venuesLastDoc, setVenuesLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreVenues, setHasMoreVenues] = useState(true);
    const [hasMoreProducts, setHasMoreProducts] = useState(true);
    const [loadingMoreVenues, setLoadingMoreVenues] = useState(false);
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const { openImpact, onOpenLocation, onOpenSearch } = useOutletContext<{ 
        openImpact: () => void;
        onOpenLocation: () => void;
        onOpenSearch: () => void;
    }>();

    useEffect(() => {
        const fetchInitial = async () => {
            if (loading === false && !user) return;
            try {
                setLoading(true);
                const [venuesPage, expiryMap, stockResult, dynIds, activeProductsPage] = await Promise.all([
                    venueService.getAllVenuesPage(city || undefined, null, 20),
                    venueService.getExpiringProductsByVenue(),
                    venueService.getStockCountByVenue(),
                    venueService.getDynamicPricingVenueIds(),
                    productService.getAllActiveProductsPage(city || undefined, null, 20),
                ]);

                setVenues(venuesPage.venues);
                setVenuesLastDoc(venuesPage.lastDoc);
                setHasMoreVenues(venuesPage.hasMore);
                setVenueExpiryMap(expiryMap);
                setVenueStockMap(stockResult.stockMap);
                setVenueProductCountMap(stockResult.productCountMap);
                setDynamicVenueIds(dynIds);
                setAllActiveProducts(activeProductsPage.products);
                setProductsLastDoc(activeProductsPage.lastDoc);
                setHasMoreProducts(activeProductsPage.hasMore);

                const ratingMap = new Map<string, RatingStats>();
                await Promise.all(
                    venuesPage.venues.map(async (v) => {
                        try {
                            const stats = await getRatingStats(v.id, 'venue');
                            if (stats) ratingMap.set(v.id, stats);
                        } catch (e) { /* silent fail for individual ratings */ }
                    })
                );
                setVenueRatingMap(ratingMap);
            } catch (error: any) {
                if (error?.code !== 'permission-denied') {
                    logger.error('Error fetching venues:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchInitial();
    }, [user?.id, city]);

    const loadMoreVenues = async () => {
        if (!hasMoreVenues || loadingMoreVenues) return;
        setLoadingMoreVenues(true);
        try {
            const nextPage = await venueService.getAllVenuesPage(city || undefined, venuesLastDoc, 20);
            setVenues(prev => [...prev, ...nextPage.venues]);
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

    const loadMoreProducts = async () => {
        if (!hasMoreProducts || loadingMoreProducts) return;
        setLoadingMoreProducts(true);
        try {
            const nextPage = await productService.getAllActiveProductsPage(city || undefined, productsLastDoc, 20);
            setAllActiveProducts(prev => [...prev, ...nextPage.products]);
            setProductsLastDoc(nextPage.lastDoc);
            setHasMoreProducts(nextPage.hasMore);
        } catch (error) {
            logger.error('Error loading more products:', error);
        } finally {
            setLoadingMoreProducts(false);
        }
    };

    const hasUserLocation = latitude !== null && longitude !== null;

    const sortedVenues = useMemo(() => {
        if (!hasUserLocation) return venues;
        return [...venues].sort((a, b) => {
            const distA = calculateDistance(latitude as number, longitude as number, a.latitude, a.longitude);
            const distB = calculateDistance(latitude as number, longitude as number, b.latitude, b.longitude);
            return (distA || 999) - (distB || 999);
        });
    }, [venues, hasUserLocation, latitude, longitude]);

    const filteredVenues = sortedVenues;

    // Todos los venues: abiertos primero (por distancia), cerrados después (por distancia)
    const allVenuesSorted = useMemo(() => {
        const open: Venue[] = [];
        const closed: Venue[] = [];
        sortedVenues.forEach(v => {
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
        venues.forEach(v => map.set(v.id, v));
        return map;
    }, [venues]);

    const venueNamesMap = useMemo(() => {
        const map = new Map<string, string>();
        venues.forEach(v => map.set(v.id, v.name));
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
            const discountPct = ((p.originalPrice - price) / p.originalPrice);
            const msLeft = new Date(p.availableUntil).getTime() - now;
            if (msLeft <= 0 || msLeft > TWENTY_FOUR_HOURS) continue; 

            const urgencyScore = 1 - (msLeft / TWENTY_FOUR_HOURS); 
            const score = discountPct * 0.6 + urgencyScore * 0.4;

            if (!best || score > best.score) {
                best = { product: p, score, discountPct: Math.round(discountPct * 100) };
            }
        }

        return best;
    }, [allActiveProducts, venuesById]);

    const bestDiscountProducts = useMemo(() => {
        return allActiveProducts
            .filter(p => {
                const venue = venuesById.get(p.venueId);
                return venue && isVenueOpen(venue) && p.originalPrice > 0;
            })
            .map(p => {
                const price = p.dynamicDiscountedPrice || p.discountedPrice;
                const discountPct = (p.originalPrice - price) / p.originalPrice;
                return { product: p, discountPct };
            })
            .sort((a, b) => b.discountPct - a.discountPct)
            .slice(0, 10)
            .map(x => x.product);
    }, [allActiveProducts, venuesById]);

    const endingSoonProducts = useMemo(() => {
        const now = Date.now();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        return allActiveProducts
            .filter(p => {
                const venue = venuesById.get(p.venueId);
                if (!venue || !isVenueOpen(venue)) return false;
                const msLeft = new Date(p.availableUntil).getTime() - now;
                return msLeft > 0 && msLeft <= FOUR_HOURS;
            })
            .sort((a, b) => new Date(a.availableUntil).getTime() - new Date(b.availableUntil).getTime())
            .slice(0, 10);
    }, [allActiveProducts, venuesById]);

    if (loading) return <HomeSkeletonLoader />;

    return (
        <div className="pb-40 bg-brand-bg min-h-screen">
            <SEO
                title={t('explore')}
                description={t('home_subtitle')}
            />


            {/* Header Sticky (Mobile Only) */}
            <header className="px-6 pt-8 pb-4 bg-brand-bg sticky top-0 z-40 lg:hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={onOpenLocation}
                            className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100/50 group active:scale-95 transition-all"
                        >
                            <MapPin size={16} className="text-emerald-500" />
                            <span className="text-sm font-black text-emerald-800 truncate max-w-[150px]">
                                {city || 'Downtown'}
                            </span>
                            <ChevronDown size={14} className="text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onOpenSearch}
                                className="p-2.5 rounded-full bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
                            >
                                <Search size={20} />
                            </button>
                            <NotificationDisplay />
                        </div>
                    </div>

                    <div className="mb-4">
                        <h1 className="text-3xl font-black text-brand-dark tracking-tight leading-tight">
                            {user?.fullName ? t('hello', { name: user.fullName.split(' ')[0] }) : t('welcome')}
                        </h1>
                        <p className="text-gray-400 font-bold text-base">
                            {t('home_subtitle')}
                        </p>
                    </div>

                    {/* Compact Gamification Pill */}
                    {user && !user.isGuest && (
                        <div
                            onClick={() => navigate('/app/impact')}
                            className="mb-6 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-4 py-3 text-white cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/10"
                        >
                            <div className="flex items-center gap-2.5">
                                <Flame
                                    size={18}
                                    className={`${(user.streak?.current || 0) >= 3 ? 'text-yellow-300' : 'text-white/80'}`}
                                />
                                <span className="text-sm font-black">{user.streak?.current || 0} {t('streak_days')}</span>
                                <span className="bg-yellow-400/90 text-yellow-900 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                                    x{user.streak?.multiplier?.toFixed(1) || '1.0'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black">{(user.impact?.points || 0).toLocaleString('es-CO')}</span>
                                <span className="text-yellow-300 text-xs">💎</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto lg:px-6 lg:pt-10">
                <div className="lg:grid lg:grid-cols-1 lg:gap-12 lg:items-start">
                    
                    {/* LEFT COLUMN: Main Content (Now Full Width if Sidebar Empty) */}
                    <div className="lg:col-span-1">
                        {/* Hero Deal */}
                        {heroDeal && (
                            <div className="mb-10">
                                <HeroDealCard
                                    product={heroDeal.product}
                                    venueName={venueNamesMap.get(heroDeal.product.venueId) || ''}
                                    discountPct={heroDeal.discountPct}
                                />
                            </div>
                        )}

                        {/* Last Call (Relocated to Main Column) */}
                        {endingSoonProducts.length > 0 && (
                            <section className="mb-12">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                                            <Clock size={20} />
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight text-gray-900">{t('last_call')}</h2>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/app/explore?sort=endingSoon')}
                                        className="text-emerald-600 font-bold hover:underline hidden lg:block"
                                    >
                                        {t('see_all')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {endingSoonProducts.slice(0, 4).map(product => {
                                        const now = new Date();
                                        const expiry = new Date(product.availableUntil);
                                        const diffMs = expiry.getTime() - now.getTime();
                                        const diffMins = Math.floor(diffMs / 60000);
                                        const hours = Math.floor(diffMins / 60);
                                        const mins = diffMins % 60;

                                        return (
                                            <div 
                                                key={product.id}
                                                onClick={() => navigate(`/app/product/${product.id}`)}
                                                className="bg-white p-3 rounded-[2rem] border border-gray-100 flex lg:flex-col items-center lg:items-start gap-4 hover:shadow-lg hover:shadow-red-500/5 transition-all cursor-pointer group active:scale-[0.98]"
                                            >
                                                <div className="w-16 h-16 lg:w-full lg:h-32 rounded-2xl overflow-hidden relative shrink-0">
                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg">
                                                        {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0 lg:w-full">
                                                    <p className="text-sm font-black text-gray-900 truncate mb-0.5">{product.name}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 truncate uppercase tracking-tighter">
                                                        {venueNamesMap.get(product.venueId)}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-2 lg:mt-3">
                                                        <span className="text-sm font-black text-emerald-600">
                                                            ${(product.dynamicDiscountedPrice || product.discountedPrice).toLocaleString('es-CO')}
                                                        </span>
                                                        <div className="bg-red-50 p-1.5 rounded-lg text-red-500 lg:hidden">
                                                            <Clock size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}


                        {/* Activos ahora (Desktop Grid) */}
                        <DesktopActiveVenues 
                            venues={allVenuesSorted.filter(v => isVenueOpen(v) && (venueStockMap.get(v.id) || 0) > 0).slice(0, 6)}
                            venueProductCountMap={venueProductCountMap}
                            userLocation={hasUserLocation ? { lat: latitude!, lng: longitude! } : undefined}
                        />

                        {/* Finalizan pronto */}
                        <div className="mb-10">
                            <ProductDiscoveryRow
                                title={t('ending_soon')}
                                products={endingSoonProducts}
                                venueNames={venueNamesMap}
                                icon={Clock}
                                iconColor="text-red-500"
                                onSeeAll={() => navigate('/app/explore?sort=endingSoon')}
                            />
                        </div>

                        {/* Activos ahora (Mobile Carousel) */}
                        {allVenuesSorted.filter(v => isVenueOpen(v) && (venueStockMap.get(v.id) || 0) > 0).length > 0 && (
                            <section className="mb-10 lg:hidden">
                                <div className="px-6 flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                                            {t('active_now')}
                                        </h2>
                                    </div>
                                </div>
                                <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 pb-4">
                                    {allVenuesSorted
                                        .filter(v => isVenueOpen(v) && (venueStockMap.get(v.id) || 0) > 0)
                                        .slice(0, 10)
                                        .map(venue => (
                                        <ActiveVenueCard
                                            key={venue.id}
                                            venue={venue}
                                            productCount={venueProductCountMap.get(venue.id)}
                                            userLocation={hasUserLocation ? { lat: latitude!, lng: longitude! } : undefined}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Productos disponibles (Desktop Grid) */}
                        <section className="hidden lg:block mb-12">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="text-emerald-500" size={24} />
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                        {t('available_products')}
                                    </h2>
                                </div>
                                <button 
                                    onClick={() => navigate('/app/explore?sort=recommended')}
                                    className="text-emerald-600 font-bold hover:underline"
                                >
                                    {t('see_all')}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {bestDiscountProducts.slice(0, 9).map(p => (
                                    <ProductSmallCard 
                                        key={p.id}
                                        product={p}
                                        venueName={venueNamesMap.get(p.venueId) || ''}
                                    />
                                ))}
                            </div>
                        </section>

                        {/* Productos disponibles (Mobile Carousel) */}
                        <div className="lg:hidden">
                            <ProductDiscoveryRow
                                title={t('available_products')}
                                products={bestDiscountProducts}
                                venueNames={venueNamesMap}
                                icon={ShoppingBag}
                                iconColor="text-emerald-500"
                                onSeeAll={() => navigate('/app/explore?sort=recommended')}
                            />
                        </div>
                        {hasMoreProducts && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={loadMoreProducts}
                                    disabled={loadingMoreProducts}
                                    className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                                >
                                    {loadingMoreProducts ? t('loading') : t('load_more_products')}
                                </button>
                            </div>
                        )}

                        {/* Negocios cerca */}
                        <section className="px-6 lg:px-0 pb-28">
                            <div className="flex items-center gap-2 mb-5">
                                <MapPin size={22} className="text-gray-700" />
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                                    {t('nearby_venues')}
                                </h2>
                            </div>

                            {allVenuesSorted.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
                                        {allVenuesSorted.map(venue => (
                                            <VenueCard
                                                key={venue.id}
                                                venue={venue}
                                                userLocation={hasUserLocation ? { lat: latitude!, lng: longitude! } : undefined}
                                                ratingStats={venueRatingMap.get(venue.id)}
                                                totalStock={venueStockMap.get(venue.id)}
                                                productCount={venueProductCountMap.get(venue.id)}
                                                soonestExpiry={venueExpiryMap.get(venue.id)}
                                                hasDynamicPricing={dynamicVenueIds.has(venue.id)}
                                            />
                                        ))}
                                    </div>
                                    {hasMoreVenues && (
                                        <div className="mt-6 flex justify-center">
                                            <button
                                                onClick={loadMoreVenues}
                                                disabled={loadingMoreVenues}
                                                className="px-4 py-2 rounded-full text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                                            >
                                                {loadingMoreVenues ? t('loading') : t('load_more_venues')}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                        <Search size={24} className="text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 mb-2">{t('no_places_title')}</h3>
                                    <p className="text-gray-500 max-w-sm mx-auto">{t('no_places_desc')}</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Sidebar hidden for now until we have more content to fill the 1600px space effectively */}
                    <aside className="hidden">
                        {/* Empty aside for now, as per user request */}
                    </aside>
                </div>
            </main>

            {/* Modals */}
            {user && user.hasSeenOnboarding === false && (
                <OnboardingTour onComplete={() => window.location.reload()} />
            )}
        </div>
    );
};

export default CustomerHome;
