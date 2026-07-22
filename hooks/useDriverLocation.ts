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
    const lastWriteRef = useRef<{ time: number; lat: number; lon: number } | null>(null);

    // Throttle de escrituras: el GPS puede emitir varias veces por segundo,
    // pero solo escribimos a Firestore si pasaron >=5s desde la última escritura
    // O si el driver se movió >=25m (evita escribir cada tick estando detenido/en tráfico lento).
    const MIN_WRITE_INTERVAL_MS = 5000;
    const MIN_DISTANCE_METERS = 25;

    const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

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

            const { latitude, longitude } = position.coords;
            const newLocation: DriverLocation = {
                userId: user.id,
                latitude,
                longitude,
                heading: position.coords.heading || undefined,
                speed: position.coords.speed || undefined,
                lastUpdate: new Date().toISOString(),
                isActive: true,
            };

            // Estado local siempre se actualiza (UI del driver reacciona al instante).
            setLocation(newLocation);

            const now = Date.now();
            const last = lastWriteRef.current;
            if (last) {
                const elapsed = now - last.time;
                const moved = haversineMeters(last.lat, last.lon, latitude, longitude);
                if (elapsed < MIN_WRITE_INTERVAL_MS && moved < MIN_DISTANCE_METERS) {
                    return;
                }
            }

            try {
                const locationRef = doc(db, 'drivers_locations', user.id);
                await setDoc(locationRef, {
                    ...newLocation,
                    serverTimestamp: Timestamp.now(),
                }, { merge: true });
                lastWriteRef.current = { time: now, lat: latitude, lon: longitude };
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
