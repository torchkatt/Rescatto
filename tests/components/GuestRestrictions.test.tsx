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

const ProtectedContent = () => <div data-testid="protected-content">Contenido protegido</div>;
const LoginPage = () => <div data-testid="login-page">Login</div>;
const ProfilePage = () => <div data-testid="profile-page">Perfil</div>;

/**
 * Helper: renders a ProtectedRoute inside a MemoryRouter with a catch-all
 * route structure so we can detect redirects via data-testid.
 */
const renderProtectedRoute = (
  initialPath: string,
  disallowGuests: boolean,
  guestRedirect?: string
) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path={initialPath}
          element={
            <ProtectedRoute
              allowedRoles={[UserRole.CUSTOMER]}
              disallowGuests={disallowGuests}
              guestRedirect={guestRedirect}
            >
              <ProtectedContent />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/profile" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
};

// ── Guest user fixture ──
const guestUser = {
  id: 'guest-abc123',
  role: UserRole.CUSTOMER,
  isGuest: true,
};

// ── Authenticated CUSTOMER fixture ──
const realCustomer = {
  id: 'user-real-1',
  role: UserRole.CUSTOMER,
  isGuest: false,
};

const baseAuthLoaded = {
  isLoading: false,
  isAuthenticated: true,
  isEmailVerified: true,
  isAccountVerified: true,
  hasRole: vi.fn(() => true),
};

describe('GuestRestrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Routes that BLOCK guests ──

  describe('routes that block guest users (disallowGuests=true)', () => {
    it('blocks guest from /app/orders and redirects to /app/profile', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: guestUser,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/orders', true, '/app/profile');

      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('profile-page')).toBeDefined();
    });

    it('blocks guest from /app/favorites and redirects to /app/profile', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: guestUser,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/favorites', true, '/app/profile');

      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('profile-page')).toBeDefined();
    });

    it('blocks guest from /app/impact and redirects to /app/profile', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: guestUser,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/impact', true, '/app/profile');

      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('profile-page')).toBeDefined();
    });

    it('blocks guest from /app/profile when disallowGuests is true and defaults redirect to /login', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: guestUser,
        hasRole: vi.fn(() => true),
      } as any);

      // Without guestRedirect, defaults to /login
      renderProtectedRoute('/app/profile', true);

      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('login-page')).toBeDefined();
    });
  });

  // ── Non-guest CUSTOMER can access protected route ──

  describe('non-guest CUSTOMER access', () => {
    it('allows non-guest CUSTOMER to access /app/orders', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: realCustomer,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/orders', true, '/app/profile');

      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(screen.queryByTestId('profile-page')).toBeNull();
      expect(screen.queryByTestId('login-page')).toBeNull();
    });
  });

  // ── Audit logging when guest is blocked ──

  describe('audit event on guest block', () => {
    it('logs UNAUTHORIZED_ACCESS audit event when guest is blocked', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: guestUser,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/orders', true, '/app/profile');

      expect(mockLogEvent).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledWith({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        performedBy: guestUser.id,
        userRole: guestUser.role,
        details: {
          reason: 'GUEST_FORBIDDEN',
          path: expect.any(String),
        },
      });
    });

    it('does NOT log audit event when non-guest accesses the same route', () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthLoaded,
        user: realCustomer,
        hasRole: vi.fn(() => true),
      } as any);

      renderProtectedRoute('/app/orders', true, '/app/profile');

      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });
});
