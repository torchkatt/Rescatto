import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';
import { LocationProvider } from './context/LocationContext';
import { NotificationProvider } from './context/NotificationContext';
import { featureFlagService } from './services/featureFlagService';
import { analytics } from './services/firebase';
import { logEvent } from 'firebase/analytics';
// Helper for lazy loading to avoid TS errors with named exports
const lazyLoad = (importFunc: () => Promise<any>, exportName?: string) => {
    return React.lazy(() => importFunc().then(m => ({ default: exportName && m[exportName] ? m[exportName] : m.default || Object.values(m)[0] })));
};

// Pages - Admin
const SuperAdminDashboard = lazyLoad(() => import('./pages/admin/SuperAdminDashboard'), 'SuperAdminDashboard');
const UsersManager = lazyLoad(() => import('./pages/admin/UsersManager'), 'UsersManager');
const VenuesManager = lazyLoad(() => import('./pages/admin/VenuesManager'), 'VenuesManager');
const CategoriesManager = lazyLoad(() => import('./pages/admin/CategoriesManager'), 'CategoriesManager');
const AuditLogs = lazyLoad(() => import('./pages/admin/AuditLogs'), 'AuditLogs');
const FinanceManager = lazyLoad(() => import('./pages/admin/FinanceManager'), 'FinanceManager');
const AdminDeliveriesPage = lazyLoad(() => import('./pages/admin/sections/AdminDeliveries'), 'AdminDeliveries');
const AdminSalesPage = lazyLoad(() => import('./pages/admin/sections/AdminSales'), 'AdminSales');
const AdminSettingsPage = lazyLoad(() => import('./pages/admin/sections/AdminSettings'), 'AdminSettings');
const RegionalDashboard = lazyLoad(() => import('./pages/admin/RegionalDashboard'), 'RegionalDashboard');
import { VerifyEmail } from './pages/VerifyEmail';

// --- Backoffice V2 ---
import SuperAdminRoute from './components/admin/SuperAdminRoute';
import BackofficeLayout from './components/admin/layout/BackofficeLayout';
const DashboardOverview = lazyLoad(() => import('./pages/backoffice/DashboardOverview'), 'default');
const BackofficeVenuesManager = lazyLoad(() => import('./pages/backoffice/VenuesManager'), 'default');

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { UserRole } from './types';

// Pages - Business
const Login = lazyLoad(() => import('./pages/Login'));
const Dashboard = lazyLoad(() => import('./pages/Dashboard'));
const Orders = lazyLoad(() => import('./pages/Orders'));
const Settings = lazyLoad(() => import('./pages/Settings'));
const TechDocs = lazyLoad(() => import('./pages/TechDocs'));
const ProductManager = lazyLoad(() => import('./pages/business/ProductManager'), 'ProductManager');
const OrderManagement = lazyLoad(() => import('./pages/business/OrderManagement'), 'OrderManagement');
const Analytics = lazyLoad(() => import('./pages/business/Analytics'), 'Analytics');
const FlashDealsManager = lazyLoad(() => import('./pages/business/FlashDealsManager'), 'FlashDealsManager');
const VenueFinance = lazyLoad(() => import('./pages/admin/VenueFinance'), 'VenueFinance');
const FirestoreSetup = lazyLoad(() => import('./components/FirestoreSetup'), 'FirestoreSetup');
const UserSeeder = lazyLoad(() => import('./pages/admin/UserSeeder'), 'UserSeeder');
import { ChatButton } from './components/chat/ChatButton';

// Pages - Driver
const DriverDashboard = lazyLoad(() => import('./pages/driver/DriverDashboard'));

// Pages - Chat
const ChatPage = lazyLoad(() => import('./pages/Chat'));

