import React from 'react';
import { HeroDealCard } from './HeroDealCard';
import { ActiveVenueCard } from './ActiveVenueCard';
import { Product, Venue, User } from '../../../types';
import { MapPin, Search, ChevronDown, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationDisplay } from '../../common/NotificationDisplay';
import { CategoryBar } from './CategoryBar';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  user: User | null;
  heroDeal: { product: Product; discountPct: number } | null;
  venueNamesMap: Map<string, string>;
  activeVenues: Venue[];
  venueProductCountMap: Map<string, number>;
  userLocation?: { lat: number; lng: number };
  city?: string | null;
  onOpenLocation: () => void;
  onOpenSearch: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  user,
  heroDeal,
  venueNamesMap,
  activeVenues,
  venueProductCountMap,
  userLocation,
  city,
  onOpenLocation,
  onOpenSearch,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col w-full">
      {/* Mobile Header Context */}
      <header className="px-6 pt-safe-top pb-4 bg-brand-bg lg:hidden">
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
            className="mb-4 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-4 py-3 text-white cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/10"
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

        <div className="mb-6">
          <CategoryBar />
        </div>
      </header>

      {/* Hero Deal Card */}
      {heroDeal && (
        <div className="mb-10 px-6 lg:px-0">
          <HeroDealCard
            product={heroDeal.product}
            venueName={venueNamesMap.get(heroDeal.product.venueId) || ''}
            discountPct={heroDeal.discountPct}
          />
        </div>
      )}

      {/* Active Venues Carousel (Mobile) */}
      {activeVenues.length > 0 && (
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
            {activeVenues.map((venue) => (
              <ActiveVenueCard
                key={venue.id}
                venue={venue}
                productCount={venueProductCountMap.get(venue.id)}
                userLocation={userLocation}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
