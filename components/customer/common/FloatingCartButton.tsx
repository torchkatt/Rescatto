import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { formatCOP } from '../../../utils/formatters';

export const FloatingCartButton: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { items } = useCart();
    const prevCountRef = useRef(-1);
    const [isPopping, setIsPopping] = useState(false);

    const hiddenOnPaths = [
        '/app/cart',
        '/app/checkout',
        '/app/orders',
        '/app/profile',
        '/app/impact',
        '/app/favorites',
    ];
    const shouldHide = hiddenOnPaths.some(p =>
        location.pathname === p || location.pathname.startsWith(p)
    );

    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const totalPrice = items.reduce((acc, item) => acc + item.discountedPrice * item.quantity, 0);

    // Animación "pop" cada vez que se agrega un producto
    useEffect(() => {
        const prev = prevCountRef.current;
        prevCountRef.current = itemCount;
        if (prev !== -1 && itemCount > prev) {
            setIsPopping(true);
            const t = setTimeout(() => setIsPopping(false), 450);
            return () => clearTimeout(t);
        }
    }, [itemCount]);

    if (shouldHide || itemCount === 0) return null;

    return (
        <button
            onClick={() => navigate('/app/cart')}
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)', right: '1rem' }}
            className={`
                fixed z-40
                flex items-center gap-3
                bg-emerald-600 hover:bg-emerald-700
                text-white
                pl-3 pr-4 py-2.5
                rounded-2xl
                shadow-[0_8px_28px_-4px_rgba(5,150,105,0.55)]
                border border-emerald-500/30
                transition-transform duration-200 ease-out
                active:scale-95
                ${isPopping ? 'animate-cart-pop' : ''}
            `}
            aria-label={`Ver carrito — ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
        >
            {/* Ícono + badge */}
            <div className="relative flex-shrink-0">
                <ShoppingBag size={24} strokeWidth={2} className="drop-shadow-sm" />
                <span
                    className={`
                        absolute -top-2.5 -right-2.5
                        min-w-[20px] h-5
                        bg-red-500
                        text-white text-[10px] font-black
                        rounded-full flex items-center justify-center px-1
                        shadow-md ring-2 ring-emerald-600
                        transition-transform duration-200
                        ${isPopping ? 'scale-125' : 'scale-100'}
                    `}
                >
                    {itemCount > 99 ? '99+' : itemCount}
                </span>
            </div>

            {/* Separador vertical */}
            <div className="w-px h-7 bg-white/20 flex-shrink-0" />

            {/* Textos */}
            <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-medium text-white/70 mb-0.5">
                    {itemCount === 1 ? '1 producto' : `${itemCount} productos`}
                </span>
                <span className="text-[13px] font-black tracking-tight">
                    {formatCOP(totalPrice)}
                </span>
            </div>
        </button>
    );
};
