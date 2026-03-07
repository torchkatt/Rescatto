import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { venueService } from '../../services/venueService';
import { Venue, RatingStats } from '../../types';
import { VenueCard } from '../../components/customer/venue/VenueCard';
import { getRatingStats } from '../../services/ratingService';

import { HomeSkeletonLoader } from '../../components/customer/common/Loading';
import { CategoriesBar } from '../../components/customer/home/CategoriesBar';
import {
    Search, MapPin, User, ShoppingBag, LogOut, ChevronDown,
    Heart, Leaf, Flame, TrendingUp, Zap, RefreshCw
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { useLocation } from '../../context/LocationContext';
import { LocationSelector } from '../../components/customer/home/LocationSelector';
import { OnboardingTour } from '../../components/customer/OnboardingTour';
import { FlashDealsSection } from '../../components/customer/home/FlashDealBanner';
import { calculateDistance } from '../../services/locationService';
import { logger } from '../../utils/logger';

const CustomerHome: React.FC = () => {
    const { user, logout } = useAuth();
    const { info } = useToast();
    const navigate = useNavigate();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [venueExpiryMap, setVenueExpiryMap] = useState<Map<string, string>>(new Map());
    const [venueStockMap, setVenueStockMap] = useState<Map<string, number>>(new Map());
    const [dynamicVenueIds, setDynamicVenueIds] = useState<Set<string>>(new Set());
    const [venueRatingMap, setVenueRatingMap] = useState<Map<string, RatingStats>>(new Map());
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchVenues = async () => {
            try {
                // Load venues + expiring products + stock counts + dynamic pricing in parallel
                const [allVenues, expiryMap, stockMap, dynIds] = await Promise.all([
                    venueService.getAllVenues(),
                    venueService.getExpiringProductsByVenue(),
                    venueService.getStockCountByVenue(),
                    venueService.getDynamicPricingVenueIds(),
                ]);
                setVenues(allVenues);
                setVenueExpiryMap(expiryMap);
                setVenueStockMap(stockMap);
                setDynamicVenueIds(dynIds);

                // Carga de rating stats en paralelo (una sola tanda, sin N+1)
                const ratingResults = await Promise.allSettled(
                    allVenues.map(v => getRatingStats(v.id, 'venue'))
                );
                const ratingMap = new Map<string, RatingStats>();
                allVenues.forEach((v, i) => {
                    const result = ratingResults[i];
                    if (result.status === 'fulfilled' && result.value) {
                        ratingMap.set(v.id, result.value);
                    }
                });
                setVenueRatingMap(ratingMap);
            } catch (error) {
                logger.error('Error fetching venues:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVenues();
    }, []);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUserMenu]);

    const handleLogout = async () => {
        logger.log('CustomerHome: handleLogout called');
        try {
            await logout();
            window.location.href = '/#/login';
            window.location.reload();
        } catch (error) {
            logger.error('CustomerHome: Logout failed', error);
            window.location.href = '/#/login';
        }
    };

    const handleForceUpdate = async () => {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                }
            }
            window.location.reload();
        } catch (error) {
            logger.error('Error updating app:', error);
            window.location.reload();
        }
    };

    const { address, city, latitude, longitude } = useLocation();
    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const hasUserLocation = latitude !== null && longitude !== null;
    const MAX_VENUE_DISTANCE_KM = 80;

    // Sort Venues by Distance
    const sortedVenues = React.useMemo(() => {
        if (!hasUserLocation) return venues;

        return [...venues].sort((a, b) => {
            const distA = calculateDistance(latitude as number, longitude as number, a.latitude, a.longitude);
            const distB = calculateDistance(latitude as number, longitude as number, b.latitude, b.longitude);
            const safeDistA = Number.isFinite(distA) ? distA : Number.POSITIVE_INFINITY;
            const safeDistB = Number.isFinite(distB) ? distB : Number.POSITIVE_INFINITY;
            return safeDistA - safeDistB;
        });
    }, [venues, hasUserLocation, latitude, longitude]);

    // Memoized: only recalculates when a filter dependency changes
    const filteredVenues = useMemo(() => sortedVenues.filter(venue => {
        const normalizedUserCity = city?.trim().toLowerCase() || null;
        const normalizedVenueCity = venue.city?.trim().toLowerCase() || null;
        const distance = hasUserLocation
            ? calculateDistance(latitude as number, longitude as number, venue.latitude, venue.longitude)
            : null;

        const matchesDistance = distance === null || !Number.isFinite(distance) || distance <= MAX_VENUE_DISTANCE_KM;
        const matchesCity = normalizedUserCity
            ? (!normalizedVenueCity || normalizedVenueCity === normalizedUserCity)
            : true;

        const matchesCategory = selectedCategory === 'all' ||
            (venue.categories?.includes(selectedCategory) ?? true);
        const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            venue.address.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDietary = selectedDietaryTags.length === 0 ||
            selectedDietaryTags.every(tag => {
                if (tag === 'AVAILABLE_NOW') return true;
                return venue.dietaryTags?.includes(tag);
            });

        return matchesCity && matchesDistance && matchesCategory && matchesSearch && matchesDietary;
    }), [sortedVenues, city, hasUserLocation, latitude, longitude, selectedCategory, searchQuery, selectedDietaryTags]);

    // Trending venues: have expiring products AND high rating or high orders
    const trendingVenueIds = useMemo(() => {
        return new Set(
            filteredVenues
                .filter(v => venueExpiryMap.has(v.id))
                .sort((a, b) => (b.stats?.totalOrders ?? 0) - (a.stats?.totalOrders ?? 0))
                .slice(0, 3)
                .map(v => v.id)
        );
    }, [filteredVenues, venueExpiryMap]);

    // Hot deals: venues with expiring products, shown in featured row
    const hotDealsVenues = useMemo(() => {
        return filteredVenues
            .filter(v => venueExpiryMap.has(v.id))
            .slice(0, 6);
    }, [filteredVenues, venueExpiryMap]);

    // Platform stats: approximate totals for social proof banner
    const platformStats = useMemo(() => {
        const totalStock = Array.from(venueStockMap.values()).reduce((a, b) => a + b, 0);
        const activeVenues = venues.filter(v => venueStockMap.has(v.id)).length;
        return { totalStock, activeVenues };
    }, [venueStockMap, venues]);

    const DIETARY_OPTIONS = [
        { id: 'AVAILABLE_NOW', label: 'Disponible Ya', icon: '⚡' },
        { id: 'VEGAN', label: 'Vegano', icon: '🌿' },
        { id: 'VEGETARIAN', label: 'Vegetariano', icon: '🥗' },
        { id: 'GLUTEN_FREE', label: 'Sin Gluten', icon: '🌾' },
        { id: 'KETO', label: 'Keto', icon: '🥩' },
    ];

    const toggleDietaryTag = (tagId: string) => {
        setSelectedDietaryTags(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    if (loading) {
        return <HomeSkeletonLoader />;
    }

    return (
        <div className="pb-20 bg-gray-50 min-h-screen">
            {/* Header */}
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 overflow-visible pt-safe-top flex flex-col">
                <div className="max-w-7xl mx-auto w-full">
                    {/* Tier 1: Location & Profile */}
                    <div className="px-4 py-3 pb-2 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label={`Cambiar ubicación. Actualmente: ${address}`}
                            className="flex items-center gap-3 cursor-pointer p-1 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[80%]"
                            onClick={() => setShowLocationSelector(true)}
                        >
                            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 shrink-0">
                                <MapPin size={18} />
                            </div>
                            <div className="flex flex-col text-left overflow-hidden">
                                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Ubicación Actual</span>
                                <span className="font-bold text-[15px] text-gray-900 leading-tight flex items-center gap-1 truncate w-full">
                                    {address} <ChevronDown size={14} className="shrink-0 text-emerald-600" />
                                </span>
                            </div>
                        </button>
                        {user && (
                            <div className="relative z-[60]" ref={userMenuRef}>
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white font-bold text-sm hover:from-emerald-600 hover:to-emerald-800 transition-all shadow-md active:scale-95 border-2 border-white ring-2 ring-emerald-100 shrink-0"
                                >
                                    {user.fullName.charAt(0)}
                                </button>

                                {/* User Dropdown Menu */}
                                {showUserMenu && (
                                    <>
                                        {/* Backdrop for mobile to prevent scroll and allow closing */}
                                        <div
                                            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60] lg:hidden"
                                            onClick={() => setShowUserMenu(false)}
                                        />
                                        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[70] animate-fadeIn origin-top-right">
                                            {/* User Info Header */}
                                            <div className="px-5 py-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100/50">
                                                <p className="font-black text-gray-900 text-base truncate">{user.fullName}</p>
                                                <p className="text-xs text-gray-500 truncate font-medium mt-0.5">{user.email}</p>
                                                {/* Streak display in menu */}
                                                {(user.streak?.current ?? 0) >= 2 && (
                                                    <div className="mt-2 inline-flex items-center gap-1.5 bg-orange-100/50 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-200">
                                                        🔥 {user.streak?.current} días de racha
                                                    </div>
                                                )}
                                            </div>

                                            {/* Menu Items */}
                                            <div className="py-2">
                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-emerald-50 transition-colors text-gray-700 active:bg-emerald-100 group"
                                                >
                                                    <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors text-emerald-600">
                                                        <User size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Mi Perfil</span>
                                                </button>

                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/app/orders'); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-emerald-50 transition-colors text-gray-700 active:bg-emerald-100 group"
                                                >
                                                    <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors text-emerald-600">
                                                        <ShoppingBag size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Mis Pedidos</span>
                                                </button>

                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/app/favorites'); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-red-50 transition-colors text-gray-700 active:bg-red-100 group"
                                                >
                                                    <div className="bg-red-50 p-2 rounded-xl group-hover:bg-red-100 transition-colors text-red-500">
                                                        <Heart size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Mis Favoritos</span>
                                                </button>

                                                <button
                                                    onClick={() => { setShowUserMenu(false); navigate('/app/impact'); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-emerald-50 transition-colors text-gray-700 active:bg-emerald-100 group"
                                                >
                                                    <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors text-emerald-600">
                                                        <Leaf size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Mi Impacto <span className="text-lg leading-none">🌱</span></span>
                                                </button>

                                                <button
                                                    onClick={() => { setShowUserMenu(false); handleForceUpdate(); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-blue-50 transition-colors text-gray-700 active:bg-blue-100 group"
                                                >
                                                    <div className="bg-blue-50 p-2 rounded-xl group-hover:bg-blue-100 transition-colors text-blue-500">
                                                        <RefreshCw size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Actualizar App</span>
                                                </button>

                                                <div className="border-t border-gray-100 my-2 mx-5"></div>

                                                <button
                                                    onClick={() => { setShowUserMenu(false); handleLogout(); }}
                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600 cursor-pointer active:bg-red-100 group"
                                                >
                                                    <div className="bg-red-50 p-2 rounded-xl group-hover:bg-red-100 transition-colors text-red-600">
                                                        <LogOut size={18} />
                                                    </div>
                                                    <span className="font-bold text-sm">Cerrar Sesión</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tier 2: Search Bar */}
                    <div className="px-4 pb-2 relative z-[40]">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                            <input
                                type="text"
                                id="venue-search"
                                aria-label="Buscar restaurantes y comida por nombre o dirección"
                                placeholder="Buscar comida o restaurante..."
                                className="w-full bg-gray-100/80 rounded-2xl py-3.5 pl-12 pr-4 text-[15px] font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tier 3: Categories & Filters (Scrollable Row) */}
                    <div className="relative z-30 pb-3">
                        <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 pb-1 min-w-0 snap-x hide-scroll">
                            <div className="shrink-0 snap-start">
                                <CategoriesBar
                                    selectedCategory={selectedCategory}
                                    onSelectCategory={setSelectedCategory}
                                />
                            </div>

                            {/* Dietary Filters incorporated into the same horizontal scroll */}
                            {DIETARY_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => toggleDietaryTag(option.id)}
                                    className={`shrink-0 snap-start flex items-center gap-1.5 px-4 h-10 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border active:scale-95 ${selectedDietaryTags.includes(option.id)
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
                                        }`}
                                >
                                    <span className="text-[15px] leading-none">{option.icon}</span>
                                    {option.label}
                                </button>
                            ))}
                            {/* Spacer for scroll padding */}
                            <div className="w-1 shrink-0"></div>
                        </div>
                        {/* Fade effect at the edge of scroll */}
                        <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 space-y-6 max-w-7xl mx-auto w-full">

                {/* Hero Banner */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold mb-2 inline-block">SALVA COMIDA</span>
                        <h2 className="text-xl font-bold mb-1">Pack Sorpresa</h2>
                        <p className="text-sm opacity-90 mb-3">Alta cocina al precio justo. Cero desperdicio.</p>
                        <button
                            className="bg-white text-emerald-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-50 transition-all active:scale-95"
                            onClick={() => {
                                setSelectedCategory('all');
                                setSearchQuery('');
                                info('🎁 Busca los "Pack Sorpresa" en los restaurantes disponibles');
                                setTimeout(() => {
                                    const venuesSection = document.querySelector('.grid');
                                    venuesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            }}
                        >
                            Ver Oferta
                        </button>
                    </div>
                    <div className="absolute right-[-20px] bottom-[-20px] opacity-20 transform rotate-12">
                        <Logo size="xl" className="shadow-none border-none bg-transparent" iconColor="white" />
                    </div>
                </div>

                {/* Social Proof: Live Stats */}
                {platformStats.totalStock > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-stretch">
                        <div className="bg-white rounded-[24px] p-6 flex flex-col justify-center items-center text-center shadow-sm border border-gray-100 h-full hover:shadow-md transition-shadow md:col-span-1 min-h-[140px] relative overflow-hidden group">
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors duration-500"></div>
                            <p className="text-4xl lg:text-5xl font-black text-emerald-600 mb-1 leading-none relative z-10">{platformStats.totalStock.toLocaleString('es-CO')}</p>
                            <p className="text-xs lg:text-sm text-gray-500 font-bold uppercase tracking-widest leading-snug relative z-10">porciones<br />disponibles</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-1 md:grid-rows-2 gap-3 md:col-span-2 md:gap-4 lg:gap-6">
                            <div className="bg-white rounded-2xl p-4 lg:p-5 flex items-center justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-full cursor-default group">
                                <div>
                                    <p className="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-wider leading-tight text-left mb-0.5">Lugares</p>
                                    <p className="text-[13px] lg:text-sm font-black text-gray-700 leading-none">ACTIVOS HOY</p>
                                </div>
                                <p className="text-2xl lg:text-3xl font-black text-orange-500 group-hover:scale-110 transition-transform origin-right">{platformStats.activeVenues.toLocaleString('es-CO')}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-4 lg:p-5 flex items-center justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-full cursor-default group">
                                <div>
                                    <p className="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-wider leading-tight text-left mb-0.5">Kg CO₂ por</p>
                                    <p className="text-[13px] lg:text-sm font-black text-gray-700 leading-none">SALVAR HOY</p>
                                </div>
                                <p className="text-2xl lg:text-3xl font-black text-blue-500 group-hover:scale-110 transition-transform origin-right">{Math.round(platformStats.totalStock * 0.4).toLocaleString('es-CO')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Streak reminder for logged-in users */}
                {user?.streak && user.streak.current >= 2 && (
                    <button
                        onClick={() => navigate('/app/impact')}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-3 flex items-center gap-3 text-white shadow-md active:scale-95 transition-all"
                    >
                        <div className="text-3xl">🔥</div>
                        <div className="flex-1 text-left">
                            <p className="font-black text-base">¡{user.streak.current} días de racha!</p>
                            <p className="text-xs text-white/80">
                                x{user.streak.multiplier} puntos activo · Pide hoy para no perderla
                            </p>
                        </div>
                        <Flame size={20} className="text-yellow-200" />
                    </button>
                )}

                {/* Flash Deals — real-time limited offers */}
                <FlashDealsSection />

                {/* Hot Deals Section — expiring products */}
                {hotDealsVenues.length > 0 && (
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <Zap size={18} className="text-red-500" />
                                <h2 className="text-base font-black text-gray-900">Ofertas que vencen pronto</h2>
                            </div>
                            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                                ¡Hoy!
                            </span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 min-w-0">
                            {hotDealsVenues.map(venue => (
                                <div key={venue.id} className="flex-shrink-0 w-[200px]">
                                    <VenueCard
                                        venue={venue}
                                        userLocation={hasUserLocation ? { lat: latitude as number, lng: longitude as number } : undefined}
                                        soonestExpiry={venueExpiryMap.get(venue.id)}
                                        totalStock={venueStockMap.get(venue.id)}
                                        isTrending={trendingVenueIds.has(venue.id)}
                                        hasDynamicPricing={dynamicVenueIds.has(venue.id)}
                                        ratingStats={venueRatingMap.get(venue.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trending Section */}
                {trendingVenueIds.size > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={18} className="text-emerald-600" />
                            <h2 className="text-base font-black text-gray-900">Trending ahora</h2>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 min-w-0">
                            {filteredVenues
                                .filter(v => trendingVenueIds.has(v.id))
                                .map(venue => (
                                    <div key={venue.id} className="flex-shrink-0 w-[220px]">
                                        <VenueCard
                                            venue={venue}
                                            userLocation={hasUserLocation ? { lat: latitude as number, lng: longitude as number } : undefined}
                                            soonestExpiry={venueExpiryMap.get(venue.id)}
                                            totalStock={venueStockMap.get(venue.id)}
                                            isTrending
                                            hasDynamicPricing={dynamicVenueIds.has(venue.id)}
                                            ratingStats={venueRatingMap.get(venue.id)}
                                        />
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* All Venues */}
                <div>
                    <div className="flex justify-between items-end mb-3">
                        <h2 className="text-base font-black text-gray-900">
                            {selectedCategory === 'all' ? 'Todos los lugares' : selectedCategory}
                        </h2>
                        <span className="text-emerald-600 text-sm font-medium">
                            {filteredVenues.length.toLocaleString('es-CO')} lugares
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredVenues.length > 0 ? (
                            filteredVenues.map((venue) => (
                                <VenueCard
                                    key={venue.id}
                                    venue={venue}
                                    userLocation={hasUserLocation ? { lat: latitude as number, lng: longitude as number } : undefined}
                                    soonestExpiry={
                                        venueExpiryMap.get(venue.id) ?? getUrgentExpiryFallback(venue.closingTime)
                                    }
                                    totalStock={venueStockMap.get(venue.id)}
                                    isTrending={trendingVenueIds.has(venue.id)}
                                    hasDynamicPricing={dynamicVenueIds.has(venue.id)}
                                    ratingStats={venueRatingMap.get(venue.id)}
                                />
                            ))
                        ) : (
                            <div className="col-span-full py-10 text-center">
                                <div className="inline-block p-4 bg-gray-100 rounded-full mb-3">
                                    <Logo size="lg" className="shadow-none border-none bg-transparent" iconColor="#9ca3af" />
                                </div>
                                <p className="text-gray-500 font-medium">No encontramos lugares con ese filtro</p>
                                <button
                                    onClick={() => {
                                        setSelectedCategory('all');
                                        setSelectedDietaryTags([]);
                                        setSearchQuery('');
                                    }}
                                    className="mt-2 text-emerald-600 font-bold hover:underline text-sm"
                                >
                                    Ver todos los lugares
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Location Selector Modal */}
            {showLocationSelector && (
                <LocationSelector onClose={() => setShowLocationSelector(false)} />
            )}

            {/* Onboarding for New Users */}
            {user && user.hasSeenOnboarding === false && (
                <OnboardingTour onComplete={() => window.location.reload()} />
            )}
        </div>
    );
};

// Helper temporal que genera un ISO Date basado en la hora de cierre del local para incitar Urgencia Visual (CTR)
const getUrgentExpiryFallback = (closingTime?: string): string | undefined => {
    if (!closingTime) return undefined;
    const now = new Date();
    const [hours, minutes] = closingTime.split(':').map(Number);
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours > 0 && diffHours <= 6) {
        return targetDate.toISOString();
    }
    return undefined;
};

export default CustomerHome;
