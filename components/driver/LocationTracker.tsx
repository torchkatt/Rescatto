import React, { useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { logger } from '../../utils/logger';

interface LocationTrackerProps {
  isActive: boolean;
  updateInterval?: number; // en ms
}

/**
 * Componente silencioso que rastrea la ubicación del driver 
 * y la envía al backend si isActive es true.
 */
const LocationTracker: React.FC<LocationTrackerProps> = ({ 
  isActive, 
  updateInterval = 60000 // por defecto 1 minuto
}) => {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    if (!isActive) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      logger.error('Geolocalización no soportada en este navegador/dispositivo');
      return;
    }

    const updateLocationFn = httpsCallable(functions, 'updateDriverLocation');

    const handleSuccess = async (position: GeolocationPosition) => {
      const now = Date.now();
      // Limitar actualizaciones para ahorrar batería y tokens
      if (now - lastUpdate.current < updateInterval) return;

      const { latitude, longitude } = position.coords;
      
      try {
        await updateLocationFn({ lat: latitude, lng: longitude });
        lastUpdate.current = now;
        logger.log(`Ubicación de driver actualizada: ${latitude}, ${longitude}`);
      } catch (error) {
        logger.error('Error actualizando ubicación de driver:', error);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      logger.error('Error de geolocalización:', error.message);
    };

    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [isActive, updateInterval]);

  return null; // Componente sin UI
};

export default LocationTracker;
