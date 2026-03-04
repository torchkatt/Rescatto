import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

// Ubicación por defecto (ej., Bogotá)
const DEFAULT_LOCATION = {
    lat: 4.6097,
    lng: -74.0817,
    address: 'Ubicación predeterminada',
    city: 'Bogotá'
};

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<LocationState>({
        latitude: null, // Iniciar en null para forzar detección o entrada manual
        longitude: null,
        address: 'Detectando ubicación...',
        city: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        // Intentar detectar ubicación al montar
        detectLocation();
    }, []);

    const detectLocation = async () => {
        setLocation(prev => ({ ...prev, loading: true, error: null }));

        if (!navigator.geolocation) {
            setLocation({
                latitude: DEFAULT_LOCATION.lat,
                longitude: DEFAULT_LOCATION.lng,
                address: DEFAULT_LOCATION.address,
                city: DEFAULT_LOCATION.city,
                error: 'Geolocalización no soportada por el navegador.',
                loading: false,
            });
            return;
        }

        const successHandler = async (position: GeolocationPosition) => {
            const { latitude, longitude } = position.coords;
            try {
                const { address, city } = await reverseGeocode(latitude, longitude);
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
                setLocation({
                    latitude,
                    longitude,
                    address: 'Ubicación detectada',
                    city: 'Desconocida',
                    error: null,
                    loading: false,
                });
            }
        };

        const errorHandler = (error: GeolocationPositionError) => {
            // Usar debug en lugar de warn para evitar ruido excesivo en consola
            logger.debug("Error de ubicación:", error.message);
            // Retrocede a ubicación por defecto silenciosamente o con mensaje amigable
            // No tratar como error crítico para evitar romper la UI
            setLocation({
                latitude: DEFAULT_LOCATION.lat,
                longitude: DEFAULT_LOCATION.lng,
                address: DEFAULT_LOCATION.address,
                city: DEFAULT_LOCATION.city,
                error: null, // Limpiar error para mostrar estado por defecto en lugar de estado de error
                loading: false,
            });
        };

        // Primero intentar con alta precisión
        navigator.geolocation.getCurrentPosition(
            successHandler,
            (error) => {
                // Si alta precisión falla, intentar con baja precisión (mejor para algunos escritorios/VPNs)
                logger.log("Falló alta precisión, reintentando con baja precisión...");
                navigator.geolocation.getCurrentPosition(
                    successHandler,
                    errorHandler,
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: Infinity }
                );
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const setManualLocation = (lat: number, lng: number, address: string, city: string) => {
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
