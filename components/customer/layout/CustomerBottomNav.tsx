import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, Heart, User, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../../context/CartContext';

const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

export const CustomerBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { getTotalItems, getTotalPrice } = useCart();
    const cartCount = getTotalItems();
    const cartTotal = getTotalPrice();

    const navItems = [
        { icon: Home, label: t('nav_home'), path: '/app' },
        { icon: ShoppingCart, label: t('nav_cart'), path: '/app/cart' },
        { icon: ShoppingBag, label: t('nav_orders'), path: '/app/orders' },
        { icon: Heart, label: t('nav_favorites'), path: '/app/favorites' },
        { icon: User, label: t('nav_profile'), path: '/app/profile' },
    ];

    const isActive = (path: string) => {
        const currentPath = location.pathname;
        if (path === '/app') return currentPath === '/app' || currentPath === '/app/';
        return currentPath.startsWith(path);
    };

    const isCartActive = isActive('/app/cart');

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-emerald-50/50 px-4 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex items-center justify-around z-40 lg:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)] rounded-t-[1.5rem]">
            {navItems.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                const isCart = item.path === '/app/cart';

                // Cart con items → píldora CTA elevada
                if (isCart && cartCount > 0) {
                    return (
                        <button
                            key={item.label}
                            onClick={() => navigate('/app/cart')}
                            className={`relative flex-1 flex justify-center active:scale-95 transition-all duration-300`}
                        >
                            <div className={`
                                -translate-y-2 flex items-center gap-1.5 px-3 py-2 rounded-2xl
                                bg-emerald-600 text-white shadow-lg shadow-emerald-600/40
                                ${!isCartActive ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}
                                transition-all duration-300
                            `}>
                                <div className="relative">
                                    <ShoppingCart size={18} className="fill-white/20 stroke-[2.5px]" />
                                    <span className="absolute -top-2 -right-2 min-w-[14px] h-[14px] bg-brand-accent text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
                                        {cartCount > 99 ? '99+' : cartCount}
                                    </span>
                                </div>
                                <span className="text-xs font-black tracking-tight">
                                    {formatCOP(cartTotal)}
                                </span>
                                <ChevronRight size={12} className="text-white/70" />
                            </div>
                        </button>
                    );
                }

                // Ítems normales
                return (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className={`relative flex flex-col items-center gap-1 flex-1 py-0.5 transition-all active:scale-90 ${
                            active ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-emerald-50 shadow-inner' : ''}`}>
                            <Icon
                                size={20}
                                className={`transition-all duration-300 ${active ? 'fill-emerald-600/20 stroke-[2.5px]' : 'stroke-[2px]'}`}
                            />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                            active ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-90'
                        }`}>
                            {item.label}
                        </span>
                        {active && (
                            <div className="absolute -bottom-0.5 w-1 h-1 bg-emerald-600 rounded-full shadow-[0_0_6px_rgba(26,107,74,0.6)]" />
                        )}
                    </button>
                );
            })}
        </nav>
    );
};
