import React from 'react';
import { Venue, RatingStats } from '../../../types';
import { SectionHeader } from '../../ui/SectionHeader';
import { VenueCard } from '../venue/VenueCard';
import { MapPin, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { EmptyState } from '../../ui/EmptyState';

interface VenuesSectionProps {
  venues: Venue[];
  userLocation?: { lat: number; lng: number };
  venueRatingMap: Map<string, RatingStats>;
  venueStockMap: Map<string, number>;
  venueProductCountMap: Map<string, number>;
  venueExpiryMap: Map<string, string>;
  dynamicVenueIds: Set<string>;
  hasMoreVenues: boolean;
  loadMoreVenues: () => void;
  loadingMoreVenues: boolean;
}

export const VenuesSection: React.FC<VenuesSectionProps> = ({
  venues,
  userLocation,
  venueRatingMap,
  venueStockMap,
  venueProductCountMap,
  venueExpiryMap,
  dynamicVenueIds,
  hasMoreVenues,
  loadMoreVenues,
  loadingMoreVenues,
}) => {
  const { t } = useTranslation();

  return (
    <section className="px-6 lg:px-0 pb-28">
      <SectionHeader
        title={t('nearby_venues')}
        subtitle="Cerca de ti"
        icon={<MapPin size={24} className="text-gray-700" />}
      />

      {venues.length > 0 ? (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                userLocation={userLocation}
                ratingStats={venueRatingMap.get(venue.id)}
                totalStock={venueStockMap.get(venue.id)}
                productCount={venueProductCountMap.get(venue.id)}
                soonestExpiry={venueExpiryMap.get(venue.id)}
                hasDynamicPricing={dynamicVenueIds.has(venue.id)}
              />
            ))}
          </div>

          {hasMoreVenues && (
            <div className="flex justify-center mt-4">
              <Button
                variant="secondary"
                onClick={loadMoreVenues}
                isLoading={loadingMoreVenues}
                className="px-8 rounded-full font-black"
              >
                {loadingMoreVenues ? t('loading') : t('load_more_venues')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Search size={48} />}
          title={t('no_places_title')}
          description={t('no_places_desc')}
          size="md"
        />
      )}
    </section>
  );
};
