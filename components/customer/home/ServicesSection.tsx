import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sellerService } from '../../../services/sellerService';
import { Seller, SellerType } from '../../../types';
import { Skeleton } from '../../ui/Skeleton';
import { Star, ArrowRight } from 'lucide-react';

const ServicesSection: React.FC = () => {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        setLoading(true);
        setError(null);
        const all = await sellerService.getAll();
        const serviceSellers = all.filter(
          (s) => s.type === SellerType.SERVICE || s.type === SellerType.INDIVIDUAL
        );
        setSellers(serviceSellers.slice(0, 6));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error al cargar proveedores'));
      } finally {
        setLoading(false);
      }
    };
    fetchSellers();
  }, []);

  const sellerTypeLabel = useMemo(() => {
    const labels: Record<string, string> = {
      [SellerType.SERVICE]: 'Servicio',
      [SellerType.INDIVIDUAL]: 'Individual',
      [SellerType.FOOD]: 'Comida',
      [SellerType.RETAIL]: 'Retail',
    };
    return labels;
  }, []);

  if (loading) {
    return (
      <section className="px-6 lg:px-0 mb-10" data-testid="services-section-skeleton">
        <div className="mb-4">
          <Skeleton.Block h={24} w={200} rounded="md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-white rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton.Avatar size={48} />
                <div className="flex-1 space-y-1">
                  <Skeleton.Block h={16} w="70%" />
                  <Skeleton.Block h={12} w="40%" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton.Block h={22} w={60} rounded="full" />
                <Skeleton.Block h={22} w={80} rounded="full" />
              </div>
              <Skeleton.Block h={36} w="100%" rounded="lg" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 lg:px-0 mb-10" data-testid="services-section-error">
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
          <p className="text-sm text-red-600">No pudimos cargar los proveedores de servicios.</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
            className="mt-2 text-xs font-semibold text-red-700 underline"
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (sellers.length === 0) {
    return (
      <section className="px-6 lg:px-0 mb-10" data-testid="services-section-empty">
        <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl text-center">
          <p className="text-sm text-gray-500">No hay proveedores de servicios disponibles en este momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 lg:px-0 mb-10" data-testid="services-section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-brand-dark">Proveedores de Servicios</h2>
        <button
          onClick={() => navigate('/app/explore?type=service')}
          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
        >
          Ver todos <ArrowRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sellers.map((seller) => (
          <div
            key={seller.id}
            className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50 transition-all cursor-pointer group"
            onClick={() => navigate(`/app/seller/${seller.id}`)}
          >
            <div className="flex items-center gap-3 mb-3">
              {seller.logo ? (
                <img
                  src={seller.logo}
                  alt={seller.name}
                  className="w-12 h-12 rounded-xl object-cover bg-gray-50"
                />
              ) : (
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-lg">
                  {seller.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate group-hover:text-emerald-700 transition-colors">
                  {seller.name}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-medium text-gray-500">
                    {seller.rating > 0 ? seller.rating.toFixed(1) : 'Nuevo'}
                  </span>
                  {seller.stats.totalTransactions > 0 && (
                    <span className="text-xs text-gray-400">
                      · {seller.stats.totalTransactions} ventas
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {seller.type && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                  {sellerTypeLabel[seller.type] || seller.type}
                </span>
              )}
              {seller.location?.city && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  {seller.location.city}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/seller/${seller.id}`);
              }}
              className="w-full py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl hover:bg-emerald-100 transition-colors group-hover:bg-emerald-100"
            >
              Ver servicios
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ServicesSection;
