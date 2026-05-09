import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { reverseGeocode } from '../services/locationService';
import { logger } from '../utils/logger';

export interface LocationState {
    latitude: number | null;
    longitude: number | null;
    address: string;
    city: string | null; // [NUEVO]
    error: string | null;
    loading: boolean;
}

interface LocationContextType extends LocationState {
    detectLocation: () => Promise<void>;
    setManualLocation: (lat: number, lng: number, address: string, city: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);
const LOCATION_STORAGE_KEY = 'rescatto_location_v2';

// Limpiar cache antigua del servicio simulado
try { localStorage.removeItem('rescatto_location_v1'); } catch { /* */ }

// Ubicación por defecto (ej., Bogotá)
const DEFAULT_LOCATION = {
    lat: 4.6097,
    lng: -74.0817,
    address: 'Ubicación predeterminada',
    city: 'Bogotá'
};

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const getStoredLocation = (): LocationState | null => {
        try {
            const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (
                typeof parsed?.latitude === 'number' &&
                typeof parsed?.longitude === 'number' &&
                typeof parsed?.address === 'string' &&
                typeof parsed?.city === 'string'
            ) {
                return {
                    latitude: parsed.latitude,
                    longitude: parsed.longitude,
                    address: parsed.address,
                    city: parsed.city,
                    error: null,
                    loading: false,
                };
            }
        } catch (err) {
            logger.debug('LocationProvider: no se pudo leer ubicación guardada', err);
        }
        return null;
    };

    const persistLocation = (lat: number, lng: number, address: string, city: string) => {
        try {
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
                latitude: lat,
                longitude: lng,
                address,
                city,
            }));
        } catch (err) {
            logger.debug('LocationProvider: no se pudo persistir ubicación', err);
        }
    };

    const [location, setLocation] = useState<LocationState>(() =>
        getStoredLocation() ?? {
            latitude: null, // Iniciar en null para forzar detección o entrada manual
            longitude: null,
            address: 'Detectando ubicación...',
            city: null,
            error: null,
            loading: true,
        }
    );

    const detectLocation = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            setLocation(prev => ({ ...prev, loading: true, error: null }));

            if (!navigator.geolocation) {
                persistLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.address, DEFAULT_LOCATION.city);
                setLocation({
                    latitude: DEFAULT_LOCATION.lat,
                    longitude: DEFAULT_LOCATION.lng,
                    address: DEFAULT_LOCATION.address,
                    city: DEFAULT_LOCATION.city,
                    error: 'Geolocalización no soportada por el navegador.',
                    loading: false,
                });
                resolve();
                return;
            }

            const successHandler = async (position: GeolocationPosition) => {
                const { latitude, longitude } = position.coords;
                try {
                    const { address, city } = await reverseGeocode(latitude, longitude);
                    persistLocation(latitude, longitude, address, city);
                    setLocation({
                        latitude,
                        longitude,
                        address,
                        city,
                        error: null,
                        loading: false,
                    });
                } catch (error) {
                    logger.error("Error en geocodificación inversa:", error);
                    persistLocation(latitude, longitude, 'Ubicación detectada', 'Desconocida');
                    setLocation({
                        latitude,
                        longitude,
                        address: 'Ubicación detectada',
                        city: 'Desconocida',
                        error: null,
                        loading: false,
                    });
                }
                resolve();
            };

            const errorHandler = (error: GeolocationPositionError) => {
                logger.debug("Error de ubicación:", error.message);
                persistLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.address, DEFAULT_LOCATION.city);
                setLocation({
                    latitude: DEFAULT_LOCATION.lat,
                    longitude: DEFAULT_LOCATION.lng,
                    address: DEFAULT_LOCATION.address,
                    city: DEFAULT_LOCATION.city,
                    error: null,
                    loading: false,
                });
                resolve();
            };

            // Primero intentar con alta precisión
            navigator.geolocation.getCurrentPosition(
                successHandler,
                (error) => {
                    logger.log("Falló alta precisión, reintentando con baja precisión...");
                    navigator.geolocation.getCurrentPosition(
                        successHandler,
                        errorHandler,
                        { enableHighAccuracy: false, timeout: 10000, maximumAge: Infinity }
                    );
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    }, []);

    const locationLoading = location.loading;
    useEffect(() => {
        // Intentar detectar ubicación al montar solo si no hay una guardada.
        if (locationLoading) {
            detectLocation();
        }
    }, [locationLoading, detectLocation]);

    const setManualLocation = (lat: number, lng: number, address: string, city: string) => {
        persistLocation(lat, lng, address, city);
        setLocation({
            latitude: lat,
            longitude: lng,
            address,
            city,
            error: null,
            loading: false,
        });
    };

    return (
        <LocationContext.Provider value={{ ...location, detectLocation, setManualLocation }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation debe ser usado dentro de un LocationProvider');
    }
    return context;
};
