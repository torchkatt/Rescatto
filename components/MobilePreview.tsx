import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../types';
import { MapPin, Clock, ShoppingBag } from 'lucide-react';
import { formatCOP } from '../utils/formatters';

interface MobilePreviewProps {
  product: Product;
  venueName: string;
}

// Visual replica of the requested Flutter Widget
const ProductCard: React.FC<MobilePreviewProps> = ({ product, venueName }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!product.availableUntil) return 'Sin fecha';
      const difference = +new Date(product.availableUntil) - +new Date();
      if (difference > 0) {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        return `${hours}h ${minutes}m`;
      }
      return 'Expirado';
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [product.availableUntil]);

  const isSurprise = product.type === ProductType.SURPRISE_PACK;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden font-sans border border-gray-100 max-w-sm mx-auto transform transition hover:scale-105 duration-200">
      <div className="relative h-48 w-full">
        <img 
          src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} 
          alt={product.name} 
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop';
          }}
        />
        {isSurprise && (
          <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse">
            Pack Sorpresa
          </div>
        )}
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded flex items-center">
          <Clock size={12} className="mr-1" />
          <span>Recoge en: {timeLeft}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-gray-900 text-lg leading-tight">{product.name}</h3>
          <div className="flex flex-col items-end">
            <span className="text-gray-400 text-sm line-through decoration-red-500">
              {formatCOP(product.originalPrice || 0)}
            </span>
            <span className="text-green-600 font-bold text-xl">
              {formatCOP(product.discountedPrice || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center text-gray-500 text-sm mb-4">
          <MapPin size={14} className="mr-1 text-gray-400" />
          <span>0.8 km • {venueName}</span>
        </div>

        <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center transition-colors">
          <ShoppingBag size={18} className="mr-2" />
          Reservar Ahora
        </button>
      </div>
    </div>
  );
};

export default ProductCard;