import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UserRole } from '../../types';

// ─── Mock AuthContext ────────────────────────────────────────────────────────
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Mock react-i18next ──────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // When called with opts containing interpolation values, include the first
    // string value so assertions on user names (e.g. /Maria/) keep passing.
    t: (key: string, opts?: Record<string, unknown>) => {
        if (opts) {
            const firstVal = Object.values(opts).find(v => typeof v === 'string');
            if (firstVal) return `${key} ${firstVal}`;
        }
        return key;
    },
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: any) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// ─── Mock Loading components ─────────────────────────────────────────────────
vi.mock('../../components/customer/common/Loading', () => ({
  LoadingScreen: ({ message }: { message?: string }) => (
    <div data-testid="loading-screen">{message || 'Loading...'}</div>
  ),
  LoadingSpinner: () => <div data-testid="loading-spinner">Spinner</div>,
}));

// ─── Mock audit service (used by ProtectedRoute) ────────────────────────────
vi.mock('../../services/auditService', () => ({
  auditService: { logEvent: vi.fn() },
  AuditAction: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
}));

// ─── Mock logger ─────────────────────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Mock formatters ─────────────────────────────────────────────────────────
vi.mock('../../utils/formatters', () => ({
  formatCOP: (v: number) => `$${v}`,
  formatKgCO2: (v: number) => `${v}kg`,
}));

// ─── Mock Firebase ───────────────────────────────────────────────────────────
vi.mock('../../services/firebase', () => ({
  db: {},
  auth: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  limit: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  orderBy: vi.fn(),
  startAfter: vi.fn(),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));

// ─── Mock services ───────────────────────────────────────────────────────────
vi.mock('../../services/dataService', () => ({
  dataService: {
    getVenuesByIds: vi.fn(() => Promise.resolve([])),
    getVenue: vi.fn(() => Promise.resolve(null)),
    getProducts: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../services/analyticsService', () => ({
  getRevenueMetrics: vi.fn(() => Promise.resolve({})),
  getOrderStatistics: vi.fn(() => Promise.resolve({})),
  getTopProducts: vi.fn(() => Promise.resolve([])),
  getDailyRevenueTrends: vi.fn(() => Promise.resolve([])),
  getDateRangePresets: vi.fn(() => ({
    last7Days: { start: new Date(), end: new Date() },
    last30Days: { start: new Date(), end: new Date() },
    thisMonth: { start: new Date(), end: new Date() },
    lastMonth: { start: new Date(), end: new Date() },
    custom: { start: new Date(), end: new Date() },
  })),
}));

vi.mock('../../services/adminService', () => ({
  adminService: {
    getAllVenues: vi.fn(() => Promise.resolve([])),
    getUsers: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../services/productService', () => ({
  productService: {
    getProductsByVenue: vi.fn(() => Promise.resolve({ products: [], lastDoc: null })),
    getProductsByVenuePage: vi.fn(() => Promise.resolve({ data: [], lastDoc: null, hasMore: false })),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
  },
}));

vi.mock('../../services/flashDealService', () => ({
  flashDealService: {
    getDealsByVenuePage: vi.fn(() => Promise.resolve({ deals: [], lastDoc: null, hasMore: false })),
    createDeal: vi.fn(),
    updateDeal: vi.fn(),
    deleteDeal: vi.fn(),
    toggleActive: vi.fn(),
  },
}));

vi.mock('../../services/geminiService', () => ({
  geminiService: {
    generateProductDescription: vi.fn(() => Promise.resolve('')),
  },
}));

vi.mock('../../services/messagingService', () => ({
  messagingService: {
    requestPermissionAndSaveToken: vi.fn(() => Promise.resolve()),
  },
}));

// ─── Mock context providers used by pages ────────────────────────────────────
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../context/ChatContext', () => ({
  useChat: () => ({
    createChat: vi.fn(),
    openChat: vi.fn(),
    currentChat: null,
    closeChat: vi.fn(),
    chats: [],
  }),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    sendNotification: vi.fn(),
    notifications: [],
    unreadCount: 0,
  }),
}));

// ─── Mock tanstack react-query ───────────────────────────────────────────────
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  useInfiniteQuery: vi.fn(() => ({
    data: { pages: [] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}));

// ─── Mock hooks ──────────────────────────────────────────────────────────────
vi.mock('../../hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock('../../hooks/usePaginatedOrders', () => ({
  usePaginatedOrders: vi.fn(() => ({
    data: { pages: [] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  })),
}));

