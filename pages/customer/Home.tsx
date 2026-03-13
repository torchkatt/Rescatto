import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { venueService } from '../../services/venueService';
import { Venue, RatingStats } from '../../types';
import { VenueCard } from '../../components/customer/venue/VenueCard';
import { FeaturedDealCard } from '../../components/customer/home/FeaturedDealCard';
import { getRatingStats } from '../../services/ratingService';

import { HomeSkeletonLoader } from '../../components/customer/common/Loading';
import { CategoriesBar } from '../../components/customer/home/CategoriesBar';
import { useTranslation } from 'react-i18next';
import {
    Search, MapPin, User, ShoppingBag, LogOut, ChevronDown,
    Heart, Leaf, Flame, TrendingUp, Zap, RefreshCw, Bell, Clock, Star, MessageCircle
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { useLocation } from '../../context/LocationContext';
import { LocationSelector } from '../../components/customer/home/LocationSelector';
import { OnboardingTour } from '../../components/customer/OnboardingTour';
import { FlashDealsSection } from '../../components/customer/home/FlashDealBanner';
import { calculateDistance } from '../../services/locationService';
import { logger } from '../../utils/logger';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { SEO } from '../../components/common/SEO';
import { SearchOverlay } from '../../components/customer/home/SearchOverlay';
import { NotificationDisplay } from '../../components/common/NotificationDisplay';

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
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);

    const [showOnlyActive, setShowOnlyActive] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchVenues = async () => {
            if (loading === false && !user) return; 

            try {
                setLoading(true);
                const [allVenues, expiryMap, stockResult, dynIds] = await Promise.all([
                    venueService.getAllVenues(city || undefined),
                    venueService.getExpiringProductsByVenue(),
                    venueService.getStockCountByVenue(),
                    venueService.getDynamicPricingVenueIds(),
                ]);
                setVenues(allVenues);
                setVenueExpiryMap(expiryMap);
                setVenueStockMap(stockResult.stockMap);
                setVenueProductCountMap(stockResult.productCountMap);
                setDynamicVenueIds(dynIds);

                // Optimized Rating Stats fetching
                const ratingMap = new Map<string, RatingStats>();
                await Promise.all(
                    allVenues.map(async (v) => {
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

        fetchVenues();
    }, [user?.id, city]);

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

    // Listen for custom event to focus search
    useEffect(() => {
        const handleFocusSearch = () => {
            searchInputRef.current?.focus();
            searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        window.addEventListener('focus-rescatto-search', handleFocusSearch);
        return () => window.removeEventListener('focus-rescatto-search', handleFocusSearch);
    }, []);

    const handleLogout = async () => {
        try {
            sessionStorage.setItem('rescatto_manual_logout', 'true');
            await logout();
            window.location.href = '/#/login';
            window.location.reload();
        } catch (error) {
            logger.error('CustomerHome: Logout failed', error);
            window.location.href = '/#/login';
        }
    };

    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const hasUserLocation = latitude !== null && longitude !== null;

    const sortedVenues = useMemo(() => {
        if (!hasUserLocation) return venues;
        return [...venues].sort((a, b) => {
            const distA = calculateDistance(latitude as number, longitude as number, a.latitude, a.longitude);
            const distB = calculateDistance(latitude as number, longitude as number, b.latitude, b.longitude);
            return (distA || 999) - (distB || 999);
        });
    }, [venues, hasUserLocation, latitude, longitude]);

    const filteredVenues = useMemo(() => sortedVenues.filter(venue => {
        const matchesCategory = selectedCategory === 'all' || (venue.categories?.includes(selectedCategory) ?? true);
        const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesActive = !showOnlyActive || venueStockMap.has(venue.id);
        return matchesCategory && matchesSearch && matchesActive;
    }), [sortedVenues, selectedCategory, searchQuery, showOnlyActive, venueStockMap]);

    const hotDealsVenues = useMemo(() => {
        return filteredVenues
            .filter(v => venueExpiryMap.has(v.id))
            .slice(0, 6);
    }, [filteredVenues, venueExpiryMap]);

    if (loading) return <HomeSkeletonLoader />;

    return (
        <div className="pb-40 bg-white min-h-screen">
            <SEO 
                title={t('explore')} 
                description={t('home_subtitle')}
            />
            {/* Premium Header */}
            <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-40">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <button 
                            onClick={() => setShowLocationSelector(true)}
                            className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100/50 group active:scale-95 transition-all"
                        >
                            <MapPin size={16} className="text-emerald-500" />
                            <span className="text-sm font-black text-emerald-800 truncate max-w-[150px]">
                                {city || 'Downtown'}
                            </span>
                            <ChevronDown size={14} className="text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
                        </button>
                        
                        <div className="flex items-center gap-3">
                            <NotificationDisplay />
                        </div>
                    </div>

                    <div className="mb-6">
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">
                            {user?.fullName ? t('hello', { name: user.fullName.split(' ')[0] }) : t('welcome')}
                        </h1>
                        <p className="text-gray-400 font-bold text-lg">
                            {t('home_subtitle')}
                        </p>
                    </div>

                    {/* Compact Gamification Banner */}
                    {user && !user.isGuest && (
                        <div 
                            onClick={() => navigate('/app/impact')}
                            className="mb-8 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-[1.5rem] p-4 text-white shadow-lg shadow-emerald-200/50 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group"
                        >
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
                            
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-inner">
                                    <Flame 
                                        size={24} 
                                        className={`${(user.streak?.current || 0) >= 3 ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]' : 'text-white/80'}`} 
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg font-black">{user.streak?.current || 0}</span>
                                        <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{t('streak_days')}</span>
                                    </div>
                                    <div className="bg-yellow-400/90 text-yellow-900 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 mt-0.5 w-max">
                                        <Zap size={10} /> x{user.streak?.multiplier?.toFixed(1) || '1.0'}
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 text-right">
                                <p className="text-[9px] font-black text-white/70 uppercase tracking-widest mb-0.5">{t('my_points')}</p>
                                <p className="text-xl font-black leading-none flex items-center justify-end gap-1">
                                    {(user.impact?.points || 0).toLocaleString('es-CO')}
                                    <span className="text-yellow-300 text-sm">💎</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Unified Search Bar */}
                    <div className="mb-8 relative group">
                        <div className="absolute inset-x-0 -bottom-2 h-8 bg-emerald-600/5 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <div className="relative flex items-center bg-gray-50 border-2 border-transparent focus-within:border-emerald-500/20 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-emerald-500/10 rounded-2xl transition-all duration-300">
                            <div className="pl-5 pr-3 py-4 text-gray-400">
                                <Search size={22} className="group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('search_placeholder')}
                                className="w-full py-4 pr-12 bg-transparent text-gray-900 placeholder-gray-400 font-bold focus:outline-none text-base"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 p-1 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors"
                                >
                                    <LogOut size={12} className="rotate-45" /> 
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Modern Categories Bar */}
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {['all', 'italian', 'japanese', 'american', 'french', 'healthy', 'bakery'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat.toLowerCase())}
                                className={`px-6 py-2.5 rounded-full text-sm font-black whitespace-nowrap transition-all border ${
                                    (selectedCategory === cat.toLowerCase() || (cat === 'all' && selectedCategory === 'all'))
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                    : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200 hover:bg-emerald-50'
                                }`}
                            >
                                {t(`cat_${cat.toLowerCase()}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {/* Featured Deals Section */}
                {hotDealsVenues.length > 0 && (
                <section className="mb-10">
                    <div className="px-6 flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Logo size="sm" className="bg-transparent shadow-none border-none p-0" iconColor="#10b981" />
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('featured_deals')}</h2>
                        </div>
                        <button className="text-emerald-600 font-black text-sm hover:underline">{t('see_all')}</button>
                    </div>
                    
                    <div className="flex gap-6 overflow-x-auto no-scrollbar px-6 pb-6">
                        {hotDealsVenues.map(venue => (
                            <FeaturedDealCard 
                                key={venue.id}
                                venue={venue}
                                userLocation={hasUserLocation ? { lat: latitude as number, lng: longitude as number } : undefined}
                                ratingStats={venueRatingMap.get(venue.id)}
                            />
                        ))}
                    </div>
                </section>
                )}

                {/* Ending Soon Section (List View) */}
                {filteredVenues.length > 0 && (
                <section className="px-6 mb-12">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Clock size={24} className="text-red-500" />
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('ending_soon')}</h2>
                            <span className="bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-red-100">
                                {t('limited')}
                            </span>
                        </div>
                        <button className="text-emerald-600 font-black text-sm hover:underline">{t('see_all')}</button>
                    </div>

                    <div className="space-y-4">
                        {filteredVenues.slice(0, 4).map(venue => (
                            <div 
                                key={venue.id}
                                onClick={() => navigate(`/app/venue/${venue.id}`)}
                                className="flex items-center gap-4 bg-white p-3 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.99] transition-all group cursor-pointer"
                            >
                                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                                    <img 
                                        src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/200/200`} 
                                        alt={venue.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-lg">
                                        -50%
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black text-gray-900 truncate tracking-tight">{venue.name}</h3>
                                    <p className="text-sm font-bold text-gray-400 truncate mb-2">
                                        {venue.businessType || t('surprise_pack')}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-xl font-black text-emerald-600">
                                                    ${(venueStockMap.get(venue.id) ? '4.500' : '9.900')}
                                                </span>
                                                <span className="text-xs font-bold text-gray-300 line-through">$18.000</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Star size={10} className="text-amber-400 fill-current" />
                                                <span className="text-xs font-black text-gray-500">
                                                    {venue.rating?.toFixed(1) || '4.5'}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/app/venue/${venue.id}`);
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                        >
                                            {t('view_pack')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                )}

                {/* All Places Grid */}
                {filteredVenues.length > 0 ? (
                <section className="px-6 pb-28">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-5">{t('all_places')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVenues.map(venue => (
                            <VenueCard 
                                key={venue.id}
                                venue={venue}
                                userLocation={hasUserLocation ? { lat: latitude as number, lng: longitude as number } : undefined}
                                ratingStats={venueRatingMap.get(venue.id)}
                            />
                        ))}
                    </div>
                </section>
                ) : (
                    <div className="px-6 pb-32 text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                            <Search size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">{t('no_places_title')}</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">
                            {t('no_places_desc')}
                        </p>
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            {/* Bottom Navigation is now Global in App.tsx */}

            {/* Modals */}
            {showLocationSelector && (
                <LocationSelector onClose={() => setShowLocationSelector(false)} />
            )}
            {user && user.hasSeenOnboarding === false && (
                <OnboardingTour onComplete={() => window.location.reload()} />
            )}

            {/* Global Search Overlay */}
            <SearchOverlay 
                isOpen={isSearchOpen} 
                onClose={() => setIsSearchOpen(false)} 
            />
        </div>
    );
};

export default CustomerHome;
