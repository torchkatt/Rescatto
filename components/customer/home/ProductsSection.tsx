import React from 'react';
import { Product } from '../../../types';
import { SectionHeader } from '../../ui/SectionHeader';
import { PackCard } from './PackCard';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProductsSectionProps {
  endingSoonProducts: Product[];
  bestDiscountProducts: Product[];
  venueNamesMap: Map<string, string>;
  onAddToCart?: (product: Product) => void;
}

export const ProductsSection: React.FC<ProductsSectionProps> = ({
  endingSoonProducts,
  bestDiscountProducts,
  venueNamesMap,
  onAddToCart,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-12 mb-12">
      {/* Ending Soon Section */}
      {endingSoonProducts.length > 0 && (
        <section>
          <SectionHeader
            title={t('ending_soon')}
            subtitle="¡Última oportunidad!"
            icon={<Clock size={24} className="text-red-500" />}
            action={{
              label: t('see_all'),
              href: '/app/explore?sort=endingSoon',
            }}
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {endingSoonProducts.slice(0, 10).map((product) => (
              <PackCard
                key={product.id}
                product={product}
                venueName={venueNamesMap.get(product.venueId)}
                variant="compact"
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available Products Section */}
      {bestDiscountProducts.length > 0 && (
        <section>
          <SectionHeader
            title={t('available_products')}
            subtitle="Los mejores descuentos"
            icon={<ShoppingBag size={24} className="text-emerald-500" />}
            action={{
              label: t('see_all'),
              href: '/app/explore?sort=recommended',
            }}
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {bestDiscountProducts.slice(0, 10).map((product) => (
              <PackCard
                key={product.id}
                product={product}
                venueName={venueNamesMap.get(product.venueId)}
                variant="compact"
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