// Pages - Customer
const CustomerHome = lazyLoad(() => import('./pages/customer/Home'));
const CustomerLogin = lazyLoad(() => import('./pages/customer/Login'));
const Cart = lazyLoad(() => import('./pages/customer/Cart'));
const VenueDetail = lazyLoad(() => import('./pages/customer/VenueDetail'));
const ProductDetail = lazyLoad(() => import('./pages/customer/ProductDetail'));
const Checkout = lazyLoad(() => import('./pages/customer/Checkout'));
const MyOrders = lazyLoad(() => import('./pages/customer/MyOrders'));
const Favorites = lazyLoad(() => import('./pages/customer/Favorites'));
const Impact = lazyLoad(() => import('./pages/customer/Impact'));
const UnifiedProfile = lazyLoad(() => import('./pages/profile/UnifiedProfile'), 'UnifiedProfile');

import { ReloadPrompt } from './components/ReloadPrompt';

import { LoadingScreen, LoadingSpinner } from './components/customer/common/Loading';
import { CustomerBottomNav } from './components/customer/layout/CustomerBottomNav';
import { messagingService } from './services/messagingService';

// Smart Redirect Component
const RootRedirect: React.FC = () => {
    const { user, isLoading, isEmailVerified, isAccountVerified } = useAuth();

    // Si ya tiene permiso concedido, renovar el token FCM silenciosamente.
    // Se usa un ref para ejecutarlo solo UNA vez por sesión (evita 403 repetidos).
    const fcmRegisteredRef = React.useRef(false);
    useEffect(() => {
        if (user && user.id && !user.isGuest && Notification.permission === 'granted' && !fcmRegisteredRef.current) {
            fcmRegisteredRef.current = true;
            messagingService.requestPermissionAndSaveToken(user.id).catch(() => {});
        }
    }, [user?.id]);
    const { hasRole } = useAuth();
    if (isLoading) return <LoadingScreen />;

    // Sin sesión → ir al app como invitado (auto-login se activa en CustomerLayout)
    if (!user) return <Navigate to="/app" replace />;

    // Force Account/Email verification (solo usuarios reales, no anónimos)
    if (!isAccountVerified) {
        return <Navigate to="/verify-email" replace />;
    }

    // V2-Aware Redirection
    const isSuperAdminOrAdmin = hasRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    
    console.log('RootRedirect: Checking roles...', {
        userId: user?.id,
        role: user?.role,
        isSuperAdminOrAdmin,
        currentPath: window.location.hash
    });

    if (isSuperAdminOrAdmin) {
        console.log('RootRedirect: Redirecting to backoffice dashboard');
        return <Navigate to="/backoffice/dashboard" replace />;
    } else if (user.role === UserRole.CITY_ADMIN) {
        return <Navigate to="/regional-dashboard" replace />;
    } else if (user.role === UserRole.DRIVER) {
        return <Navigate to="/driver" replace />;
    } else {
        // Default to Customer App for everything else (including UserRole.CUSTOMER)
        return <Navigate to="/app" replace />;
    }
};

import { FloatingCartButton } from './components/customer/common/FloatingCartButton';

