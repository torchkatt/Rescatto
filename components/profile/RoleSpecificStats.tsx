import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, Venue } from '../../types';
import { ImpactStats } from '../customer/profile/ImpactStats';
import { UserBadges } from '../customer/profile/UserBadges';
import { UserWallet } from '../customer/profile/UserWallet';
import { RecentOrders } from '../customer/profile/RecentOrders';
import { Package, Star, TrendingUp, Clock, AlertCircle, ShoppingBag } from 'lucide-react';
import { venueService } from '../../services/venueService';
import { VenueInfoCard } from './VenueInfoCard';
import { logger } from '../../utils/logger';

interface RoleSpecificStatsProps {
    user: User;
    onRedeem?: (rewardId: string) => Promise<void>;
}

export const RoleSpecificStats: React.FC<RoleSpecificStatsProps> = ({ user, onRedeem }) => {
    const navigate = useNavigate();
    const [venues, setVenues] = useState<Venue[]>([]);
    const [loadingVenues, setLoadingVenues] = useState(false);

    const userVenueId = user.venueId;
    const userVenueIds = user.venueIds;
    const userRole = user.role;

    useEffect(() => {
        const loadVenues = async () => {
            if (userRole === UserRole.VENUE_OWNER || userRole === UserRole.KITCHEN_STAFF || userRole === UserRole.ADMIN) {
                setLoadingVenues(true);
                try {
                    // Logic to fetch venues based on user linkage (venueId string or venueIds array)
                    const venueIdsToFetch = userVenueIds && userVenueIds.length > 0
                        ? userVenueIds
                        : (userVenueId && userVenueId !== 'default-venue' ? [userVenueId] : []);

                    if (venueIdsToFetch.length === 0) {
                        setVenues([]);
                        return;
                    }

                    // Use venueService to fetch details. optimize with Promise.all
                    const venuesData = await Promise.all(
                        venueIdsToFetch.map(id => venueService.getVenueById(id))
                    );

                    setVenues(venuesData.filter((v): v is Venue => v !== null));
                } catch (error) {
                    logger.error("Error loading profile venues", error);
                } finally {
                    setLoadingVenues(false);
                }
            }
        };

        loadVenues();
    }, [userVenueId, userVenueIds, userRole]);

    // --- CUSTOMER VIEW ---
    if (user.role === UserRole.CUSTOMER) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ImpactStats impact={user.impact} />
                <UserWallet points={user.impact?.points || 0} onRedeem={onRedeem || (async () => { })} />
                <UserBadges badges={user.impact?.badges} totalRescues={user.impact?.totalRescues || 0} />

                {/* Recent Orders */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingBag size={18} className="text-emerald-500" />
                            Pedidos Recientes
                        </h3>
                    </div>
                    <RecentOrders buyerId={user.id} />
                </section>

                {/* Favorites Quick Access */}
                <section>
                    <button
                        onClick={() => navigate('/app/favorites')}
                        className="w-full bg-white rounded-2xl p-5 border border-gray-100 shadow-sm 
                            hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 
                            transition-all duration-200 text-left active:scale-[0.99] group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">Mis Favoritos</p>
                                <p className="text-sm text-gray-500">Venues y productos que te gustan</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                </section>
            </div>
        );
    }

    // --- DRIVER VIEW ---
    if (user.role === UserRole.DRIVER) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-amber-500" />
                    Tu Rendimiento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Entregas Totales</p>
                            <p className="text-2xl font-bold text-gray-900">142</p> {/* Mock Data */}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl">
                            <Star size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Calificación</p>
                            <p className="text-2xl font-bold text-gray-900">4.8</p> {/* Mock Data */}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Tiempo Promedio</p>
                            <p className="text-2xl font-bold text-gray-900">28 min</p> {/* Mock Data */}
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100">
                    <h4 className="font-bold text-amber-900 mb-2">Consejo Pro</h4>
                    <p className="text-amber-800 text-sm">
                        Mantén tu calificación por encima de 4.5 para acceder a entregas prioritarias y bonificaciones semanales.
                    </p>
                </div>
            </div>
        );
    }

    // --- KITCHEN, VENUE OWNER & ADMIN VIEW ---
    if (user.role === UserRole.KITCHEN_STAFF || user.role === UserRole.VENUE_OWNER || user.role === UserRole.ADMIN) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" />
                    Estado Operativo
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-sm font-medium text-gray-500">Estado de Cuenta</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">Activo y Verificado</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 sm:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-gray-500">Sede(s) Asignada(s)</span>
                        </div>

                        {loadingVenues ? (
                            <div className="animate-pulse flex gap-4">
                                <div className="h-32 w-full bg-gray-100 rounded-xl"></div>
                            </div>
                        ) : venues.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {venues.map(venue => (
                                    <VenueInfoCard key={venue.id} venue={venue} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic flex items-center gap-2">
                                <AlertCircle size={16} /> No tienes ninguna sede asignada.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- DEFAULT / ADMIN ---
    return null;
};
