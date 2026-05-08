import React from 'react';
import { useRecommendations } from '../../../hooks/useRecommendations';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { Product } from '../../../types';
import { useTranslation } from 'react-i18next';

interface AIRecommendationsProps {
    onProductClick: (product: Product) => void;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ onProductClick }) => {
    const { recommendedProducts, loading, error } = useRecommendations();
    const { t } = useTranslation();

    if (loading) {
        return (
            <div className="py-8 flex flex-col items-center justify-center text-emerald-600 space-y-3">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium animate-pulse">Personalizando tus ofertas...</p>
            </div>
        );
    }

    if (error || recommendedProducts.length === 0) return null;

    return (
        <section className="py-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-4">
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600">
                        <Sparkles size={18} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">
                        Recomendados para ti ✨
                    </h2>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-6 px-4 no-scrollbar">
                {recommendedProducts.map((product) => (
                    <button
                        key={product.id}
                        onClick={() => onProductClick(product)}
                        className="flex-shrink-0 w-[280px] group text-left"
                    >
                        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-gray-100 transition-transform duration-500 group-hover:scale-[1.02]">
                            <img
                                src={product.imageUrl}
                                alt={product.name}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            
                            <div className="absolute bottom-4 left-4 right-4">
                                <p className="text-white font-bold text-lg leading-tight mb-1 line-clamp-1">
                                    {product.name}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="bg-emerald-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg">
                                        ${product.discountedPrice.toLocaleString()} COP
                                    </span>
                                    <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight size={16} />
                                    </div>
                                </div>
                            </div>

                            {/* AI Badge */}
                            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm border border-white/50">
                                <Sparkles size={10} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">IA Seleccionado</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default AIRecommendations;
