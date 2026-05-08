import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { logger } from '../../../utils/logger';

interface TrackingMapProps {
  driverCoords?: { lat: number, lng: number };
  venueCoords?: { lat: number, lng: number };
  destinationCoords?: { lat: number, lng: number };
  orderStatus: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '16px'
};

const center = {
  lat: 4.6097, // Bogotá default
  lng: -74.0817
};

const TrackingMap: React.FC<TrackingMapProps> = ({ 
  driverCoords, 
  venueCoords, 
  destinationCoords,
  orderStatus 
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const mapCenter = useMemo(() => {
    if (driverCoords) return driverCoords;
    if (venueCoords) return venueCoords;
    return center;
  }, [driverCoords, venueCoords]);

  const path = useMemo(() => {
    const p = [];
    if (venueCoords) p.push(venueCoords);
    if (driverCoords) p.push(driverCoords);
    if (destinationCoords) p.push(destinationCoords);
    return p;
  }, [venueCoords, driverCoords, destinationCoords]);

  if (!isLoaded) return <div className="h-[250px] bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center text-gray-400 text-sm">Cargando mapa...</div>;
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      return null; // No API key, don't show map
  }

  return (
    <div className="relative w-full h-[250px] rounded-2xl overflow-hidden shadow-inner border border-gray-100 my-4">
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={14}
            options={{
                disableDefaultUI: true,
                zoomControl: true,
                styles: [
                    {
                        "featureType": "poi",
                        "stylers": [{ "visibility": "off" }]
                    }
                ]
            }}
        >
            {venueCoords && (
                <Marker 
                    position={venueCoords} 
                    label="Restaurante"
                    icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png'
                    }}
                />
            )}
            {driverCoords && (
                <Marker 
                    position={driverCoords} 
                    label="Driver"
                    icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/motorcycle.png'
                    }}
                />
            )}
            {destinationCoords && (
                <Marker 
                    position={destinationCoords} 
                    label="Tú"
                    icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }}
                />
            )}
            
            {path.length > 1 && (
                <Polyline
                    path={path}
                    options={{
                        strokeColor: '#10b981',
                        strokeOpacity: 0.8,
                        strokeWeight: 3,
                        geodesic: true,
                    }}
                />
            )}
        </GoogleMap>
        
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Seguimiento en vivo
            </p>
        </div>
    </div>
  );
};

export default React.memo(TrackingMap);
