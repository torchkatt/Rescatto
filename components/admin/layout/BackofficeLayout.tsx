import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
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
} from 'lucide-react';

const BackofficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Rescatto
            </h1>
            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-semibold">Super Admin</p>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Colapsar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-center space-x-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-emerald-400">
                {user?.fullName?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-black border-r border-neutral-800 flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar — pt-safe-area empuja el contenido bajo la barra de notificaciones */}
        <header className="border-b border-neutral-800 bg-black/50 backdrop-blur-md sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
          <div className="h-16 flex items-center px-4 sm:px-8 gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden text-white hover:text-emerald-400 transition-colors p-2 -ml-2"
              aria-label="Abrir menú"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="text-sm text-neutral-400">
              Panel de Control Corporativo
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
           <Outlet />
        </div>
      </main>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileOpen(false)}></div>
          <div className="absolute top-0 left-0 h-full w-64 bg-black border-r border-neutral-800 flex flex-col shadow-2xl pt-[env(safe-area-inset-top)]">
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default BackofficeLayout;
