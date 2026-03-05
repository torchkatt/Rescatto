import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, Leaf } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { venueService } from '../../services/venueService';
import { Venue } from '../../types';
import { VenueCard } from '../../components/customer/venue/VenueCard';
import { LoadingSpinner } from '../../components/customer/common/Loading';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { GuestPromptBanner } from '../../components/customer/common/GuestPromptBanner';

const Favorites: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { favorites, loading: favsLoading } = useFavorites();
    const { latitude, longitude } = useLocation();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGuestBanner, setShowGuestBanner] = useState(!!user?.isGuest);

    useEffect(() => {
        if (favsLoading) return;

        if (favorites.length === 0) {
            setLoading(false);
            return;
        }

        const fetchFavoriteVenues = async () => {
            try {
                const venuePromises = favorites.map(id => venueService.getVenueById(id));
                const results = await Promise.all(venuePromises);
                setVenues(results.filter((v): v is Venue => v !== null));
            } catch {
                // venues stays empty
            } finally {
                setLoading(false);
            }
        };

        fetchFavoriteVenues();
    }, [favorites, favsLoading]);

    const userLocation = latitude && longitude ? { lat: latitude, lng: longitude } : undefined;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 overflow-x-hidden">
            {/* Banner de invitado */}
            {showGuestBanner && (
                <GuestPromptBanner
                    featureName="tus favoritos"
                    icon="❤️"
                    onDismiss={() => setShowGuestBanner(false)}
                />
            )}
            {/* Header */}
            <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
                    >
                        <ArrowLeft size={20} className="text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Heart size={20} className="text-red-500 fill-current" />
                        <h1 className="text-lg font-bold text-gray-900">Mis Favoritos</h1>
                    </div>
                    {favorites.length > 0 && (
                        <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                            {favorites.length}
                        </span>
                    )}
                </div>
            </header>

            <main className="p-4">
                {loading || favsLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : venues.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <Heart size={40} className="text-red-300" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">
                            Sin favoritos todavía
                        </h2>
                        <p className="text-gray-500 text-sm mb-6 max-w-xs">
                            Toca el corazón en cualquier restaurante para guardarlo aquí y acceder rápido.
                        </p>
                        <button
                            onClick={() => navigate('/app')}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-emerald-700 transition-colors active:scale-95 flex items-center gap-2"
                        >
                            <Leaf size={16} />
                            Explorar restaurantes
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {venues.map(venue => (
                            <VenueCard
                                key={venue.id}
                                venue={venue}
                                userLocation={userLocation}
                                soonestExpiry={getUrgentExpiryFallback(venue.closingTime)}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

// Helper temporal que genera un ISO Date basado en la hora de cierre del local para incitar Urgencia Visual (CTR)
const getUrgentExpiryFallback = (closingTime?: string): string | undefined => {
    if (!closingTime) return undefined;
    const now = new Date();
    const [hours, minutes] = closingTime.split(':').map(Number);
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // Solo mostrar urgencia si la hora de cierre es en las próximas 6 horas y no ha pasado
    const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours > 0 && diffHours <= 6) {
        return targetDate.toISOString();
    }
    return undefined;
};

export default Favorites;