// ─── Mock recharts (renders simple divs) ─────────────────────────────────────
vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="mock-area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
}));

// ─── Mock papaparse ──────────────────────────────────────────────────────────
vi.mock('papaparse', () => ({
  default: { unparse: vi.fn(() => '') },
  unparse: vi.fn(() => ''),
}));

// ─── Mock child components that are heavy ────────────────────────────────────
vi.mock('../../components/business/MerchantAIPredictions', () => ({
  MerchantAIPredictions: () => <div data-testid="mock-ai-predictions">AI Predictions</div>,
}));

vi.mock('../../components/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../components/common/Tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../components/MobilePreview', () => ({
  default: () => <div data-testid="mock-mobile-preview">Preview</div>,
}));

vi.mock('../../components/chat/ChatWindow', () => ({
  ChatWindow: () => <div data-testid="mock-chat-window">Chat</div>,
}));

vi.mock('../../components/analytics/MetricCard', () => ({
  MetricCard: ({ title }: any) => <div data-testid="mock-metric-card">{title}</div>,
}));

vi.mock('../../components/analytics/DateRangePicker', () => ({
  DateRangePicker: () => <div data-testid="mock-date-range-picker">DateRangePicker</div>,
}));

vi.mock('../../components/analytics/RevenueChart', () => ({
  RevenueChart: () => <div data-testid="mock-revenue-chart">RevenueChart</div>,
}));

vi.mock('../../components/analytics/OrdersChart', () => ({
  OrdersChart: () => <div data-testid="mock-orders-chart">OrdersChart</div>,
}));

vi.mock('../../components/analytics/TopProductsChart', () => ({
  TopProductsChart: () => <div data-testid="mock-top-products-chart">TopProductsChart</div>,
}));

vi.mock('../../components/admin/sections/RescueHeatmap', () => ({
  default: () => <div data-testid="mock-heatmap">Heatmap</div>,
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// ─── Import useAuth AFTER mock ───────────────────────────────────────────────
import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ─── Import ProtectedRoute and pages ─────────────────────────────────────────
import ProtectedRoute from '../../components/ProtectedRoute';
import Dashboard from '../../pages/Dashboard';
import { ProductManager } from '../../pages/business/ProductManager';
import { OrderManagement } from '../../pages/business/OrderManagement';
import { FlashDealsManager } from '../../pages/business/FlashDealsManager';
import { Analytics } from '../../pages/business/Analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crea un estado de auth completo con overrides */
const buildAuth = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  memberships: [],
  activeMembership: null,
  switchMembership: vi.fn(),
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  loginWithFacebook: vi.fn(),
  loginAsGuest: vi.fn(),
  convertGuestToUser: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => false),
  roles: [],
  sendVerificationEmail: vi.fn(),
  isEmailVerified: true,
  isAccountVerified: true,
  switchVenue: vi.fn(),
  ...overrides,
});

