import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AppUpdateButton } from '../../common/AppUpdateButton';
import {
  BarChart3,
  Users,
  Store,
  Car,
  LogOut,
  ShieldAlert,
  HeadphonesIcon,
  Settings,
  BadgeCheck,
  Building2,
  DollarSign,
  Landmark,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const BackofficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Soporte para colapso del menú con persistencia
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('backoffice_sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('backoffice_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const navItems = [
    { to: '/backoffice/dashboard', icon: BarChart3, label: 'Dashboard' },
    { to: '/backoffice/users', icon: Users, label: 'Usuarios' },
    { to: '/backoffice/venues', icon: Store, label: 'Restaurantes' },
    { to: '/backoffice/finance', icon: DollarSign, label: 'Finanzas' },
    { to: '/backoffice/commissions', icon: Landmark, label: 'Comisiones' },
    { to: '/backoffice/subscriptions', icon: BadgeCheck, label: 'Suscripciones' },
    { to: '/backoffice/payment-settings', icon: Building2, label: 'Datos Bancarios' },
    { to: '/backoffice/drivers', icon: Car, label: 'Conductores' },
    { to: '/backoffice/support', icon: HeadphonesIcon, label: 'Soporte' },
    { to: '/backoffice/audit', icon: ShieldAlert, label: 'Auditoría' },
    { to: '/backoffice/settings', icon: Settings, label: 'Configuración' },
  ];

  const SidebarContent = ({ isMobile = false }) => (
    <>
      <div className={`p-6 transition-all duration-300 ${!isMobile && isCollapsed ? 'px-4' : 'px-6'}`}>
        <div className="flex items-center justify-between">
          <div className={`transition-opacity duration-300 ${!isMobile && isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent whitespace-nowrap">
              Rescatto
            </h1>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-semibold whitespace-nowrap">Super Admin</p>
          </div>

          {isMobile ? (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`text-neutral-500 hover:text-white transition-all p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 ${isCollapsed ? 'mx-auto' : ''}`}
              title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={!isMobile && isCollapsed ? item.label : undefined}
            onClick={() => isMobile && setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center rounded-xl transition-all duration-200 group ${!isMobile && isCollapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-3'
              } ${isActive
                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className={`transition-all duration-300 whitespace-nowrap ${!isMobile && isCollapsed ? 'opacity-0 w-0 overflow-hidden ml-0' : 'opacity-100'
              }`}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className={`p-4 border-t border-neutral-800 transition-all duration-300 ${!isMobile && isCollapsed ? 'px-2' : 'p-4'}`}>
        <div className={`flex items-center mb-4 transition-all ${!isMobile && isCollapsed ? 'flex-col space-y-2 px-0' : 'space-x-3 px-2'
          }`}>
          <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group relative">
            {user?.avatarUrl && !imageError ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-sm font-medium text-emerald-400">
                {user?.fullName?.charAt(0).toUpperCase()}
              </span>
            )}
            {/* Tooltip para cuando está colapsado */}
            {!isMobile && isCollapsed && (
              <div className="absolute left-14 bg-neutral-900 border border-neutral-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {user?.fullName}
              </div>
            )}
          </div>
          <div className={`transition-all duration-300 flex-1 min-w-0 ${!isMobile && isCollapsed ? 'opacity-0 w-0 overflow-hidden h-0' : 'opacity-100'
            }`}>
            <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.role}</p>
          </div>
        </div>

        <div className={`transition-all duration-300 ${!isMobile && isCollapsed ? 'opacity-0 h-0 overflow-hidden mb-0' : 'mb-2'}`}>
          <AppUpdateButton variant="backoffice" />
        </div>

        <button
          onClick={handleLogout}
          title={!isMobile && isCollapsed ? 'Cerrar Sesión' : undefined}
          className={`group flex items-center justify-center rounded-xl bg-neutral-800 text-neutral-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full ${!isMobile && isCollapsed ? 'p-3' : 'space-x-2 px-4 py-2'
            }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className={`text-sm font-medium transition-all duration-300 whitespace-nowrap ${!isMobile && isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}>
            Cerrar Sesión
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex bg-black border-r border-neutral-800 flex-col transition-all duration-300 ease-in-out shadow-2xl z-20 ${isCollapsed ? 'w-20' : 'w-64'
        }`}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-neutral-900">
        {/* Top Navbar */}
        <header className="border-b border-neutral-800 bg-black/50 backdrop-blur-md sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
          <div className="h-16 flex items-center px-4 sm:px-8 gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden text-white hover:text-emerald-400 transition-colors p-2 -ml-2"
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">
              Panel de Control Corporativo
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Aquí podrían ir notificaciones o buscador global */}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative scrollbar-hide">
          <Outlet />
        </div>
      </main>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)}></div>
          <div className="absolute top-0 left-0 h-full w-72 bg-black border-r border-neutral-800 flex flex-col shadow-2xl pt-[env(safe-area-inset-top)]">
            <SidebarContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Rellena el safe-area-bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-black z-0 pointer-events-none" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} aria-hidden />
    </div>
  );
};

export default BackofficeLayout;
