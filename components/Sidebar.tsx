import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, FileText, Settings, UtensilsCrossed, ClipboardList, LogOut, Menu, X, Package, BarChart, MessageSquare, Users, Shield, Download, Tag, RefreshCw, MapPin, DollarSign, Zap, Moon, Sun, Truck, TrendingUp, BadgeCheck, Building2, Landmark, UserCircle } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../hooks/usePWA';
import { useTheme } from '../context/ThemeContext';
import { useChat } from '../context/ChatContext';
import { UserRole } from '../types';
import { Logo } from './common/Logo';
import { PWANotification } from './PWANotification';
import { useLocation } from '../context/LocationContext';
import { LocationSelector } from './customer/home/LocationSelector';
import { logger } from '../utils/logger';
import { getUserVenueId } from '../utils/getUserVenueId';

const Sidebar: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const { city, address } = useLocation();
  const { venue, logoUrl, isDarkMode, toggleDarkMode } = useTheme();
  const { unreadCount } = useChat();
  const { isInstalled, installApp, showInstructions, setShowInstructions } = usePWA();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Real-time badge: pedidos PENDING + PAID para la sede actual
  useEffect(() => {
    if (!user?.id) return;
    if (user.role === UserRole.CUSTOMER || user.role === UserRole.DRIVER) return;

    const venueId = getUserVenueId(user);
    if (!venueId && user.role !== UserRole.SUPER_ADMIN) return;

    const constraints: any[] = [where('status', 'in', ['PENDING', 'PAID'])];
    if (venueId) constraints.push(where('venueId', '==', venueId));

    const q = query(collection(db, 'orders'), ...constraints);
    const unsub = onSnapshot(q, snap => setPendingOrdersCount(snap.size), () => { });
    return () => unsub();
  }, [user?.id, user?.venueId, user?.venueIds, user?.role]);

  // Bloquear scroll del cuerpo cuando el menú móvil está abierto
  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/#/login';
      window.location.reload();
    } catch (error) {
      logger.error('Sidebar: Logout failed', error);
      window.location.href = '/#/login';
    }
  };

  const toggleMobileMenu = () => setIsMobileOpen(!isMobileOpen);

  const dashPath = user?.role === UserRole.SUPER_ADMIN ? '/admin' : '/dashboard';

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive
      ? 'bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/20 backdrop-blur-sm'
      : 'text-slate-400 hover:bg-white/10 hover:text-white'
    }`;

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <Link
            to={dashPath}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={venue?.name || 'Logo'}
                className="h-10 w-10 object-contain rounded-xl bg-white/5 p-1"
              />
            ) : (
              <div className="p-1.5 bg-white/5 rounded-xl">
                <Logo size="md" />
              </div>
            )}
            <span className="text-xl font-bold text-white tracking-tight">
              {venue?.name || 'Rescatto'}
            </span>
          </Link>
          {/* Botón de Cerrar para Móvil */}
          <button onClick={toggleMobileMenu} aria-label="Cerrar menú" className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
            <X size={24} />
          </button>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all mb-4"
        >
          <X size={18} />
          <span className="text-sm font-semibold">Colapsar menú</span>
        </button>

        {/* Fragmento del Perfil de Usuario */}
        {user && (
          <div className="mb-2">
            <Link
              to="/profile"
              className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group cursor-pointer backdrop-blur-sm"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-emerald-900/20">
                {user.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{user.fullName}</p>
                <p className="text-xs text-slate-400 truncate font-medium">{user.role.replace('_', ' ')}</p>
              </div>
            </Link>
            <button
              onClick={() => setShowLocationSelector(true)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer mt-3 px-1"
            >
              <MapPin size={12} />
              <span className="truncate max-w-[180px] text-left">{city || address || 'Definir ciudad'}</span>
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 overflow-y-auto space-y-6 no-scrollbar pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* SECCIÓN PRINCIPAL */}
        {hasRole([UserRole.VENUE_OWNER]) && (
          <div className="space-y-1">
            <NavLink to="/dashboard" className={`tour-step-dashboard ${navClass({ isActive: window.location.hash.includes('/dashboard') })}`} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <LayoutDashboard size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Dashboard</span>
            </NavLink>
          </div>
        )}

        {/* SECCIÓN OPERACIONES */}
        {(hasRole([UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN]) || hasRole([UserRole.DRIVER])) && (
          <div className="space-y-1">
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Operaciones</p>
            {hasRole([UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN]) && (
              <NavLink to="/orders" className={`tour-step-orders ${navClass({ isActive: window.location.hash.includes('/orders') })}`} onClick={() => setIsMobileOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                  <UtensilsCrossed size={18} className="sidebar-icon" />
                </div>
                <span className="font-medium flex-1">Pedidos (KDS)</span>
                {pendingOrdersCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                  </span>
                )}
              </NavLink>
            )}
            {hasRole([UserRole.DRIVER]) && (
              <NavLink to="/driver" className={navClass} onClick={() => setIsMobileOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                  <Package size={18} className="sidebar-icon" />
                </div>
                <span className="font-medium">Mis Entregas</span>
              </NavLink>
            )}
          </div>
        )}

        {/* SECCIÓN GESTIÓN */}
        {hasRole([UserRole.VENUE_OWNER, UserRole.ADMIN]) && getUserVenueId(user) && (
          <div className="space-y-1">
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gestión</p>
            <NavLink to="/products" className={`tour-step-products ${navClass({ isActive: window.location.hash.includes('/products') })}`} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <Package size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Catalogo</span>
            </NavLink>
            <NavLink to="/order-management" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <ClipboardList size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Historial</span>
            </NavLink>
            <NavLink to="/analytics" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <BarChart size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Analytics</span>
            </NavLink>
            <NavLink to="/flash-deals" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <Zap size={18} className="sidebar-icon text-yellow-400" />
              </div>
              <span className="font-medium">Flash Deals</span>
            </NavLink>
            {hasRole([UserRole.VENUE_OWNER]) && (
              <NavLink to="/finance" className={navClass} onClick={() => setIsMobileOpen(false)}>
                <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                  <DollarSign size={18} className="sidebar-icon text-emerald-400" />
                </div>
                <span className="font-medium">Billetera</span>
              </NavLink>
            )}
          </div>
        )}

        {/* SECCIÓN COMUNICACIÓN */}
        <div className="space-y-1">
          <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Social</p>
          <NavLink to="/chat" className={navClass} onClick={() => setIsMobileOpen(false)}>
            <div className="relative p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              <MessageSquare size={18} className="sidebar-icon" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <span className="text-[9px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </div>
              )}
            </div>
            <span className="font-medium">Mensajes</span>
          </NavLink>
        </div>

        {/* SECCIÓN ADMINISTRACIÓN */}
        {hasRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]) && (
          <div className="space-y-1">
            <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Admin</p>
            <NavLink to="/admin/users" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <Users size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Usuarios</span>
            </NavLink>
            <NavLink to="/admin/categories" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <Tag size={18} className="sidebar-icon text-emerald-500" />
              </div>
              <span className="font-medium">Categorías</span>
            </NavLink>
            <NavLink to="/admin/venues" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <LayoutDashboard size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Negocios</span>
            </NavLink>
            {hasRole([UserRole.SUPER_ADMIN]) && (
              <>
                <NavLink to="/admin/audit-logs" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Shield size={18} className="sidebar-icon" />
                  </div>
                  <span className="font-medium">Logs</span>
                </NavLink>
                <NavLink to="/admin/finance" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <DollarSign size={18} className="sidebar-icon text-emerald-400" />
                  </div>
                  <span className="font-medium">Finanzas Global</span>
                </NavLink>
                <NavLink to="/admin/commissions" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Landmark size={18} className="sidebar-icon text-amber-400" />
                  </div>
                  <span className="font-medium">Comisiones</span>
                </NavLink>
                <NavLink to="/admin/sales" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <TrendingUp size={18} className="sidebar-icon text-blue-400" />
                  </div>
                  <span className="font-medium">Ventas Global</span>
                </NavLink>
                <NavLink to="/admin/deliveries" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Truck size={18} className="sidebar-icon text-orange-400" />
                  </div>
                  <span className="font-medium">Domicilios</span>
                </NavLink>
                <NavLink to="/admin/subscriptions" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <BadgeCheck size={18} className="sidebar-icon text-violet-400" />
                  </div>
                  <span className="font-medium">Suscripciones</span>
                </NavLink>
                <NavLink to="/admin/payment-settings" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Building2 size={18} className="sidebar-icon text-emerald-400" />
                  </div>
                  <span className="font-medium">Datos Bancarios</span>
                </NavLink>
                <NavLink to="/admin/settings" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Settings size={18} className="sidebar-icon text-gray-400" />
                  </div>
                  <span className="font-medium">Config. Plataforma</span>
                </NavLink>
                <NavLink to="/tech-docs" className={navClass} onClick={() => setIsMobileOpen(false)}>
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <FileText size={18} className="sidebar-icon" />
                  </div>
                  <span className="font-medium">Docs</span>
                </NavLink>
              </>
            )}
          </div>
        )}

        {/* SECCIÓN SISTEMA */}
        <div className="space-y-1">
          <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sistema</p>
          {hasRole([UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]) && (
            <NavLink to="/settings" className={navClass} onClick={() => setIsMobileOpen(false)}>
              <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                <Settings size={18} className="sidebar-icon" />
              </div>
              <span className="font-medium">Configuración</span>
            </NavLink>
          )}
          <NavLink to="/profile" className={navClass} onClick={() => setIsMobileOpen(false)}>
            <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              <UserCircle size={18} className="sidebar-icon" />
            </div>
            <span className="font-medium">Mi Perfil</span>
          </NavLink>
        </div>

        <InstallAppButton
          isInstalled={isInstalled}
          installApp={installApp}
        />
      </nav>

      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/5 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex gap-2 mb-3">
          <button
            onClick={toggleDarkMode}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 hover:bg-slate-800 hover:text-white transition-all group cursor-pointer"
          >
            {isDarkMode ? <Sun size={18} className="text-yellow-400 group-hover:scale-110 transition-transform" /> : <Moon size={18} className="text-blue-400 group-hover:scale-110 transition-transform" />}
            <span className="font-medium text-sm">{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors group cursor-pointer"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Gatillo para Móvil - Fixed Header */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-50 px-4 pt-safe-top h-header-mobile flex items-center justify-between shadow-lg shadow-black/20">
        <Link to={dashPath} className="flex items-center space-x-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
          ) : (
            <Logo size="sm" />
          )}
          <span className="font-bold text-white text-lg tracking-tight">{venue?.name || 'Rescatto'}</span>
        </Link>
        <button onClick={toggleMobileMenu} aria-label="Abrir menú" className="text-white hover:text-emerald-400 transition-colors p-2 -mr-2 active:scale-95">
          <Menu size={26} />
        </button>
      </div>

      {/* Sidebar para Escritorio */}
      <div className="hidden lg:flex w-[280px] bg-slate-900 border-r border-slate-800 h-screen flex-col sticky top-0 shadow-2xl z-30">
        <SidebarContent />
      </div>

      {/* Superposición del Sidebar para Móvil */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={toggleMobileMenu}></div>
          <div className="absolute top-0 left-0 w-[280px] h-full bg-slate-900 shadow-2xl flex flex-col animate-slide-in-left transform transition-transform duration-300 border-r border-slate-800">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Notificación de Instrucciones de PWA */}
      {showInstructions && (
        <PWANotification onClose={() => setShowInstructions(false)} />
      )}

      {/* Modal del Selector de Ubicación */}
      {showLocationSelector && (
        <LocationSelector onClose={() => setShowLocationSelector(false)} />
      )}
    </>
  );
};

const InstallAppButton: React.FC<{ isInstalled: boolean; installApp: () => void }> = ({ isInstalled, installApp }) => {

  if (isInstalled) {
    return (
      <button
        onClick={installApp}
        className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200 group cursor-pointer mb-2"
      >
        <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
          <RefreshCw size={18} className="sidebar-icon text-blue-400" />
        </div>
        <span className="font-medium">Actualizar APP</span>
      </button>
    );
  }

  return (
    <button
      onClick={installApp}
      className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200 group cursor-pointer mb-2"
    >
      <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
        <Download size={18} className="sidebar-icon text-emerald-400" />
      </div>
      <span className="font-medium">Instalar App</span>
    </button>
  );
};

export default Sidebar;
