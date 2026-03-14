import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../../types';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import { Countdown } from '../common/Countdown';
import { useTranslation } from 'react-i18next';

interface HeroDealCardProps {
    product: Product;
    venueName: string;
    discountPct: number; // 0-100
}

export const HeroDealCard: React.FC<HeroDealCardProps> = ({ product, venueName, discountPct }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const effectivePrice = product.dynamicDiscountedPrice || product.discountedPrice;

    return (
        <div
            onClick={() => navigate(`/app/product/${product.id}`)}
            className="mx-6 mb-8 relative rounded-[1.5rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-xl shadow-emerald-200/30"
        >
            {/* Background Image */}
            <div className="relative h-52">
                <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/800/400`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

                {/* Discount badge top-left */}
                <div className="absolute top-4 left-4 bg-emerald-500 text-white text-sm font-black px-3 py-1.5 rounded-xl shadow-lg">
                    -{discountPct}%
                </div>

                {/* Countdown top-right */}
                <div className="absolute top-4 right-4">
                    <Countdown targetTime={product.availableUntil} showIcon />
                </div>

                {/* Content overlay bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">{venueName}</p>
                    <h3 className="text-white text-xl font-black leading-tight mb-3">{product.name}</h3>

                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">
                                ${effectivePrice.toLocaleString('es-CO')}
                            </span>
                            <span className="text-sm font-bold text-white/50 line-through">
                                ${product.originalPrice.toLocaleString('es-CO')}
                            </span>
                        </div>
                        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg flex items-center gap-1.5 active:scale-95 transition-all">
                            {t('rescue_now')} <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
