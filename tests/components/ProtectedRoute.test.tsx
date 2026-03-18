import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import { UserRole } from '../../types';

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock Loading component
vi.mock('../../components/customer/common/Loading', () => ({
  LoadingScreen: ({ message }: { message?: string }) => (
    <div data-testid="loading-screen">{message || 'Loading...'}</div>
  ),
}));

// Mock auditService
vi.mock('../../services/auditService', () => ({
  auditService: {
    logEvent: vi.fn(),
  },
  AuditAction: {
    UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  },
}));

import { useAuth } from '../../context/AuthContext';
import { auditService, AuditAction } from '../../services/auditService';

const mockUseAuth = vi.mocked(useAuth);
const mockLogEvent = vi.mocked(auditService.logEvent);

const TestChild = () => <div data-testid="protected-content">Contenido protegido</div>;

/**
 * Helper: builds a mock return value for useAuth with realistic hasRole behavior.
 * hasRole returns true if user.role is included in the provided allowedRoles array.
 */
function buildAuthMock(overrides: {
  isLoading?: boolean;
  isAuthenticated?: boolean;
  user?: { id: string; role: UserRole; isGuest?: boolean } | null;
  isEmailVerified?: boolean;
  isAccountVerified?: boolean;
}) {
  const {
    isLoading = false,
    isAuthenticated = false,
    user = null,
    isEmailVerified = false,
    isAccountVerified = false,
  } = overrides;

  return {
    isLoading,
    isAuthenticated,
    user,
    isEmailVerified,
    isAccountVerified,
    hasRole: vi.fn((roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    }),
  } as any;
}

/**
 * Renders a ProtectedRoute inside a MemoryRouter with catch-all routes
 * so we can detect Navigate redirects by checking which route rendered.
 */
