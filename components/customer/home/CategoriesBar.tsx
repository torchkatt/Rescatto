import React from 'react';

interface Category {
    id: string;
    name: string;
    icon: string; // URL
}

const CATEGORIES: Category[] = [
    { id: 'all', name: 'Todo', icon: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=100&fit=crop', },
    { id: 'bakery', name: 'Panadería', icon: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop' },
    { id: 'pizza', name: 'Pizza', icon: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=100&h=100&fit=crop' },
    { id: 'cafe', name: 'Café', icon: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop' },
    { id: 'market', name: 'Mercado', icon: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&h=100&fit=crop' },
    { id: 'healthy', name: 'Saludable', icon: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop' },
    { id: 'sushi', name: 'Sushi', icon: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=100&h=100&fit=crop' },
];

interface CategoriesBarProps {
    selectedCategory: string;
    onSelectCategory: (id: string) => void;
}

export const CategoriesBar: React.FC<CategoriesBarProps> = ({ selectedCategory, onSelectCategory }) => {
    return (
        <div className="py-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-4 px-4 min-w-max pb-2">
                {CATEGORIES.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => onSelectCategory(category.id)}
                        className="flex flex-col items-center gap-2 group transition-all duration-200"
                    >
                        <div className={`
                            w-16 h-16 rounded-full p-0.5 transition-all duration-300
                            ${selectedCategory === category.id
                                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 ring-2 ring-emerald-100 scale-105 shadow-lg'
                                : 'bg-transparent hover:bg-gray-200'}
                        `}>
                            <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                                <img
                                    src={category.icon as string}
                                    alt={category.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                        </div>
                        <span className={`
                            text-xs font-medium transition-colors
                            ${selectedCategory === category.id ? 'text-emerald-700 font-bold' : 'text-gray-500 group-hover:text-gray-700'}
                        `}>
                            {category.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
