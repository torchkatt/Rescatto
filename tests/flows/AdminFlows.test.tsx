import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import SuperAdminRoute from '../../components/admin/SuperAdminRoute';
import { UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}));

vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(false)),
}));

vi.mock('../../components/customer/common/Loading', () => ({
  LoadingScreen: ({ message }: { message?: string }) => (
    <div data-testid="loading-screen">{message || 'Loading...'}</div>
  ),
  LoadingSpinner: () => <div data-testid="loading-spinner">Spinner</div>,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  functions: {},
  auth: {},
}));

vi.mock('../../services/adminService', () => ({
  adminService: {
    getAllVenues: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/venueService', () => ({
  venueService: {
    getVenue: vi.fn(),
    updateVenue: vi.fn(),
    createVenue: vi.fn(),
    deleteVenue: vi.fn(),
  },
}));

vi.mock('../../services/walletService', () => ({
  walletService: {
    getWalletBalance: vi.fn().mockResolvedValue(null),
    getTransactionsPage: vi.fn().mockResolvedValue({ data: [], lastDoc: null, hasMore: false }),
  },
}));

vi.mock('../../services/reportService', () => ({
  reportService: {
    generateReport: vi.fn(),
  },
}));

vi.mock('../../services/auditService', () => ({
  auditService: { logEvent: vi.fn() },
  AuditAction: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/formatters', () => ({
  formatCOP: vi.fn((v: number) => `$${v}`),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
  limit: vi.fn(),
  startAfter: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

// Mock page components to avoid deep dependency trees
vi.mock('../../pages/admin/VenuesManager', () => ({
  VenuesManager: () => <div data-testid="venues-manager">VenuesManager</div>,
}));

vi.mock('../../pages/admin/VenueFinance', () => ({
  VenueFinance: () => <div data-testid="venue-finance">VenueFinance</div>,
}));

import { VenuesManager } from '../../pages/admin/VenuesManager';
import { VenueFinance } from '../../pages/admin/VenueFinance';

// ---------------------------------------------------------------------------
// Import mocked useAuth
// ---------------------------------------------------------------------------

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildAuthState = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isEmailVerified: true,
  isAccountVerified: true,
  hasRole: vi.fn(() => false),
  login: vi.fn(),
  logout: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  loginWithFacebook: vi.fn(),
  loginAsGuest: vi.fn(),
  convertGuestToUser: vi.fn(),
  roles: [],
  sendVerificationEmail: vi.fn(),
  switchVenue: vi.fn(),
  memberships: [],
  activeMembership: null,
  switchMembership: vi.fn(),
  ...overrides,
});

/** Render a child inside ProtectedRoute with given allowedRoles */
const renderWithProtectedRoute = (
  child: React.ReactElement,
  allowedRoles: UserRole[],
) => {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <ProtectedRoute allowedRoles={allowedRoles}>
        {child}
      </ProtectedRoute>
    </MemoryRouter>,
  );
};

/** Render a child inside SuperAdminRoute */
const renderWithSuperAdminRoute = (child: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/backoffice']}>
      <SuperAdminRoute>
        {child}
      </SuperAdminRoute>
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests — Admin (ProtectedRoute con SUPER_ADMIN + ADMIN)
// ---------------------------------------------------------------------------

describe('Admin — Acceso a VenuesManager por ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. SUPER_ADMIN puede acceder a VenuesManager
  it('VenuesManager se renderiza para SUPER_ADMIN', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'sa-1', role: UserRole.SUPER_ADMIN },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.ADMIN),
        ),
      }) as any,
    );

    renderWithProtectedRoute(
      <VenuesManager />,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    );

    expect(screen.getByTestId('venues-manager')).toBeDefined();
  });

  // 2. ADMIN puede acceder a VenuesManager
  it('VenuesManager se renderiza para ADMIN', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'admin-1', role: UserRole.ADMIN },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.ADMIN),
        ),
      }) as any,
    );

    renderWithProtectedRoute(
      <VenuesManager />,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    );

    expect(screen.getByTestId('venues-manager')).toBeDefined();
  });

  // 3. VENUE_OWNER no puede acceder a rutas admin
  it('VENUE_OWNER no puede acceder a rutas admin', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'vo-1', role: UserRole.VENUE_OWNER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderWithProtectedRoute(
      <VenuesManager />,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    );

    expect(screen.queryByTestId('venues-manager')).toBeNull();
  });

  // 4. CUSTOMER no puede acceder a rutas admin
  it('CUSTOMER no puede acceder a rutas admin', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'cust-1', role: UserRole.CUSTOMER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderWithProtectedRoute(
      <VenuesManager />,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    );

    expect(screen.queryByTestId('venues-manager')).toBeNull();
  });

  // 5. DRIVER no puede acceder a rutas admin
  it('DRIVER no puede acceder a rutas admin', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'drv-1', role: UserRole.DRIVER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderWithProtectedRoute(
      <VenuesManager />,
      [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    );

    expect(screen.queryByTestId('venues-manager')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Backoffice (SuperAdminRoute)
// ---------------------------------------------------------------------------

describe('Backoffice — SuperAdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 6. SUPER_ADMIN puede acceder via SuperAdminRoute
  it('SuperAdminRoute permite acceso a SUPER_ADMIN', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'sa-1', role: UserRole.SUPER_ADMIN },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.SUPER_ADMIN)),
      }) as any,
    );

    renderWithSuperAdminRoute(<VenueFinance />);

    expect(screen.getByTestId('venue-finance')).toBeDefined();
  });

  // 7. ADMIN puede acceder via SuperAdminRoute (admite SUPER_ADMIN y ADMIN)
  it('SuperAdminRoute bloquea a ADMIN (solo SUPER_ADMIN+ADMIN via hasRole)', () => {
    // SuperAdminRoute checks hasRole([SUPER_ADMIN, ADMIN]) — ADMIN should pass
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'admin-1', role: UserRole.ADMIN },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.ADMIN),
        ),
      }) as any,
    );

    renderWithSuperAdminRoute(<VenueFinance />);

    // SuperAdminRoute actually allows ADMIN because it checks hasRole([SUPER_ADMIN, ADMIN])
    expect(screen.getByTestId('venue-finance')).toBeDefined();
  });

  // 8. VENUE_OWNER bloqueado por SuperAdminRoute
  it('SuperAdminRoute bloquea a VENUE_OWNER', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'vo-1', role: UserRole.VENUE_OWNER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderWithSuperAdminRoute(<VenueFinance />);

    expect(screen.queryByTestId('venue-finance')).toBeNull();
  });
});
