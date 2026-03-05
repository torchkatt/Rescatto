import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../../context/CartContext';

export const FloatingCartButton: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { items } = useCart();

    // Show only on customer home to avoid covering forms/actions in critical flows.
    if (!(location.pathname === '/app' || location.pathname === '/app/')) {
        return null;
    }

    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

    if (itemCount === 0) return null;

    return (
        <button
            onClick={() => navigate('/app/cart')}
            className="fixed bottom-safe left-4 z-50 bg-white text-emerald-600 p-2.5 rounded-full shadow-lg border border-gray-100 hover:bg-emerald-50 transition-all active:scale-95 animate-in fade-in zoom-in duration-300"
            title="Ver Carrito"
        >
            <div className="relative">
                <ShoppingCart size={20} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                    {itemCount > 9 ? '9+' : itemCount}
                </span>
            </div>
        </button>
    );
};
