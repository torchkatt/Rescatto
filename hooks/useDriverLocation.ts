import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { DriverLocation } from '../types';
import { logger } from '../utils/logger';

/**
 * useDriverLocation Hook
 * Handles real-time location updates for drivers and tracking for customers.
 */
export function useDriverLocation(driverId?: string) {
    const { user } = useAuth();
    const [location, setLocation] = useState<DriverLocation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // 1. AS A DRIVER: Update own location
    useEffect(() => {
        const isDriver = user?.role === 'DRIVER';
        if (!isDriver || driverId) return;

        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            return;
        }

        const updateLocation = async (position: GeolocationPosition) => {
            if (!user?.id) return;

            const newLocation: DriverLocation = {
                userId: user.id,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
                lastUpdate: new Date().toISOString(),
                isActive: true,
            };

            try {
                const locationRef = doc(db, 'drivers_locations', user.id);
                await setDoc(locationRef, {
                    ...newLocation,
                    serverTimestamp: Timestamp.now(),
                }, { merge: true });
                setLocation(newLocation);
            } catch (err) {
                logger.error('Error updating driver location:', err);
            }
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
            updateLocation,
            (err) => {
                setError(err.message);
                logger.error('Geolocation error:', err);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            // Mark as inactive when stopping
            if (user?.id) {
                const locationRef = doc(db, 'drivers_locations', user.id);
                setDoc(locationRef, { isActive: false }, { merge: true }).catch(console.error);
            }
        };
    }, [user?.id, user?.role, driverId]);

    // 2. AS A CUSTOMER/ADMIN: Track a specific driver
    useEffect(() => {
        if (!driverId) return;

        const locationRef = doc(db, 'drivers_locations', driverId);
        const unsubscribe = onSnapshot(locationRef, (docSnap) => {
            if (docSnap.exists()) {
                setLocation(docSnap.data() as DriverLocation);
            }
        }, (err) => {
            logger.error('Error tracking driver location:', err);
            setError(err.message);
        });

        return () => unsubscribe();
    }, [driverId]);

    return { location, error };
}

export default useDriverLocation;
