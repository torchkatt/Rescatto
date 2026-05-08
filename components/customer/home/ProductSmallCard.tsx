import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../../types';
import { Card } from '../common/Card';
import { ShoppingBag, Zap } from 'lucide-react';
import { Countdown } from '../common/Countdown';
import { useTranslation } from 'react-i18next';

interface ProductSmallCardProps {
    product: Product;
    venueName?: string;
}

export const ProductSmallCard: React.FC<ProductSmallCardProps> = ({ product, venueName }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleClick = () => {
        navigate(`/app/product/${product.id}`);
    };

    const discount = Math.round(((product.originalPrice - (product.dynamicDiscountedPrice || product.discountedPrice)) / product.originalPrice) * 100);

    return (
        <Card
            className="group relative flex flex-col w-48 shrink-0 transition-all duration-300 transform hover:scale-105 hover:shadow-xl border border-gray-100 hover:border-emerald-500/30 overflow-hidden cursor-pointer"
            onClick={handleClick}
        >
            <div className="relative h-32 -mx-4 -mt-4 mb-3 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10" />
                
                <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                />

                {/* Discount Badge */}
                <div className="absolute top-2 left-2 z-20 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-lg">
                    -{discount}%
                </div>

                {/* Dynamic Pricing Icon */}
                {product.isDynamicPricing && (
                    <div className="absolute top-2 right-2 z-20 bg-orange-500 text-white p-1 rounded-full shadow-lg animate-pulse">
                        <Zap size={10} fill="currentColor" />
                    </div>
                )}

                {/* Countdown if expiring soon (within 3h) */}
                <div className="absolute bottom-2 left-2 z-20">
                    <Countdown targetTime={product.availableUntil} compact showIcon={false} />
                </div>
            </div>

            <div className="flex-1 flex flex-col px-1">
                <h4 className="text-sm font-black text-gray-900 leading-tight line-clamp-2 mb-0.5 group-hover:text-emerald-700 transition-colors">
                    {product.name}
                </h4>
                
                {venueName && (
                    <p className="text-[10px] font-bold text-gray-400 truncate mb-2">
                        {venueName}
                    </p>
                )}

                <div className="mt-auto flex items-baseline gap-1.5">
                    <span className="text-sm font-black text-emerald-600">
                        ${(product.dynamicDiscountedPrice || product.discountedPrice).toLocaleString('es-CO')}
                    </span>
                    <span className="text-[10px] font-bold text-gray-300 line-through">
                        ${product.originalPrice.toLocaleString('es-CO')}
                    </span>
                </div>

                {product.quantity <= 3 && (
                    <p className="text-[9px] font-black text-red-500 mt-1 flex items-center gap-1">
                        <ShoppingBag size={10} />
                        {product.quantity === 1 ? t('stock_alert_one') : t('stock_alert_many', { count: product.quantity })}
                    </p>
                )}
            </div>
        </Card>
    );
};
