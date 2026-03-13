import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, MapPin, Star, Clock, Filter, ShoppingBag, Leaf, Flame, TrendingUp } from 'lucide-react';
import { Product, Venue } from '../../../types';
import { productService } from '../../../services/productService';
import { venueService } from '../../../services/venueService';
import { useLocation } from '../../../context/LocationContext';
import { useNavigate } from 'react-router-dom';
import { formatCOP } from '../../../utils/formatters';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { city } = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState<string | null>(null);
  const [venuesMap, setVenuesMap] = useState<Record<string, Venue>>({});

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2 || selectedDiet) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedDiet]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const searchResults = await productService.searchProducts(searchTerm, {
        city: city || undefined,
        diet: selectedDiet || undefined
      });
      setResults(searchResults);

      // Fetch venue info for results
      const uniqueVenueIds = Array.from(new Set(searchResults.map(p => p.venueId)));
      const venuePromises = uniqueVenueIds.map(id => venueService.getVenueById(id));
      const venues = await Promise.all(venuePromises);
      
      const newVenuesMap: Record<string, Venue> = {};
      venues.forEach(v => {
        if (v) newVenuesMap[v.id] = v;
      });
      setVenuesMap(prev => ({ ...prev, ...newVenuesMap }));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
            <input
              autoFocus
              type="text"
              placeholder="¿Qué quieres rescatar hoy?"
              className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-lg font-bold placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'VEGAN', label: 'Vegano', icon: <Leaf size={14} /> },
            { id: 'VEGETARIAN', label: 'Vegetariano', icon: <TrendingUp size={14} /> },
            { id: ' GLUTEN_FREE', label: 'Sin Gluten', icon: <Star size={14} /> },
            { id: 'HOT', label: 'Hot Deals', icon: <Flame size={14} /> }
          ].map((diet) => (
            <button
              key={diet.id}
              onClick={() => setSelectedDiet(selectedDiet === diet.id ? null : diet.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border ${
                selectedDiet === diet.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg'
                  : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200'
              }`}
            >
              {diet.icon}
              {diet.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-gray-400 font-bold animate-pulse">Buscando los mejores rescates...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
              {results.length} resultados encontrados
            </p>
            {results.map((product) => (
              <div 
                key={product.id}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="flex gap-4 group cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-gray-100">
                  <img 
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg">
                    -{Math.round((1 - product.discountedPrice/product.originalPrice) * 100)}%
                  </div>
                </div>
                <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm font-bold text-gray-400 flex items-center gap-1">
                      <ShoppingBag size={12} />
                      {venuesMap[product.venueId]?.name || 'Cargando sede...'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-emerald-600">{formatCOP(product.discountedPrice)}</span>
                      <span className="text-xs font-bold text-gray-300 line-through">{formatCOP(product.originalPrice)}</span>
                    </div>
                    <button className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all">
                      Ver detalle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-12 pb-20">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Search size={40} className="text-gray-200" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              {searchTerm ? 'No encontramos nada con ese nombre' : 'Busca tu comida favorita'}
            </h3>
            <p className="text-gray-400 font-bold">
              {searchTerm 
                ? 'Intenta con otros términos como "Pan", "Pizza" o "Vegano".'
                : 'Explora miles de productos a mitad de precio y ayuda al planeta.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
