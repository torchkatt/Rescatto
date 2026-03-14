import React from 'react';
import { Search, MapPin, ChevronDown, User, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { NotificationDisplay } from '../../common/NotificationDisplay';

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

interface DesktopTopbarProps {
  city: string | null;
  onOpenLocation: () => void;
  onOpenSearch: () => void;
}

export const DesktopTopbar: React.FC<DesktopTopbarProps> = ({ 
  city, 
  onOpenLocation, 
  onOpenSearch 
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getTotalItems, getTotalPrice } = useCart();
  const navigate = useNavigate();
  const cartCount = getTotalItems();
  const cartTotal = getTotalPrice();

  return (
    <header className="hidden lg:flex flex-shrink-0 h-[var(--header-height)] bg-white border-b border-gray-100/50 shadow-sm z-50">
      <div className="w-full max-w-[1600px] mx-auto px-6 flex items-center justify-between gap-8">
        
        {/* Left: Location Selector */}
        <div className="flex-shrink-0">
          <button
            onClick={onOpenLocation}
            className="flex items-center gap-3 bg-gray-50/50 hover:bg-emerald-50 px-5 py-2.5 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-all active:scale-95 group"
          >
            <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <MapPin size={18} />
            </div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-black text-gray-400 leading-tight tracking-wider">{t('city')}</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-brand-dark truncate max-w-[120px]">
                  {city || t('select')}
                </span>
                <ChevronDown size={14} className="text-gray-400 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-[640px]">
          <button
            onClick={onOpenSearch}
            className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-5 flex items-center gap-3 text-gray-400 hover:bg-white hover:border-emerald-200 hover:shadow-sm transition-all group cursor-text"
          >
            <Search size={20} className="group-hover:text-emerald-500 transition-colors" />
            <span className="text-sm font-medium">{t('search_placeholder') || '¿Qué te apetece rescatar hoy?'}</span>
            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-gray-200/50 rounded-lg text-[10px] font-black text-gray-500">
              <span className="opacity-60">⌘</span>
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Cart */}
          {cartCount > 0 ? (
            <button
              onClick={() => navigate('/app/cart')}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-95 shadow-sm shadow-emerald-200 group"
              title={t('nav_cart')}
            >
              <div className="relative">
                <ShoppingCart size={18} className="stroke-[2.5px]" />
                <span className="absolute -top-2 -right-2 min-w-[16px] h-4 bg-brand-accent text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </div>
              <span className="text-sm font-black">{formatCOP(cartTotal)}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/app/cart')}
              className="p-3 rounded-2xl text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95 relative group"
              title={t('nav_cart')}
            >
              <ShoppingCart size={22} />
            </button>
          )}

          <NotificationDisplay />

          <div className="h-8 w-px bg-gray-100 mx-1"></div>

          <button
            onClick={() => navigate('/app/profile')}
            className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl bg-gray-50 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all active:scale-95 group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200 font-bold overflow-hidden">
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    user?.fullName?.charAt(0) || <User size={18} />
                )}
            </div>
            <div className="text-left hidden 2xl:block">
              <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-0.5 tracking-tighter">{t('prof_account')}</p>
              <p className="text-sm font-black text-brand-dark tracking-tight leading-none truncate max-w-[100px]">
                {user?.fullName?.split(' ')[0] || t('guest_account')}
              </p>
            </div>
            <ChevronDown size={14} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
          </button>
        </div>

      </div>
    </header>
  );
};
