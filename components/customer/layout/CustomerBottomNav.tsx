import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, Heart, User } from 'lucide-react';

export const CustomerBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Inicio', path: '/app' },
        { icon: ShoppingCart, label: 'Carrito', path: '/app/cart' },
        { icon: ShoppingBag, label: 'Pedidos', path: '/app/orders' },
        { icon: Heart, label: 'Favoritos', path: '/app/favorites' },
        { icon: User, label: 'Perfil', path: '/app/profile' },
    ];

    const isActive = (path: string, label: string) => {
        const currentPath = location.pathname;
        
        // Home y Search comparten la ruta base /app
        if (path === '/app') {
            return currentPath === '/app' || currentPath === '/app/';
        }
        
        return currentPath.startsWith(path);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-emerald-50/50 px-4 py-3 flex items-center justify-around z-40 lg:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)] rounded-t-[2rem]">
            {navItems.map((item) => {
                const active = isActive(item.path, item.label);
                const Icon = item.icon;
                return (
                    <button
                        key={item.label}
                        onClick={() => {
                            navigate(item.path);
                        }}
                        className={`relative flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90 ${
                            active ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <div className={`p-2 rounded-2xl transition-all duration-300 ${active ? 'bg-emerald-50 shadow-inner' : ''}`}>
                            <Icon 
                                size={22} 
                                className={`transition-all duration-300 ${active ? 'fill-emerald-600/20 stroke-[2.5px]' : 'stroke-[2px]'}`} 
                            />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            active ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-90'
                        }`}>
                            {item.label}
                        </span>
                        {active && (
                            <div className="absolute -bottom-1 w-1.5 h-1.5 bg-emerald-600 rounded-full shadow-[0_0_8px_rgba(5,150,105,0.6)]" />
                        )}
                    </button>
                );
            })}
        </nav>
    );
};
