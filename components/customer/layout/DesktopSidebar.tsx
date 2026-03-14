import React from 'react';
import { Home, Compass, Heart, ShoppingBag, Leaf, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

export const DesktopSidebar: React.FC<{ onOpenImpact: () => void }> = ({ onOpenImpact }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout } = useAuth();

  const menuItems = [
    { icon: Home, label: t('nav_home'), path: '/app' },
    { icon: Compass, label: t('nav_explore'), path: '/app/explore' },
    { icon: Heart, label: t('nav_favorites'), path: '/app/favorites' },
    { icon: ShoppingBag, label: t('nav_orders'), path: '/app/orders' },
    { icon: Leaf, label: t('nav_impact'), path: '/app/impact', isAction: true },
    { icon: User, label: t('nav_profile'), path: '/app/profile' },
  ];

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 w-[var(--sidebar-width)] bg-white border-r border-gray-100 py-8 px-4 z-[60]">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-4 mb-10">
        <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
          <span className="text-xl font-black italic">R</span>
        </div>
        <span className="text-xl font-black text-brand-dark tracking-tighter">Rescatto</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path));
          
          const content = (
            <>
              <item.icon size={22} className={isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'} />
              <span className="text-sm">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              )}
            </>
          );

          const className = `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all group w-full text-left ${
            isActive 
            ? 'bg-emerald-50 text-emerald-700 font-bold' 
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`;

          if ((item as any).isAction) {
             return (
               <button 
                 key={item.label} 
                 onClick={onOpenImpact}
                 className={className}
               >
                 {content}
               </button>
             );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info or Logout */}
      <div className="border-t border-gray-50 pt-6 px-4">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 py-3 text-gray-400 hover:text-red-500 transition-all group"
        >
          <LogOut size={20} />
          <span className="text-sm font-bold">{t('nav_logout')}</span>
        </button>
      </div>
    </aside>
  );
};
