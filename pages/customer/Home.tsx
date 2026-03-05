import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { venueService } from '../../services/venueService';
import { Venue } from '../../types';
import { VenueCard } from '../../components/customer/venue/VenueCard';

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
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Lock scroll when user menu is open
    useEffect(() => {
        if (showUserMenu) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showUserMenu]);

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
            <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 overflow-x-hidden pt-safe-top">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button
                        type="button"
                        aria-label={`Cambiar ubicación. Actualmente: ${address}`}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onClick={() => setShowLocationSelector(true)}
                    >
                        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                            <MapPin size={18} />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-xs text-gray-500">Ubicación Actual</span>
                            <span className="font-bold text-sm text-gray-800 leading-none flex items-center gap-1">
                                {address} <ChevronDown size={14} />
                            </span>
                        </div>
                    </button>
                    {user && (
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md active:scale-95"
                            >
                                {user.fullName.charAt(0)}
                            </button>

                            {/* User Dropdown Menu */}
                            {showUserMenu && (
                                <>
                                    {/* Backdrop for mobile to prevent scroll and allow closing */}
                                    <div
                                        className="fixed inset-0 bg-black/5 z-40 lg:hidden"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
                                        {/* User Info Header */}
                                        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100">
                                            <p className="font-bold text-gray-900 truncate">{user.fullName}</p>
                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                            {/* Streak display in menu */}
                                            {(user.streak?.current ?? 0) >= 2 && (
                                                <p className="text-xs text-orange-600 font-bold mt-1 flex items-center gap-1">
                                                    🔥 {user.streak?.current} días de racha
                                                </p>
                                            )}
                                        </div>

                                        {/* Menu Items */}
                                        <div className="py-2">
                                            <button
                                                onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700 active:bg-gray-100"
                                            >
                                                <User size={20} className="text-emerald-600" />
                                                <span className="font-bold text-sm">Mi Perfil</span>
                                            </button>

                                            <button
                                                onClick={() => { setShowUserMenu(false); navigate('/app/orders'); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700 active:bg-gray-100"
                                            >
                                                <ShoppingBag size={20} className="text-emerald-600" />
                                                <span className="font-bold text-sm">Mis Pedidos</span>
                                            </button>

                                            <button
                                                onClick={() => { setShowUserMenu(false); navigate('/app/favorites'); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700 active:bg-gray-100"
                                            >
                                                <Heart size={20} className="text-red-500" />
                                                <span className="font-bold text-sm">Mis Favoritos</span>
                                            </button>

                                            <button
                                                onClick={() => { setShowUserMenu(false); navigate('/app/impact'); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700 active:bg-gray-100"
                                            >
                                                <Leaf size={20} className="text-emerald-600" />
                                                <span className="font-bold text-sm">Mi Impacto 🌱</span>
                                            </button>

                                            <button
                                                onClick={() => { setShowUserMenu(false); handleForceUpdate(); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors text-gray-700 active:bg-gray-100"
                                            >
                                                <RefreshCw size={20} className="text-blue-500" />
                                                <span className="font-bold text-sm">Actualizar App</span>
                                            </button>

                                            <div className="border-t border-gray-100 my-1"></div>

                                            <button
                                                onClick={() => { setShowUserMenu(false); handleLogout(); }}
                                                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600 cursor-pointer active:bg-red-100"
                                            >
                                                <LogOut size={20} />
                                                <span className="font-bold text-sm">Cerrar Sesión</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Search Bar */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                        <input
                            type="text"
                            id="venue-search"
                            aria-label="Buscar restaurantes y comida por nombre o dirección"
                            placeholder="Buscar comida, restaurante..."
                            className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Categories */}
                <CategoriesBar
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />

                {/* Dietary Filters */}
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar py-2 min-w-0">
                    {DIETARY_OPTIONS.map(option => (
                        <button
                            key={option.id}
                            onClick={() => toggleDietaryTag(option.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border active:scale-95 ${selectedDietaryTags.includes(option.id)
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300'
                                }`}
                        >
                            <span>{option.icon}</span>
                            {option.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 space-y-6">

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
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-50">
                            <p className="text-lg font-black text-emerald-600">{platformStats.totalStock.toLocaleString('es-CO')}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">porciones<br />disponibles</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-50">
                            <p className="text-lg font-black text-orange-500">{platformStats.activeVenues.toLocaleString('es-CO')}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">lugares<br />activos hoy</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-50">
                            <p className="text-lg font-black text-blue-600">
                                {Math.round(platformStats.totalStock * 0.4).toLocaleString('es-CO')} kg
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">de CO₂ por<br />salvar hoy</p>
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