/** Renderiza una pagina dentro de ProtectedRoute con rutas de navegacion */
const renderProtected = (
  component: React.ReactElement,
  allowedRoles: UserRole[],
  path = '/test',
) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              {component}
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="page-login" />} />
        <Route path="/verify-email" element={<div data-testid="page-verify-email" />} />
        <Route path="/" element={<div data-testid="page-home-redirect" />} />
      </Routes>
    </MemoryRouter>
  );
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Business Flows — Render y acceso por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dashboard — allowedRoles: [VENUE_OWNER, SUPER_ADMIN, KITCHEN_STAFF]
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Dashboard', () => {
    const dashboardRoles = [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN, UserRole.KITCHEN_STAFF];

    it('renderiza correctamente para VENUE_OWNER', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'owner-1',
            role: UserRole.VENUE_OWNER,
            fullName: 'Maria Owner',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.VENUE_OWNER)),
        }) as any,
      );

      renderProtected(<Dashboard />, dashboardRoles);

      // Dashboard muestra el saludo con el nombre del usuario
      expect(screen.getByText(/Maria/)).toBeDefined();
    });

    it('renderiza correctamente para SUPER_ADMIN', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'admin-1',
            role: UserRole.SUPER_ADMIN,
            fullName: 'Admin User',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.SUPER_ADMIN)),
        }) as any,
      );

      renderProtected(<Dashboard />, dashboardRoles);

      expect(screen.getByText(/Admin/)).toBeDefined();
    });

    it('renderiza correctamente para KITCHEN_STAFF', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'kitchen-1',
            role: UserRole.KITCHEN_STAFF,
            fullName: 'Chef Carlos',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.KITCHEN_STAFF)),
        }) as any,
      );

      renderProtected(<Dashboard />, dashboardRoles);

      // KITCHEN_STAFF ve el saludo y la card especial "Tu Impacto de Hoy"
      expect(screen.getByText(/Chef/)).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ProductManager — allowedRoles: [VENUE_OWNER, SUPER_ADMIN]
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ProductManager', () => {
    const productRoles = [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN];

    it('renderiza para VENUE_OWNER', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'owner-1',
            role: UserRole.VENUE_OWNER,
            fullName: 'Maria Owner',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.VENUE_OWNER)),
        }) as any,
      );

      const { container } = renderProtected(<ProductManager />, productRoles);

      // La pagina no debe redirigir — debe renderizar contenido
      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('KITCHEN_STAFF NO tiene acceso (no esta en allowedRoles)', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'kitchen-1',
            role: UserRole.KITCHEN_STAFF,
            fullName: 'Chef Carlos',
            venueId: 'venue-1',
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.KITCHEN_STAFF)),
        }) as any,
      );

      renderProtected(<ProductManager />, productRoles);

      // ProtectedRoute redirige a "/" cuando el rol no esta permitido
      expect(screen.getByTestId('page-home-redirect')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OrderManagement — allowedRoles: [VENUE_OWNER, SUPER_ADMIN]
  // ═══════════════════════════════════════════════════════════════════════════

  describe('OrderManagement', () => {
    const orderRoles = [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN];

    it('renderiza para VENUE_OWNER', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'owner-1',
            role: UserRole.VENUE_OWNER,
            fullName: 'Maria Owner',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.VENUE_OWNER)),
        }) as any,
      );

      const { container } = renderProtected(<OrderManagement />, orderRoles);

      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renderiza para SUPER_ADMIN', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'admin-1',
            role: UserRole.SUPER_ADMIN,
            fullName: 'Admin User',
            venueIds: [],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.SUPER_ADMIN)),
        }) as any,
      );

      const { container } = renderProtected(<OrderManagement />, orderRoles);

      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FlashDealsManager — allowedRoles: [VENUE_OWNER, SUPER_ADMIN]
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FlashDealsManager', () => {
    const flashDealRoles = [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN];

    it('renderiza para VENUE_OWNER', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'owner-1',
            role: UserRole.VENUE_OWNER,
            fullName: 'Maria Owner',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.VENUE_OWNER)),
        }) as any,
      );

      const { container } = renderProtected(<FlashDealsManager />, flashDealRoles);

      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('KITCHEN_STAFF NO tiene acceso', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'kitchen-1',
            role: UserRole.KITCHEN_STAFF,
            fullName: 'Chef Carlos',
            venueId: 'venue-1',
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.KITCHEN_STAFF)),
        }) as any,
      );

      renderProtected(<FlashDealsManager />, flashDealRoles);

      expect(screen.getByTestId('page-home-redirect')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Analytics — allowedRoles: [VENUE_OWNER, SUPER_ADMIN]
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Analytics', () => {
    const analyticsRoles = [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN];

    it('renderiza para VENUE_OWNER', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'owner-1',
            role: UserRole.VENUE_OWNER,
            fullName: 'Maria Owner',
            venueId: 'venue-1',
            venueIds: ['venue-1'],
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.VENUE_OWNER)),
        }) as any,
      );

      const { container } = renderProtected(<Analytics />, analyticsRoles);

      expect(screen.queryByTestId('page-login')).toBeNull();
      expect(screen.queryByTestId('page-home-redirect')).toBeNull();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('KITCHEN_STAFF NO tiene acceso', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'kitchen-1',
            role: UserRole.KITCHEN_STAFF,
            fullName: 'Chef Carlos',
            venueId: 'venue-1',
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.KITCHEN_STAFF)),
        }) as any,
      );

      renderProtected(<Analytics />, analyticsRoles);

      expect(screen.getByTestId('page-home-redirect')).toBeDefined();
    });

    it('DRIVER NO tiene acceso', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          user: {
            id: 'driver-1',
            role: UserRole.DRIVER,
            fullName: 'Driver Daniel',
          },
          isAuthenticated: true,
          isAccountVerified: true,
          hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.DRIVER)),
        }) as any,
      );

      renderProtected(<Analytics />, analyticsRoles);

      expect(screen.getByTestId('page-home-redirect')).toBeDefined();
    });
  });
});
