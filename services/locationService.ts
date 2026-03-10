// Fórmula de Haversine para calcular la distancia entre dos puntos en la Tierra
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const isValidCoordinate = (value: number, min: number, max: number): boolean =>
        Number.isFinite(value) && value >= min && value <= max;

    if (
        !isValidCoordinate(lat1, -90, 90) ||
        !isValidCoordinate(lat2, -90, 90) ||
        !isValidCoordinate(lon1, -180, 180) ||
        !isValidCoordinate(lon2, -180, 180)
    ) {
        return Number.POSITIVE_INFINITY;
    }

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

// Geocodificación Inversa con Nominatim (OpenStreetMap — gratuito, sin API key)
export const reverseGeocode = async (lat: number, lng: number): Promise<{ address: string, city: string }> => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es`,
            { headers: { 'User-Agent': 'RescattoApp/1.0' } }
        );
        if (!res.ok) throw new Error(`Nominatim reverse: ${res.status}`);
        const data = await res.json();

        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.state || 'Desconocida';
        const road = addr.road || addr.pedestrian || addr.neighbourhood || '';
        const houseNumber = addr.house_number || '';
        const suburb = addr.suburb || addr.neighbourhood || '';

        // Construir dirección legible
        let address = [road, houseNumber].filter(Boolean).join(' ');
        if (suburb && suburb !== road) address = address ? `${address}, ${suburb}` : suburb;
        if (!address) address = data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        return { address: `${address}, ${city}`, city };
    } catch (error) {
        // Fallback: devolver coordenadas como texto
        return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, city: 'Desconocida' };
    }
};

// Geocodificación Directa con Nominatim (búsqueda de direcciones)
export const searchAddress = async (query: string): Promise<{ lat: number, lng: number, address: string, city: string }[]> => {
    try {
        // Priorizar resultados en Colombia
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=co&limit=6&addressdetails=1&accept-language=es`,
            { headers: { 'User-Agent': 'RescattoApp/1.0' } }
        );
        if (!res.ok) throw new Error(`Nominatim search: ${res.status}`);
        const data: any[] = await res.json();

        return data.map((item) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.state || '';
            const displayParts = (item.display_name || '').split(',').slice(0, 4).join(',').trim();
            return {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                address: displayParts || query,
                city,
            };
        });
    } catch (error) {
        return [];
    }
};
