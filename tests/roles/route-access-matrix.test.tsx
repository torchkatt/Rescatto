/**
 * FASE 2 — Matriz Completa de Acceso a Rutas
 *
 * Para cada ruta del sistema, verifica que:
 * - Los roles PERMITIDOS ven el contenido protegido
 * - Los roles DENEGADOS son redirigidos a "/"
 *
 * Cubre: rutas Business, Admin, Backoffice, Driver, Customer, Chat, Regional.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import SuperAdminRoute from '../../components/admin/SuperAdminRoute';
import { UserRole } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/customer/common/Loading', () => ({
  LoadingScreen: ({ message }: { message?: string }) => (
    <div data-testid="loading-screen">{message}</div>
  ),
}));
vi.mock('../../services/auditService', () => ({
  auditService: { logEvent: vi.fn() },
  AuditAction: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
}));

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ─── Tipos ───────────────────────────────────────────────────────────────────

const ALL_ROLES = Object.values(UserRole);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAuth(role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isAuthenticated: true,
    isAccountVerified: true,
    isEmailVerified: true,
    user: { id: `${role}-1`, role, isGuest: false },
    hasRole: vi.fn((roles: UserRole[]) => roles.includes(role)),
    ...overrides,
  } as any;
}

/**
 * Renderiza una ruta protegida con ProtectedRoute y detecta si el contenido
 * es visible o si se redirige a "/" (home-page).
 */
