import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import { UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/ChatContext', () => ({
  useChat: vi.fn(() => ({
    createChat: vi.fn(),
    openChat: vi.fn(),
    unreadCount: 0,
  })),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
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

vi.mock('../../services/dataService', () => ({
  dataService: {
    getVenue: vi.fn(),
    getProducts: vi.fn(),
  },
}));

vi.mock('../../services/ratingService', () => ({
  getRatingStats: vi.fn().mockResolvedValue(null),
  RatingDisplay: () => <div data-testid="rating-display" />,
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

vi.mock('../../components/rating/RatingDisplay', () => ({
  RatingDisplay: () => <div data-testid="rating-display" />,
}));

// ---------------------------------------------------------------------------
// Import mocked useAuth
// ---------------------------------------------------------------------------

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ---------------------------------------------------------------------------
// Mock DriverDashboard as a simple component that renders identifiable content
// We mock it because the real component has deep Firebase dependencies.
// The role-enforcement tests use ProtectedRoute (the real guard component).
// ---------------------------------------------------------------------------

vi.mock('../../pages/driver/DriverDashboard', () => ({
  DriverDashboard: () => (
    <div data-testid="driver-dashboard">
      <div data-testid="driver-stats">Stats del conductor</div>
    </div>
  ),
}));

import { DriverDashboard } from '../../pages/driver/DriverDashboard';

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

const renderProtected = (allowedRoles: UserRole[]) => {
  return render(
    <MemoryRouter initialEntries={['/driver']}>
      <ProtectedRoute allowedRoles={allowedRoles}>
        <DriverDashboard />
      </ProtectedRoute>
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DriverDashboard — Flujos de acceso por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. DRIVER puede acceder
  it('DriverDashboard se renderiza para rol DRIVER', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'driver-1', role: UserRole.DRIVER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.DRIVER)),
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.getByTestId('driver-dashboard')).toBeDefined();
  });

  // 2. SUPER_ADMIN puede acceder
  it('DriverDashboard se renderiza para rol SUPER_ADMIN', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'sa-1', role: UserRole.SUPER_ADMIN },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.SUPER_ADMIN)),
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.getByTestId('driver-dashboard')).toBeDefined();
  });

  // 3. CUSTOMER no puede acceder
  it('CUSTOMER no puede acceder a DriverDashboard (rol denegado)', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'cust-1', role: UserRole.CUSTOMER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.queryByTestId('driver-dashboard')).toBeNull();
  });

  // 4. VENUE_OWNER no puede acceder
  it('VENUE_OWNER no puede acceder a DriverDashboard (rol denegado)', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'vo-1', role: UserRole.VENUE_OWNER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn(() => false),
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.queryByTestId('driver-dashboard')).toBeNull();
  });

  // 5. Muestra estado de carga inicialmente
  it('muestra estado de carga cuando auth esta cargando', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isLoading: true,
        user: null,
        isAuthenticated: false,
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.getByTestId('loading-screen')).toBeDefined();
    expect(screen.queryByTestId('driver-dashboard')).toBeNull();
  });

  // 6. Renderiza seccion de stats del conductor despues de carga
  it('renderiza seccion de stats del conductor cuando tiene acceso', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'driver-2', role: UserRole.DRIVER },
        isAuthenticated: true,
        isAccountVerified: true,
        hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.DRIVER)),
      }) as any,
    );

    renderProtected([UserRole.DRIVER, UserRole.SUPER_ADMIN]);

    expect(screen.getByTestId('driver-dashboard')).toBeDefined();
    expect(screen.getByTestId('driver-stats')).toBeDefined();
  });
});