function renderProtectedRoute(
  props: {
    allowedRoles?: UserRole[];
    disallowGuests?: boolean;
    guestRedirect?: string;
  } = {},
  initialPath = '/protected'
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute
              allowedRoles={props.allowedRoles}
              disallowGuests={props.disallowGuests}
              guestRedirect={props.guestRedirect}
            >
              <TestChild />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/verify-email" element={<div data-testid="verify-email-page">Verificar email</div>} />
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
        <Route path="/register" element={<div data-testid="register-page">Registro</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────
  // 1. Loading state
  // ─────────────────────────────────────────────────────
  describe('Loading state', () => {
    it('shows LoadingScreen while auth is loading', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isLoading: true }));

      renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

      expect(screen.getByTestId('loading-screen')).toBeDefined();
      expect(screen.getByText('Verificando acceso...')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('does not render children or redirect while loading', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isLoading: true }));

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.queryByTestId('login-page')).toBeNull();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
      expect(screen.queryByTestId('home-page')).toBeNull();
    });

    it('does not log audit events while loading', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isLoading: true }));

      renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. Unauthenticated redirects
  // ─────────────────────────────────────────────────────
  describe('Unauthenticated redirects', () => {
    it('redirects to /login when not authenticated (no roles specified)', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isAuthenticated: false }));

      renderProtectedRoute();

      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('redirects to /login when not authenticated (with roles specified)', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isAuthenticated: false }));

      renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('does not log audit events for unauthenticated users', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isAuthenticated: false }));

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. Guest restrictions (disallowGuests)
  // ─────────────────────────────────────────────────────
  describe('Guest restrictions', () => {
    it('redirects guest user to /login when disallowGuests=true', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-1', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('redirects guest user to custom guestRedirect path', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-2', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: true, guestRedirect: '/register' });

      expect(screen.getByTestId('register-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('logs audit event when guest is blocked', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-3', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      expect(mockLogEvent).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledWith({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        performedBy: 'guest-3',
        userRole: UserRole.CUSTOMER,
        details: { reason: 'GUEST_FORBIDDEN', path: expect.any(String) },
      });
    });

    it('allows non-guest user when disallowGuests=true', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'user-1', role: UserRole.CUSTOMER, isGuest: false },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('allows guest user when disallowGuests is not set', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-4', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute();

      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('allows guest user when disallowGuests=false', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-5', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: false });

      expect(screen.getByTestId('protected-content')).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. Account verification redirect
  // ─────────────────────────────────────────────────────
  describe('Account verification redirect', () => {
    it('redirects to /verify-email when account is not verified', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'user-1', role: UserRole.CUSTOMER },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

      expect(screen.getByTestId('verify-email-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('redirects to /verify-email regardless of role when unverified', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN] });

      expect(screen.getByTestId('verify-email-page')).toBeDefined();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('does not log audit event for unverified account redirect', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'user-2', role: UserRole.VENUE_OWNER },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('verification check happens after guest check', () => {
      // Guest + unverified: guest check should trigger first
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-unverified', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      // Should hit guest block first, redirect to /login (not /verify-email)
      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. Role-based access for each of the 7 roles
  // ─────────────────────────────────────────────────────
  describe('Role-based access', () => {
    // --- SUPER_ADMIN ---
    describe('SUPER_ADMIN', () => {
      it('can access routes with allowedRoles=[SUPER_ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'sa-1', role: UserRole.SUPER_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('can access routes with allowedRoles=[SUPER_ADMIN, ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'sa-2', role: UserRole.SUPER_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from routes with allowedRoles=[CUSTOMER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'sa-3', role: UserRole.SUPER_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });
    });

    // --- ADMIN ---
    describe('ADMIN', () => {
      it('can access routes with allowedRoles=[ADMIN, SUPER_ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'admin-1', role: UserRole.ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('can access routes with allowedRoles=[ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'admin-2', role: UserRole.ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from routes with allowedRoles=[VENUE_OWNER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'admin-3', role: UserRole.ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from driver-only routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'admin-4', role: UserRole.ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.DRIVER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });
    });

    // --- CITY_ADMIN ---
    describe('CITY_ADMIN', () => {
      it('can access regional dashboard with allowedRoles=[CITY_ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ca-1', role: UserRole.CITY_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.CITY_ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('can access routes shared with ADMIN and CITY_ADMIN', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ca-2', role: UserRole.CITY_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.ADMIN, UserRole.CITY_ADMIN, UserRole.SUPER_ADMIN] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from SUPER_ADMIN-only routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ca-3', role: UserRole.CITY_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from VENUE_OWNER routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ca-4', role: UserRole.CITY_ADMIN },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });

    // --- VENUE_OWNER ---
    describe('VENUE_OWNER', () => {
      it('can access business routes with allowedRoles=[VENUE_OWNER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'vo-1', role: UserRole.VENUE_OWNER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('can access routes shared with VENUE_OWNER and KITCHEN_STAFF', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'vo-2', role: UserRole.VENUE_OWNER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from admin routes with allowedRoles=[ADMIN, SUPER_ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'vo-3', role: UserRole.VENUE_OWNER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from customer-only routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'vo-4', role: UserRole.VENUE_OWNER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });

    // --- KITCHEN_STAFF ---
    describe('KITCHEN_STAFF', () => {
      it('can access order routes with allowedRoles=[KITCHEN_STAFF]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ks-1', role: UserRole.KITCHEN_STAFF },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.KITCHEN_STAFF] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('can access routes shared with VENUE_OWNER and KITCHEN_STAFF', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ks-2', role: UserRole.KITCHEN_STAFF },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from admin routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ks-3', role: UserRole.KITCHEN_STAFF },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from VENUE_OWNER-only routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ks-4', role: UserRole.KITCHEN_STAFF },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });

      it('is blocked from driver routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'ks-5', role: UserRole.KITCHEN_STAFF },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.DRIVER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });

    // --- DRIVER ---
    describe('DRIVER', () => {
      it('can access driver routes with allowedRoles=[DRIVER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'drv-1', role: UserRole.DRIVER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.DRIVER] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from business routes with allowedRoles=[VENUE_OWNER, KITCHEN_STAFF]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'drv-2', role: UserRole.DRIVER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from admin routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'drv-3', role: UserRole.DRIVER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });

      it('is blocked from customer-only routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'drv-4', role: UserRole.DRIVER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });

    // --- CUSTOMER ---
    describe('CUSTOMER', () => {
      it('can access customer routes with allowedRoles=[CUSTOMER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'cust-1', role: UserRole.CUSTOMER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });

      it('is blocked from business routes with allowedRoles=[VENUE_OWNER]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'cust-2', role: UserRole.CUSTOMER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('home-page')).toBeDefined();
      });

      it('is blocked from admin routes with allowedRoles=[SUPER_ADMIN, ADMIN]', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'cust-3', role: UserRole.CUSTOMER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });

      it('is blocked from driver routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'cust-4', role: UserRole.CUSTOMER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.DRIVER] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });

      it('is blocked from kitchen staff routes', () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: 'cust-5', role: UserRole.CUSTOMER },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute({ allowedRoles: [UserRole.KITCHEN_STAFF] });

        expect(screen.queryByTestId('protected-content')).toBeNull();
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // 6. No allowedRoles = any authenticated user
  // ─────────────────────────────────────────────────────
  describe('No allowedRoles (any authenticated user)', () => {
    const allRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.CITY_ADMIN,
      UserRole.VENUE_OWNER,
      UserRole.KITCHEN_STAFF,
      UserRole.DRIVER,
      UserRole.CUSTOMER,
    ];

    allRoles.forEach((role) => {
      it(`renders children for ${role} when no allowedRoles specified`, () => {
        mockUseAuth.mockReturnValue(
          buildAuthMock({
            isAuthenticated: true,
            user: { id: `any-${role}`, role },
            isAccountVerified: true,
          })
        );

        renderProtectedRoute();

        expect(screen.getByTestId('protected-content')).toBeDefined();
      });
    });

    it('does not call hasRole when no allowedRoles specified', () => {
      const authMock = buildAuthMock({
        isAuthenticated: true,
        user: { id: 'user-no-role-check', role: UserRole.CUSTOMER },
        isAccountVerified: true,
      });
      mockUseAuth.mockReturnValue(authMock);

      renderProtectedRoute();

      expect(authMock.hasRole).not.toHaveBeenCalled();
    });

    it('does not log audit events when no allowedRoles specified', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'user-no-audit', role: UserRole.DRIVER },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute();

      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────
  // 7. Audit logging on unauthorized access
  // ─────────────────────────────────────────────────────
  describe('Audit logging on unauthorized access', () => {
    it('logs INSUFFICIENT_ROLE when user lacks required role', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'audit-1', role: UserRole.CUSTOMER },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] });

      expect(mockLogEvent).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledWith({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        performedBy: 'audit-1',
        userRole: UserRole.CUSTOMER,
        details: {
          reason: 'INSUFFICIENT_ROLE',
          allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          path: expect.any(String),
        },
      });
    });

    it('logs GUEST_FORBIDDEN when guest is blocked', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'audit-guest', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      expect(mockLogEvent).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledWith({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        performedBy: 'audit-guest',
        userRole: UserRole.CUSTOMER,
        details: {
          reason: 'GUEST_FORBIDDEN',
          path: expect.any(String),
        },
      });
    });

    it('includes user role in audit log for DRIVER blocked from admin route', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'drv-audit', role: UserRole.DRIVER },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.SUPER_ADMIN] });

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          performedBy: 'drv-audit',
          userRole: UserRole.DRIVER,
        })
      );
    });

    it('includes the allowedRoles array in the audit details', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'vo-audit', role: UserRole.VENUE_OWNER },
          isAccountVerified: true,
        })
      );

      const targetRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CITY_ADMIN];
      renderProtectedRoute({ allowedRoles: targetRoles });

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            allowedRoles: targetRoles,
          }),
        })
      );
    });

    it('does not log audit when user has the required role', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'allowed-user', role: UserRole.ADMIN },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('does not log audit for unauthenticated redirect', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isAuthenticated: false }));

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('does not log audit for unverified account redirect', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'unverified', role: UserRole.CUSTOMER },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.CUSTOMER] });

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('logs audit for each role that attempts unauthorized access', () => {
      // KITCHEN_STAFF trying to access VENUE_OWNER-only route
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'ks-audit', role: UserRole.KITCHEN_STAFF },
          isAccountVerified: true,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.VENUE_OWNER] });

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          performedBy: 'ks-audit',
          userRole: UserRole.KITCHEN_STAFF,
          details: expect.objectContaining({
            reason: 'INSUFFICIENT_ROLE',
            allowedRoles: [UserRole.VENUE_OWNER],
          }),
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // Edge cases: priority of checks
  // ─────────────────────────────────────────────────────
  describe('Check priority order', () => {
    it('loading takes priority over everything', () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        isEmailVerified: false,
        isAccountVerified: false,
        hasRole: vi.fn(() => false),
      } as any);

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN], disallowGuests: true });

      expect(screen.getByTestId('loading-screen')).toBeDefined();
      expect(screen.queryByTestId('login-page')).toBeNull();
      expect(screen.queryByTestId('home-page')).toBeNull();
    });

    it('authentication check comes before guest check', () => {
      mockUseAuth.mockReturnValue(buildAuthMock({ isAuthenticated: false }));

      renderProtectedRoute({ disallowGuests: true });

      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('guest check comes before verification check', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'guest-unverified', role: UserRole.CUSTOMER, isGuest: true },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ disallowGuests: true });

      expect(screen.getByTestId('login-page')).toBeDefined();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
    });

    it('verification check comes before role check', () => {
      mockUseAuth.mockReturnValue(
        buildAuthMock({
          isAuthenticated: true,
          user: { id: 'unverified-wrong-role', role: UserRole.CUSTOMER },
          isAccountVerified: false,
        })
      );

      renderProtectedRoute({ allowedRoles: [UserRole.ADMIN] });

      // Should redirect to verify-email, not home (role check)
      expect(screen.getByTestId('verify-email-page')).toBeDefined();
      expect(screen.queryByTestId('home-page')).toBeNull();
      // Should not log audit since verification check fires first
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });
});
