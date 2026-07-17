import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryService } from '../../../services/categoryService';
import { Category } from '../../../types';
import { Skeleton } from '../../ui/Skeleton';

const CATEGORY_EMOJIS: Record<string, string> = {
  comida: '🍽️',
  tecnologia: '💻',
  servicios: '🛠️',
  digital: '📦',
};

const CategoriesSection: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const roots = await categoryService.getRootCategories();
        setCategories(roots);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error al cargar categorías'));
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <section className="px-6 lg:px-0 mb-10">
        <div className="mb-4">
          <Skeleton.Block h={24} w={180} rounded="md" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-36 space-y-3">
              <Skeleton.Block h={96} w="100%" rounded="xl" />
              <Skeleton.Block h={16} w="60%" rounded="md" className="mx-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error || categories.length === 0) return null;

  return (
    <section className="px-6 lg:px-0 mb-10" data-testid="categories-section">
      <h2 className="text-lg font-bold text-brand-dark mb-4">Categorías</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => navigate(`/app/explore?category=${cat.slug}`)}
            className="flex-shrink-0 w-36 flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50 transition-all group"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              {CATEGORY_EMOJIS[cat.slug] || cat.icon || '📦'}
            </div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors text-center">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoriesSection;
