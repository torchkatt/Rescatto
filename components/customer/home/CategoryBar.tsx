import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'all', name: 'Todos', icon: '🌈', color: 'bg-gray-100' },
  { id: 'rescue', name: 'Rescate', icon: '🍃', color: 'bg-emerald-100' },
  { id: 'foods', name: 'Comida', icon: '🍔', color: 'bg-orange-100' },
  { id: 'drinks', name: 'Bebidas', icon: '🥤', color: 'bg-blue-100' },
  { id: 'bakery', name: 'Panadería', icon: '🥐', color: 'bg-yellow-100' },
  { id: 'market', name: 'Mercado', icon: '🛒', color: 'bg-purple-100' },
  { id: 'healthy', name: 'Saludable', icon: '🥗', color: 'bg-green-100' },
];

export const CategoryBar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => {
            if (cat.id === 'rescue') {
              navigate('/app/explore?isRescue=true');
            } else if (cat.id === 'all') {
              navigate('/app/explore');
            } else {
              navigate(`/app/explore?category=${cat.name}`);
            }
          }}
          className="flex flex-col items-center gap-2 shrink-0 group active:scale-90 transition-transform"
        >
          <div className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-black/5 group-hover:shadow-md transition-shadow`}>
            {cat.icon}
          </div>
          <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter group-hover:text-emerald-700">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
};
