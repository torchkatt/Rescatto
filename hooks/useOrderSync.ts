import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Unsubscribe, Timestamp, QuerySnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, OrderStatus, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

interface OrderSyncOptions {
    onlyActive?: boolean;
    venueId?: string | string[];
    limit?: number;
}

/**
 * useOrderSync Hook
 * Provides a robust, real-time connection to orders based on user permissions.
 * Optimized for KDS, Admin, and Driver views.
 */
export function useOrderSync(options: OrderSyncOptions = {}) {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const [connected, setConnected] = useState(false);

    const { onlyActive = true, venueId: manualVenueId, limit: maxOrders = 100 } = options;

    const userId = user?.id;
    const userRole = user?.role;
    const userVenueId = user?.venueId;
    const userVenueIds = user?.venueIds;
    const manualVenueIdKey = useMemo(() => JSON.stringify(manualVenueId), [manualVenueId]);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        let unsubscribe: Unsubscribe = () => {};

        try {
            const ordersRef = collection(db, 'orders');
            let q;

            // 1. Determine Target Venues
            let targetVenues: string | string[] = 'all';
            if (manualVenueId) {
                targetVenues = manualVenueId;
            } else if (userRole !== UserRole.SUPER_ADMIN) {
                if (userVenueIds && userVenueIds.length > 0) {
                    targetVenues = userVenueIds;
                } else if (userVenueId) {
                    targetVenues = userVenueId;
                } else if (userRole !== UserRole.DRIVER && userRole !== UserRole.CUSTOMER) {
                    // Non-admin without venue shouldn't see orders
                    setOrders([]);
                    setLoading(false);
                    return;
                }
            }

            // 2. Build Query
            let conditions = [];

            if (userRole === UserRole.CUSTOMER) {
                conditions.push(where('customerId', '==', userId));
            } else if (userRole === UserRole.DRIVER) {
                conditions.push(where('driverId', '==', userId));
            } else if (targetVenues !== 'all') {
                if (Array.isArray(targetVenues)) {
                    conditions.push(where('venueId', 'in', targetVenues.slice(0, 30)));
                } else {
                    conditions.push(where('venueId', '==', targetVenues));
                }
            }

            if (onlyActive) {
                const activeStatuses = [
                    OrderStatus.PENDING,
                    OrderStatus.PAID,
                    OrderStatus.IN_PREPARATION,
                    OrderStatus.READY,
                    OrderStatus.DRIVER_ASSIGNED,
                    OrderStatus.IN_TRANSIT
                ];
                conditions.push(where('status', 'in', activeStatuses));
            }

            q = query(
                ordersRef,
                ...conditions,
                orderBy('createdAt', 'desc'),
                limit(maxOrders)
            );

            // 3. Listen for updates
            unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot: QuerySnapshot) => {
                const updatedOrders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt instanceof Timestamp 
                            ? data.createdAt.toDate().toISOString() 
                            : data.createdAt,
                    } as Order;
                });
                
                setOrders(updatedOrders);
                setLoading(false);
                setConnected(!snapshot.metadata.fromCache);
                setError(null);
            }, (err) => {
                logger.error('useOrderSync: Subscription error', err);
                setError(err);
                setLoading(false);
                setConnected(false);
            });

        } catch (err) {
            logger.error('useOrderSync: Setup error', err);
            setError(err);
            setLoading(false);
        }

        return () => {
            unsubscribe();
        };
    }, [userId, userRole, userVenueId, userVenueIds, manualVenueId, manualVenueIdKey, onlyActive, maxOrders]);

    const stats = useMemo(() => {
        return {
            total: orders.length,
            pending: orders.filter(o => o.status === OrderStatus.PAID).length,
            preparing: orders.filter(o => o.status === OrderStatus.IN_PREPARATION).length,
            ready: orders.filter(o => o.status === OrderStatus.READY).length,
            inTransit: orders.filter(o => o.status === OrderStatus.IN_TRANSIT).length,
        };
    }, [orders]);

    return { orders, loading, error, connected, stats };
}

export default useOrderSync;
