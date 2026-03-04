import React, { useState } from 'react';
import { MapPin, Search, Navigation } from 'lucide-react';
import { useLocation } from '../../../context/LocationContext';
import { searchAddress } from '../../../services/locationService';
import { logger } from '../../../utils/logger';

export const LocationSelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { setManualLocation, detectLocation } = useLocation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ lat: number, lng: number, address: string, city: string }[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        try {
            const locations = await searchAddress(query);
            setResults(locations);
        } catch (error) {
            logger.error("Error searching address:", error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelect = (loc: { lat: number, lng: number, address: string, city: string }) => {
        setManualLocation(loc.lat, loc.lng, loc.address, loc.city);
        onClose();
    };

    const handleAutoDetect = async () => {
        onClose(); // Close modal first to avoid UI lag perception
        await detectLocation();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Seleccionar Ubicación</h3>
                    <p className="text-xs text-gray-500">¿Dónde quieres recibir tu pedido?</p>
                </div>

                <div className="p-4">
                    <button
                        onClick={handleAutoDetect}
                        className="w-full mb-4 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                    >
                        <Navigation size={18} />
                        Usar mi ubicación actual
                    </button>

                    <div className="relative mb-4">
                        <form onSubmit={handleSearch}>
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar dirección (ej. Calle 85...)"
                                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                        </form>
                    </div>

                    {searching && <div className="text-center py-4 text-gray-500 text-sm">Buscando...</div>}

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {results.map((result, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelect(result)}
                                className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-start gap-3 transition-colors"
                            >
                                <MapPin size={18} className="text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{result.address}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 text-right">
                    <button onClick={onClose} className="text-gray-500 font-medium hover:text-gray-700">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
