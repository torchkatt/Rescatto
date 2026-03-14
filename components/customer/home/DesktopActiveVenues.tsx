import React from 'react';
import { Venue } from '../../../types';
import { useTranslation } from 'react-i18next';
import { ActiveVenueCard } from './ActiveVenueCard';

interface DesktopActiveVenuesProps {
  venues: Venue[];
  venueProductCountMap: Map<string, number>;
  userLocation?: { lat: number; lng: number };
}

export const DesktopActiveVenues: React.FC<DesktopActiveVenuesProps> = ({
  venues,
  venueProductCountMap,
  userLocation,
}) => {
  const { t } = useTranslation();

  if (venues.length === 0) return null;

  return (
    <section className="hidden lg:block mb-16">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping opacity-25" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-dark tracking-tight leading-none mb-1">
              {t('active_now')}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                {venues.length} {t('venues_available')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-8">
        {venues.map(venue => (
          <ActiveVenueCard
            key={venue.id}
            venue={venue}
            productCount={venueProductCountMap.get(venue.id)}
            userLocation={userLocation}
            isDesktop
          />
        ))}
      </div>
    </section>
  );
};
