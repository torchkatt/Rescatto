import React, { useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { DriverLocation } from '../../../types';
import { Navigation, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface LiveTrackingMapProps {
    location: DriverLocation | null;
    venueLocation?: { lat: number; lng: number };
    destinationLocation?: { lat: number; lng: number };
}

const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '1.5rem',
};

const options = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
        {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }]
        },
        // Premium Dark/Soft Style
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#e9e9e9" }, { "lightness": "17" }]
        },
        {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{ "color": "#f5f5f5" }, { "lightness": "20" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#ffffff" }, { "lightness": "17" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#ffffff" }, { "lightness": "29" }, { "weight": "0.2" }]
        }
    ]
};

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ 
    location, 
    venueLocation, 
    destinationLocation 
}) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    const center = useMemo(() => {
        if (location) return { lat: location.latitude, lng: location.longitude };
        if (venueLocation) return venueLocation;
        return { lat: 4.6097, lng: -74.0817 }; // Bogotá default
    }, [location, venueLocation]);

    const [map, setMap] = React.useState<google.maps.Map | null>(null);

    const onLoad = useCallback(function callback(m: google.maps.Map) {
        setMap(m);
    }, []);

    const onUnmount = useCallback(function callback(m: google.maps.Map) {
        setMap(null);
    }, []);

    if (!isLoaded) return (
        <div className="w-full h-[400px] bg-gray-100 animate-pulse rounded-3xl flex items-center justify-center">
            <Navigation className="text-gray-300 animate-bounce" size={48} />
        </div>
    );

    return (
        <div className="relative group">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={15}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={options}
            >
                {/* Marker del Domiciliario */}
                {location && (
                    <Marker
                        position={{ lat: location.latitude, lng: location.longitude }}
                        icon={{
                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                            scale: 6,
                            fillColor: "#10b981",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#ffffff",
                            rotation: location.heading || 0
                        }}
                    />
                )}

                {/* Marker de la Sede */}
                {venueLocation && (
                    <Marker
                        position={venueLocation}
                        icon={{
                            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                        }}
                    />
                )}

                {/* Marker de Destino */}
                {destinationLocation && (
                    <Marker
                        position={destinationLocation}
                        icon={{
                            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                        }}
                    />
                )}
            </GoogleMap>

            {/* Overlay Info Layer */}
            {location && (
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                            <Navigation size={20} className={location.isActive ? "animate-pulse" : ""} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900">
                                {location.isActive ? "Domiciliario en movimiento" : "Última ubicación conocida"}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock size={12} />
                                <span>
                                    Hacer {formatDistanceToNow(new Date(location.lastUpdate), { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>
                    {location.speed && (
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-medium">Velocidad</p>
                            <p className="text-lg font-black text-emerald-600">
                                {Math.round(location.speed * 3.6)} <span className="text-[10px]">km/h</span>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LiveTrackingMap;
