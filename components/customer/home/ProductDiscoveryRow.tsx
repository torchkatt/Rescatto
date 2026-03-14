import React from 'react';
import { Product } from '../../../types';
import { ProductSmallCard } from './ProductSmallCard';
import { useTranslation } from 'react-i18next';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface ProductDiscoveryRowProps {
    title: string;
    products: Product[];
    venueNames: Map<string, string>;
    icon?: LucideIcon;
    iconColor?: string;
    onSeeAll?: () => void;
}

export const ProductDiscoveryRow: React.FC<ProductDiscoveryRowProps> = ({ 
    title, 
    products, 
    venueNames,
    icon: Icon,
    iconColor = "text-emerald-500",
    onSeeAll 
}) => {
    const { t } = useTranslation();

    if (products.length === 0) return null;

    return (
        <section className="mb-10 last:mb-20">
            <div className="px-6 flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={24} className={iconColor} />}
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h2>
                </div>
                {onSeeAll && (
                    <button 
                        onClick={onSeeAll}
                        className="text-emerald-600 font-black text-sm hover:underline flex items-center gap-1"
                    >
                        {t('see_all')} <ChevronRight size={14} />
                    </button>
                )}
            </div>
            
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 pb-6 -mx-1">
                {products.map(product => (
                    <ProductSmallCard 
                        key={product.id} 
                        product={product} 
                        venueName={venueNames.get(product.venueId)}
                    />
                ))}
            </div>
        </section>
    );
};
