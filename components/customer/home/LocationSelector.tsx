import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Search, Navigation, Loader2, X } from 'lucide-react';
import { useLocation } from '../../../context/LocationContext';
import { COLOMBIAN_CITIES } from '../../../data/colombianCities';

export const LocationSelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { setManualLocation, detectLocation, city: currentCity } = useLocation();
    const [query, setQuery] = useState('');
    const [detecting, setDetecting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COLOMBIAN_CITIES;
        return COLOMBIAN_CITIES.filter(
            c =>
                c.name.toLowerCase().includes(q) ||
                c.department.toLowerCase().includes(q)
        );
    }, [query]);

    const handleSelect = (city: typeof COLOMBIAN_CITIES[number]) => {
        setManualLocation(city.lat, city.lng, city.name, city.name);
        onClose();
    };

    const handleAutoDetect = async () => {
        setDetecting(true);
        try {
            await detectLocation();
        } finally {
            setDetecting(false);
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Seleccionar ciudad</h3>
                        <p className="text-xs text-gray-500 mt-0.5">¿En qué municipio estás?</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* GPS */}
                <div className="px-5 pb-3 shrink-0">
                    <button
                        onClick={handleAutoDetect}
                        disabled={detecting}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-medium hover:bg-emerald-100 transition-colors disabled:opacity-60 text-sm"
                    >
                        {detecting ? (
                            <><Loader2 size={16} className="animate-spin" /> Detectando ubicación…</>
                        ) : (
                            <><Navigation size={16} /> Usar mi ubicación actual (GPS)</>
                        )}
                    </button>
                </div>

                {/* Buscador */}
                <div className="px-5 pb-3 shrink-0">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar ciudad o departamento…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista */}
                <div className="overflow-y-auto px-3 pb-4">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-6">No se encontraron resultados</p>
                    ) : (
                        filtered.map((city, i) => {
                            const isSelected = city.name === currentCity;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(city)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                                        isSelected
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'hover:bg-gray-50 text-gray-800'
                                    }`}
                                >
                                    <MapPin
                                        size={15}
                                        className={`shrink-0 ${isSelected ? 'text-emerald-600' : 'text-gray-400'}`}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium leading-none">{city.name}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{city.department}</p>
                                    </div>
                                    {isSelected && (
                                        <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                            Actual
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