// Wrapper for Customer Layout
const CustomerLayout: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading, loginAsGuest } = useAuth();
    const guestLoginAttempted = React.useRef(false);
    // Track auth state en ref para poder leerlo dentro del setTimeout
    const authRef = React.useRef({ isAuthenticated, authLoading });
    authRef.current = { isAuthenticated, authLoading };

    // Auto-login como invitado si el usuario llega sin sesión (máximo un intento).
    // Delay de 600ms tras detectar !isAuthenticated para dar tiempo al auth state
    // de estabilizarse (evita race condition anónimo→real al navegar desde /login).
    useEffect(() => {
        const isManualLogout = sessionStorage.getItem('rescatto_manual_logout') === 'true';
        
        if (!authLoading && !isAuthenticated && !guestLoginAttempted.current && !isManualLogout) {
            const timer = setTimeout(() => {
                // Re-verificar con el estado actual: si ya se autenticó, no hacer nada
                if (!authRef.current.isAuthenticated && !authRef.current.authLoading && !guestLoginAttempted.current) {
                    guestLoginAttempted.current = true;
                    loginAsGuest().catch(() => {/* silencioso */});
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [authLoading, isAuthenticated, loginAsGuest]);

    // FCM deep linking: navigate to the correct order when user taps a background notification
    useEffect(() => {
        const handleSWMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.orderId) {
                navigate(`/app/orders?highlight=${event.data.orderId}`);
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    }, [navigate]);

    return (
        <div className="pt-safe-top min-h-screen bg-gray-50 pb-[calc(5rem+env(safe-area-inset-bottom))] overflow-x-hidden">
            <Outlet />
            {/* Navigación Global Inferior (Persistente) */}
            <CustomerBottomNav />
            {/* Global Floating Chat Button */}
            <ChatButton />
            {/* Global Persistent Cart Button */}
            <FloatingCartButton />
        </div>
    );
};

// Profile Redirect Based on Role
const ProfileRedirect: React.FC = () => {
    const { user } = useAuth();

    // Sin sesión o invitado → perfil de customer
    if (!user || user.isGuest) return <Navigate to="/app/profile" replace />;

    switch (user.role) {
        case UserRole.CUSTOMER:
            return <Navigate to="/app/profile" replace />;
        case UserRole.DRIVER:
            return <Navigate to="/driver/profile" replace />;
        case UserRole.SUPER_ADMIN:
        case UserRole.ADMIN:
            return <Navigate to="/admin/profile" replace />;
        case UserRole.CITY_ADMIN:
            return <Navigate to="/regional-dashboard/profile" replace />; // O simplemente /admin/profile
        default:
            return <Navigate to="/dashboard/profile" replace />;
    }
};

const AppRoutes: React.FC = () => {
    return (
        <React.Suspense fallback={<LoadingSpinner fullPage size="lg" />}>
            <Routes>
                {/* UNIFIED ROOT: Decides where to go */}
                <Route path="/" element={<RootRedirect />} />

                {/* PUBLIC AUTH */}
                <Route path="/login" element={<Login />} />
                <Route path="/firestore-setup" element={<FirestoreSetup />} />

                {/* SEEDER ROUTE (DEV/DEMO ONLY) - Protected against Prod execution */}
                <Route path="/seed-users" element={
                    (!import.meta.env.PROD || window.location.hostname.includes('demo'))
                        ? <UserSeeder />
                        : <Navigate to="/login" />
                } />

                {/* EMAIL VERIFICATION */}
                <Route path="/verify-email" element={<VerifyEmail />} />

                {/* --- BACKOFFICE V2 ROUTES --- */}
                <Route path="/backoffice" element={
                    <SuperAdminRoute>
                        <BackofficeLayout />
                    </SuperAdminRoute>
                }>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardOverview />} />
                    <Route path="users" element={<UsersManager />} /> {/* Reusing existing for now */}
                    <Route path="venues" element={<BackofficeVenuesManager />} />
                    <Route path="audit" element={<AuditLogs />} /> {/* Reusing existing for now */}
                    {/* Placeholder routes for layout links */}
                    <Route path="drivers" element={<div className="p-8 text-white">Pronto: Conductores</div>} />
                    <Route path="orders" element={<div className="p-8 text-white">Pronto: Pedidos Globales</div>} />
                    <Route path="support" element={<div className="p-8 text-white">Pronto: Soporte</div>} />
                    <Route path="settings" element={<div className="p-8 text-white">Pronto: Settings</div>} />
                </Route>

                {/* --- LEGACY ADMIN ROUTES (Will be deprecated) --- */}
                <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><SuperAdminDashboard /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/regional-dashboard" element={
                    <ProtectedRoute allowedRoles={[UserRole.CITY_ADMIN, UserRole.SUPER_ADMIN]}>
                        <Layout><RegionalDashboard /></Layout>
                    </ProtectedRoute>
                } />

                {/* --- BUSINESS ROUTES --- */}
                <Route path="/dashboard" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN, UserRole.KITCHEN_STAFF]}>
                        <Layout><Dashboard /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/inventory" element={<Navigate to="/products" replace />} />
                <Route path="/products" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><ProductManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/orders" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN]}>
                        <Layout><Orders /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/order-management" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><OrderManagement /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/analytics" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><Analytics /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><Settings /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/tech-docs" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><TechDocs /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/finance" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><VenueFinance /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/flash-deals" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]}>
                        <Layout><FlashDealsManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/dashboard/profile" element={
                    <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN, UserRole.KITCHEN_STAFF]}>
                        <Layout><UnifiedProfile /></Layout>
                    </ProtectedRoute>
                } />

                {/* --- ADMIN CONFIG ROUTES --- */}
                <Route path="/admin/users" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
                        <Layout><UsersManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/venues" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
                        <Layout><VenuesManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/categories" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
                        <Layout><CategoriesManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/audit-logs" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><AuditLogs /></Layout>
                    </ProtectedRoute>
                } />

                <Route path="/admin/finance" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><FinanceManager /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/deliveries" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><AdminDeliveriesPage /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/sales" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><AdminSalesPage /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/settings" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                        <Layout><AdminSettingsPage /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/admin/profile" element={
                    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
                        <Layout><UnifiedProfile /></Layout>
                    </ProtectedRoute>
                } />

                {/* --- DRIVER ROUTES --- */}
                <Route path="/driver" element={
                    <ProtectedRoute allowedRoles={[UserRole.DRIVER, UserRole.SUPER_ADMIN]}>
                        <Layout><DriverDashboard /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/driver/profile" element={
                    <ProtectedRoute allowedRoles={[UserRole.DRIVER, UserRole.SUPER_ADMIN]}>
                        <Layout><UnifiedProfile /></Layout>
                    </ProtectedRoute>
                } />

                {/* --- CHAT ROUTE (All roles) --- */}
                <Route path="/chat" element={
                    <ProtectedRoute allowedRoles={[UserRole.CUSTOMER, UserRole.VENUE_OWNER, UserRole.DRIVER, UserRole.SUPER_ADMIN]}>
                        <ChatPage />
                    </ProtectedRoute>
                } />

                {/* --- PROFILE DISPATCHER --- */}
                <Route path="/profile" element={<ProfileRedirect />} />

                {/* --- CUSTOMER ROUTES --- */}
                <Route path="/app" element={<CustomerLayout />}>
                    <Route index element={
                        <CustomerHome />
                    } />
                    <Route path="venue/:venueId" element={
                        <VenueDetail />
                    } />
                    <Route path="product/:productId" element={
                        <ProductDetail />
                    } />
                    <Route path="cart" element={
                        <Cart />
                    } />
                    <Route path="checkout" element={
                        <Checkout />
                    } />
                    <Route path="orders" element={
                        <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]} disallowGuests={true}>
                            <MyOrders />
                        </ProtectedRoute>
                    } />
                    <Route path="profile" element={
                        <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]}>
                            <UnifiedProfile />
                        </ProtectedRoute>
                    } />
                    <Route path="favorites" element={
                        <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]} disallowGuests={true}>
                            <Favorites />
                        </ProtectedRoute>
                    } />
                    <Route path="impact" element={
                        <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]} disallowGuests={true}>
                            <Impact />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </React.Suspense>
    );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configure React Query Client directly in App
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes caching by default
            gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
            retry: 1, // Let it fail fast if offline
            refetchOnWindowFocus: false, // Don't refetch on tab switch to avoid spamming Firestore
        },
    },
});

const App: React.FC = () => {
    useEffect(() => {
        featureFlagService.init();
        if (analytics) {
            logEvent(analytics, 'app_initialize', {
                version: '1.0.0',
                platform: 'web'
            });
        }
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary section="Rescatto App">
                <AuthProvider>
                    <ThemeProvider>
                        <ToastProvider>
                            <ConfirmProvider>
                                <NotificationProvider>
                                    <CartProvider>
                                        <ChatProvider>
                                            <LocationProvider>
                                                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                                                    <ReloadPrompt />
                                                    <ErrorBoundary section="Navegación">
                                                        <AppRoutes />
                                                    </ErrorBoundary>
                                                </Router>
                                            </LocationProvider>
                                        </ChatProvider>
                                    </CartProvider>
                                </NotificationProvider>
                            </ConfirmProvider>
                        </ToastProvider>
                    </ThemeProvider>
                </AuthProvider>
            </ErrorBoundary>
        </QueryClientProvider>
    );
};

export default App;
