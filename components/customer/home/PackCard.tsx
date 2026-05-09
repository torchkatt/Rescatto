import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../../types';
import { Card } from '../common/Card';
import { ShoppingBag, Zap, ChevronRight, Plus } from 'lucide-react';
import { Countdown } from '../common/Countdown';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../common/Button';
import { Skeleton } from '../../ui/Skeleton';

interface PackCardProps {
  product: Product;
  venueName?: string;
  variant?: 'compact' | 'featured';  // default: 'compact'
  onAddToCart?: (product: Product) => void;
  loading?: boolean;                  // muestra skeleton integrado
}

export const PackCard: React.FC<PackCardProps> = ({
  product,
  venueName,
  variant = 'compact',
  onAddToCart,
  loading,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton.Card variant={variant === 'compact' ? 'pack-compact' : 'pack-featured'} />;
  }

  const handleClick = () => {
    navigate(`/app/product/${product.id}`);
  };

  const discount = Math.round(
    ((product.originalPrice - (product.dynamicDiscountedPrice || product.discountedPrice)) /
      product.originalPrice) *
      100
  );

  const finalPrice = product.dynamicDiscountedPrice || product.discountedPrice;
  const isLowStock = product.quantity <= 3;

  if (variant === 'featured') {
    return (
      <Card
        variant="interactive"
        padding="none"
        className="w-72 overflow-hidden flex flex-col group"
        onClick={handleClick}
      >
        <div className="relative h-48 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
          <img
            src={product.imageUrl || `https://picsum.photos/seed/${product.id}/600/400`}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
            <Badge intent="discount" size="md">
              -{discount}%
            </Badge>
            {product.isRescue !== false && (
              <Badge intent="rescue" size="sm" icon="🍃">
                Rescate
              </Badge>
            )}
          </div>

          {product.isDynamicPricing && (
            <div className="absolute top-3 right-3 z-20">
              <Badge intent="dynamic-price" size="sm" icon={<Zap size={12} fill="currentColor" />}>
                Bajando
              </Badge>
            </div>
          )}

          <div className="absolute bottom-3 left-3 z-20">
            <Countdown targetTime={product.availableUntil} showIcon />
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h4 className="text-base font-black text-gray-900 leading-tight line-clamp-2 mb-1 group-hover:text-emerald-700 transition-colors">
            {product.name}
          </h4>
          
          {venueName && (
            <p className="text-xs font-bold text-gray-400 truncate mb-3">
              {venueName}
            </p>
          )}

          <div className="mt-auto flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-xl font-black text-emerald-600">
                ${finalPrice.toLocaleString('es-CO')}
              </span>
              <span className="text-xs font-bold text-gray-300 line-through">
                ${product.originalPrice.toLocaleString('es-CO')}
              </span>
            </div>

            {onAddToCart ? (
              <Button
                size="sm"
                variant="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                className="rounded-xl font-black"
              >
                <Plus size={16} className="mr-1" /> Añadir
              </Button>
            ) : (
              <div className="bg-emerald-50 p-2 rounded-full text-emerald-600">
                <ChevronRight size={20} />
              </div>
            )}
          </div>

          {isLowStock && (
            <div className="mt-3">
              <Badge intent="low-stock" size="xs" className="w-full justify-center">
                🔥 {product.quantity === 1 ? t('stock_alert_one') : t('stock_alert_many', { count: product.quantity })}
              </Badge>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Default: Compact
  return (
    <Card
      variant="interactive"
      padding="none"
      className="w-48 overflow-hidden flex flex-col group"
      onClick={handleClick}
    >
      <div className="relative h-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10" />
        <img
          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
          <Badge intent="discount" size="xs">
            -{discount}%
          </Badge>
        </div>

        {product.isDynamicPricing && (
          <div className="absolute top-2 right-2 z-20">
            <Badge intent="dynamic-price" size="xs" icon={<Zap size={10} fill="currentColor" />} />
          </div>
        )}

        {product.isRescue !== false && (
          <div className="absolute bottom-2 left-2 z-20 scale-90 origin-left">
            <Countdown targetTime={product.availableUntil} compact showIcon={false} />
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
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
            ${finalPrice.toLocaleString('es-CO')}
          </span>
          <span className="text-[10px] font-bold text-gray-300 line-through">
            ${product.originalPrice.toLocaleString('es-CO')}
          </span>
        </div>

        {isLowStock && (
          <p className="text-[9px] font-black text-red-500 mt-1 flex items-center gap-1">
            <ShoppingBag size={10} />
            {product.quantity === 1 ? '¡Solo 1!' : `¡Solo ${product.quantity}!`}
          </p>
        )}
      </div>
    </Card>
  );
};