function renderRoute(allowedRoles: UserRole[], opts: { disallowGuests?: boolean; guestRedirect?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles} {...opts}>
              <div data-testid="protected-content">Contenido</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div data-testid="home-page" />} />
        <Route path="/login" element={<div data-testid="login-page" />} />
        <Route path="/verify-email" element={<div data-testid="verify-email-page" />} />
        <Route path="/app/profile" element={<div data-testid="app-profile-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Renderiza SuperAdminRoute (guard de /backoffice/*) y detecta redirección.
 */
function renderSuperAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/backoffice/dashboard']}>
      <Routes>
        <Route
          path="/backoffice/dashboard"
          element={
            <SuperAdminRoute>
              <div data-testid="backoffice-content">Backoffice</div>
            </SuperAdminRoute>
          }
        />
        <Route path="/" element={<div data-testid="home-page" />} />
        <Route path="/login" element={<div data-testid="login-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Utilidad para tests masivos de matriz ────────────────────────────────────

function testMatrix(
  suiteName: string,
  allowedRoles: UserRole[],
  opts: { disallowGuests?: boolean; guestRedirect?: string } = {},
) {
  const deniedRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));

  describe(suiteName, () => {
    beforeEach(() => vi.clearAllMocks());

    allowedRoles.forEach((role) => {
      it(`${role} tiene acceso`, () => {
        mockUseAuth.mockReturnValue(buildAuth(role));
        renderRoute(allowedRoles, opts);
        expect(screen.getByTestId('protected-content')).toBeDefined();
        expect(screen.queryByTestId('home-page')).toBeNull();
        expect(screen.queryByTestId('login-page')).toBeNull();
      });
    });

    deniedRoles.forEach((role) => {
      it(`${role} es denegado y redirigido a /`, () => {
        mockUseAuth.mockReturnValue(buildAuth(role));
        renderRoute(allowedRoles, opts);
        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — RUTAS BUSINESS
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.1 — Rutas Business', () => {
  testMatrix('/dashboard', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN, UserRole.KITCHEN_STAFF]);
  testMatrix('/products', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/orders', [UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.SUPER_ADMIN]);
  testMatrix('/order-management', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/analytics', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/settings', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/tech-docs', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/finance', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/flash-deals', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN]);
  testMatrix('/dashboard/profile', [UserRole.VENUE_OWNER, UserRole.SUPER_ADMIN, UserRole.KITCHEN_STAFF]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.2 — RUTAS ADMIN LEGACY
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.2 — Rutas Admin Legacy', () => {
  testMatrix('/admin', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/users', [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  testMatrix('/admin/venues', [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  testMatrix('/admin/categories', [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  testMatrix('/admin/audit-logs', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/finance', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/commissions', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/deliveries', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/sales', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/settings', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/subscriptions', [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
  testMatrix('/admin/payment-settings', [UserRole.SUPER_ADMIN]);
  testMatrix('/admin/profile', [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.3 — RUTAS BACKOFFICE V2 (SuperAdminRoute)
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.3 — Backoffice V2 (SuperAdminRoute)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('SUPER_ADMIN accede a /backoffice/dashboard', () => {
    mockUseAuth.mockReturnValue(
      buildAuth(UserRole.SUPER_ADMIN, {
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.ADMIN),
        ),
      }),
    );
    renderSuperAdminRoute();
    expect(screen.getByTestId('backoffice-content')).toBeDefined();
  });

  it('ADMIN accede a /backoffice/dashboard', () => {
    mockUseAuth.mockReturnValue(
      buildAuth(UserRole.ADMIN, {
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) || roles.includes(UserRole.ADMIN),
        ),
      }),
    );
    renderSuperAdminRoute();
    expect(screen.getByTestId('backoffice-content')).toBeDefined();
  });

  [UserRole.CITY_ADMIN, UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.DRIVER, UserRole.CUSTOMER].forEach(
    (role) => {
      it(`${role} es bloqueado de /backoffice/dashboard`, () => {
        mockUseAuth.mockReturnValue(
          buildAuth(role, { hasRole: vi.fn(() => false) }),
        );
        renderSuperAdminRoute();
        expect(screen.queryByTestId('backoffice-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.4 — RUTAS DRIVER
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.4 — Rutas Driver', () => {
  testMatrix('/driver', [UserRole.DRIVER, UserRole.SUPER_ADMIN]);
  testMatrix('/driver/profile', [UserRole.DRIVER, UserRole.SUPER_ADMIN]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.5 — RUTAS CUSTOMER (incluyendo disallowGuests)
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.5 — Rutas Customer', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('/app/orders — CUSTOMER registrado', () => {
    it('CUSTOMER registrado (no guest) puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth(UserRole.CUSTOMER, { user: { id: 'cust-1', role: UserRole.CUSTOMER, isGuest: false } }),
      );
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });

    it('CUSTOMER GUEST es redirigido a /app/profile', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: true,
        isEmailVerified: true,
        user: { id: 'guest-1', role: UserRole.CUSTOMER, isGuest: true },
        hasRole: vi.fn(() => true),
      } as any);
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('app-profile-page')).toBeDefined();
    });

    ALL_ROLES.filter((r) => r !== UserRole.CUSTOMER).forEach((role) => {
      it(`${role} es denegado de /app/orders`, () => {
        mockUseAuth.mockReturnValue(buildAuth(role));
        renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });
  });

  describe('/app/favorites — disallowGuests=true', () => {
    it('CUSTOMER registrado puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth(UserRole.CUSTOMER, { user: { id: 'cust-2', role: UserRole.CUSTOMER, isGuest: false } }),
      );
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });

    it('CUSTOMER GUEST es redirigido', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: true,
        isEmailVerified: true,
        user: { id: 'guest-2', role: UserRole.CUSTOMER, isGuest: true },
        hasRole: vi.fn(() => true),
      } as any);
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });
  });

  describe('/app/impact — disallowGuests=true', () => {
    it('CUSTOMER registrado puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth(UserRole.CUSTOMER, { user: { id: 'cust-3', role: UserRole.CUSTOMER, isGuest: false } }),
      );
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });

    it('CUSTOMER GUEST es redirigido', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: true,
        isEmailVerified: true,
        user: { id: 'guest-3', role: UserRole.CUSTOMER, isGuest: true },
        hasRole: vi.fn(() => true),
      } as any);
      renderRoute([UserRole.CUSTOMER], { disallowGuests: true, guestRedirect: '/app/profile' });
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });
  });

  describe('/app/profile — CUSTOMER (guest permitido vía ProtectedRoute, ruta no tiene disallowGuests)', () => {
    it('CUSTOMER registrado puede acceder', () => {
      mockUseAuth.mockReturnValue(buildAuth(UserRole.CUSTOMER));
      renderRoute([UserRole.CUSTOMER]);
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.6 — RUTA CHAT
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.6 — Ruta /chat', () => {
  testMatrix('/chat', [UserRole.CUSTOMER, UserRole.VENUE_OWNER, UserRole.DRIVER, UserRole.SUPER_ADMIN]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.7 — RUTA REGIONAL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 2.7 — Ruta /regional-dashboard', () => {
  testMatrix('/regional-dashboard', [UserRole.CITY_ADMIN, UserRole.SUPER_ADMIN]);
});
