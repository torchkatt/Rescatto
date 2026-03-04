// Fórmula de Haversine para calcular la distancia entre dos puntos en la Tierra
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radio de la tierra en km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distancia en km
    return parseFloat(d.toFixed(1));
};

const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
};

// Geocodificación Inversa Simulada (En una app real, usar API de Google Maps o Mapbox)
export const reverseGeocode = async (lat: number, lng: number): Promise<{ address: string, city: string }> => {
    // Simular retraso de API
    await new Promise(resolve => setTimeout(resolve, 500));

    // Zonas simuladas simples
    let address = 'Bogotá, D.C.';
    let city = 'Bogotá';

    if (lat > 6.0) { // Aproximadamente Medellín
        city = 'Medellín';
        address = 'El Poblado, Medellín';
    } else {
        if (lat > 4.65) address = 'Bogotá, Usaquén';
        else if (lat > 4.60) address = 'Bogotá, Chapinero';
        else if (lat > 4.55) address = 'Bogotá, Centro Internacional';
    }

    return { address, city };
};

// Geocodificación Directa Simulada (Búsqueda)
export const searchAddress = async (query: string): Promise<{ lat: number, lng: number, address: string, city: string }[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));

    // Resultados simulados basados en la consulta si es posible, o simplemente mixtos
    const q = query.toLowerCase();

    if (q.includes('medellin') || q.includes('poblado')) {
        return [
            { lat: 6.2084, lng: -75.5678, address: 'El Poblado, Medellín', city: 'Medellín' },
            { lat: 6.2442, lng: -75.5812, address: 'Laureles, Medellín', city: 'Medellín' }
        ];
    }

    return [
        { lat: 4.6097, lng: -74.0817, address: 'Plaza de Bolívar, Bogotá', city: 'Bogotá' },
        { lat: 4.6980, lng: -74.0410, address: 'Unicentro, Bogotá', city: 'Bogotá' },
        { lat: 4.6247, lng: -74.0920, address: 'Corferias, Bogotá', city: 'Bogotá' },
        { lat: 4.6672, lng: -74.0538, address: 'Zona T, Bogotá', city: 'Bogotá' },
        { lat: 4.6534, lng: -74.0535, address: query || 'Ubicación simulada', city: 'Bogotá' }
    ];
};
