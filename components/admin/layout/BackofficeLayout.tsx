import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { 
  BarChart3, 
  Users, 
  Store, 
  Car, 
  ShoppingBag, 
  LogOut, 
  ShieldAlert,
  HeadphonesIcon,
  Settings
} from 'lucide-react';

const BackofficeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
    { to: '/backoffice/drivers', icon: Car, label: 'Conductores' },
    { to: '/backoffice/orders', icon: ShoppingBag, label: 'Pedidos' },
    { to: '/backoffice/support', icon: HeadphonesIcon, label: 'Soporte' },
    { to: '/backoffice/audit', icon: ShieldAlert, label: 'Auditoría' },
    { to: '/backoffice/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Rescatto
          </h1>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-semibold">Super Admin</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar Placeholder (breadcrumbs, search) could go here */}
        <header className="h-16 border-b border-neutral-800 bg-black/50 backdrop-blur-md flex items-center px-8 z-10 sticky top-0">
           <div className="text-sm text-neutral-400">
              Panel de Control Corporativo
           </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BackofficeLayout;
