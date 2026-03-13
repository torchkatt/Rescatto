import React, { useMemo, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, HeatmapLayerF } from '@react-google-maps/api';
import { adminService } from '../../../services/adminService';
import { Venue } from '../../../types';
import { LoadingSpinner } from '../../customer/common/Loading';
import { Map as MapIcon, Info, Filter } from 'lucide-react';
import { logger } from '../../../utils/logger';

const containerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '2rem'
};

const center = {
    lat: 4.6097, // Bogotá default
    lng: -74.0817
};

export const RescueHeatmap: React.FC = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
    });

    useEffect(() => {
        const loadHeatmapData = async () => {
            try {
                const data = await adminService.getCompletedOrdersLocations();
                setOrdersLocations(data);
            } catch (error) {
                logger.error('Error loading order locations for heatmap:', error);
            } finally {
                setLoading(false);
            }
        };
        loadHeatmapData();
    }, []);

    const [loading, setLoading] = useState(true);
    const [ordersLocations, setOrdersLocations] = useState<any[]>([]);

    const heatmapData = useMemo(() => {
        if (!isLoaded || ordersLocations.length === 0) return [];
        
        return ordersLocations.map(o => ({
            location: new google.maps.LatLng(o.lat, o.lng),
            weight: o.weight || 1
        }));
    }, [isLoaded, ordersLocations]);

    if (loading) return <LoadingSpinner fullPage />;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <MapIcon className="text-emerald-600" />
                        Mapa de Impacto (Heatmap)
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Visualización de la densidad de rescates realizados en tiempo real.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
                        <Filter size={14} /> Filtrar Región
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={12}
                        options={{
                            styles: [
                                {
                                    "elementType": "geometry",
                                    "stylers": [{ "color": "#f5f5f5" }]
                                },
                                {
                                    "elementType": "labels.icon",
                                    "stylers": [{ "visibility": "off" }]
                                },
                                {
                                    "elementType": "labels.text.fill",
                                    "stylers": [{ "color": "#616161" }]
                                },
                                {
                                    "elementType": "labels.text.stroke",
                                    "stylers": [{ "color": "#f5f5f5" }]
                                },
                                {
                                    "featureType": "administrative.land_parcel",
                                    "elementType": "labels.text.fill",
                                    "stylers": [{ "color": "#bdbdbd" }]
                                },
                                {
                                    "featureType": "poi",
                                    "elementType": "geometry",
                                    "stylers": [{ "color": "#eeeeee" }]
                                },
                                {
                                    "featureType": "poi",
                                    "elementType": "labels.text.fill",
                                    "stylers": [{ "color": "#757575" }]
                                },
                                {
                                    "featureType": "road",
                                    "elementType": "geometry",
                                    "stylers": [{ "color": "#ffffff" }]
                                },
                                {
                                    "featureType": "water",
                                    "elementType": "geometry",
                                    "stylers": [{ "color": "#c9c9c9" }]
                                },
                                {
                                    "featureType": "water",
                                    "elementType": "labels.text.fill",
                                    "stylers": [{ "color": "#9e9e9e" }]
                                }
                            ],
                            disableDefaultUI: true,
                            zoomControl: true,
                        }}
                    >
                        {heatmapData.length > 0 && (
                            <HeatmapLayerF
                                data={heatmapData}
                                options={{
                                    radius: 30,
                                    opacity: 0.8,
                                    gradient: [
                                        'rgba(16, 185, 129, 0)',
                                        'rgba(16, 185, 129, 0.4)',
                                        'rgba(16, 185, 129, 0.8)',
                                        'rgba(5, 150, 105, 1)',
                                        'rgba(4, 120, 87, 1)',
                                        'rgba(6, 95, 70, 1)',
                                        'rgba(2, 68, 51, 1)'
                                    ]
                                }}
                            />
                        )}
                    </GoogleMap>
                ) : (
                    <div className="flex items-center justify-center bg-slate-50 h-[600px] rounded-[2rem]">
                        <p className="text-slate-400 font-bold">Cargando Mapas...</p>
                    </div>
                )}

                <div className="absolute bottom-10 left-10 right-10 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-2xl">
                        <div className="flex items-center gap-3 mb-2">
                            <Info className="text-emerald-600" size={18} />
                            <h4 className="font-black text-slate-800 text-sm">Zonas de Alto Impacto</h4>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed">
                            Las áreas en verde oscuro indican donde los usuarios están rescatando más alimentos. 
                            Usa estos datos para identificar zonas donde expandir la red de restaurantes.
                        </p>
                    </div>
                    
                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl flex flex-col justify-center min-w-[200px]">
                        <p className="text-[10px] font-black uppercase tracking-tighter text-emerald-400 mb-1">Total Impacto</p>
                        <p className="text-2xl font-black">Bogotá, D.C.</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-medium opacity-50">
                            <span>Sectores: 24</span>
                            <span>Rescates: 1.2k+</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RescueHeatmap;
