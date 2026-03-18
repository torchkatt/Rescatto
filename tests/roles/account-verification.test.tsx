/**
 * FASE 7 — Verificación de Cuenta (isAccountVerified)
 *
 * Verifica los bypass y la lógica de redirección a /verify-email
 * para diferentes estados de cuenta, usando ProtectedRoute que llama
 * a isAccountVerified desde el contexto.
 *
 * Lógica real (AuthContext.tsx:323-329):
 *   isAccountVerified =
 *     user.role === SUPER_ADMIN ||
 *     email @test.com ||
 *     auth.currentUser?.isAnonymous ||
 *     (emailVerified && (role===CUSTOMER || isVerified===true))
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildAuth(opts: {
  role: UserRole;
  isAccountVerified: boolean;
  isGuest?: boolean;
  email?: string;
}) {
  return {
    isLoading: false,
    isAuthenticated: true,
    isEmailVerified: opts.isAccountVerified,
    isAccountVerified: opts.isAccountVerified,
    user: {
      id: `${opts.role}-1`,
      role: opts.role,
      isGuest: opts.isGuest ?? false,
      email: opts.email ?? `${opts.role.toLowerCase()}@example.com`,
    },
    hasRole: vi.fn((roles: UserRole[]) => roles.includes(opts.role)),
  } as any;
}

function renderWithProtectedRoute(allowedRoles: UserRole[]) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div data-testid="protected-content">Contenido</div>
            </ProtectedRoute>
          }
        />
        <Route path="/verify-email" element={<div data-testid="verify-email-page" />} />
        <Route path="/" element={<div data-testid="home-page" />} />
        <Route path="/login" element={<div data-testid="login-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FASE 7 — Verificación de Cuenta (isAccountVerified)', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Bypass: siempre verificado ───────────────────────────────────────────

  describe('Bypass: siempre verificado', () => {
    it('SUPER_ADMIN → isAccountVerified=true → puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({ role: UserRole.SUPER_ADMIN, isAccountVerified: true }),
      );
      renderWithProtectedRoute([UserRole.SUPER_ADMIN]);
      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
    });

    it('Email @test.com → isAccountVerified=true → puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({
          role: UserRole.CUSTOMER,
          isAccountVerified: true,
          email: 'developer@test.com',
        }),
      );
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
    });

    it('Guest (isAnonymous) → isAccountVerified=true → puede acceder', () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: true,
        isEmailVerified: false,
        user: { id: 'guest-1', role: UserRole.CUSTOMER, isGuest: true },
        hasRole: vi.fn(() => true),
      } as any);
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      expect(screen.getByTestId('protected-content')).toBeDefined();
      expect(screen.queryByTestId('verify-email-page')).toBeNull();
    });
  });

  // ── CUSTOMER verificado ──────────────────────────────────────────────────

  describe('CUSTOMER verificado', () => {
    it('email verificado + isVerified en Firestore → isAccountVerified=true → puede acceder', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({ role: UserRole.CUSTOMER, isAccountVerified: true }),
      );
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });
  });

  // ── CUSTOMER no verificado ───────────────────────────────────────────────

  describe('CUSTOMER no verificado → redirige a /verify-email', () => {
    it('email NO verificado → isAccountVerified=false → redirige a /verify-email', () => {
      mockUseAuth.mockReturnValue(
        buildAuth({ role: UserRole.CUSTOMER, isAccountVerified: false }),
      );
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('verify-email-page')).toBeDefined();
    });

    it('email verificado pero isVerified=false en Firestore → isAccountVerified=false → redirige', () => {
      // Simulamos isAccountVerified=false incluso si el email está verificado
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: false,
        isEmailVerified: true, // email verificado en Firebase
        user: {
          id: 'cust-2',
          role: UserRole.CUSTOMER,
          isGuest: false,
          isVerified: false, // pero NO verificado en Firestore
        },
        hasRole: vi.fn((roles: UserRole[]) => roles.includes(UserRole.CUSTOMER)),
      } as any);
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      expect(screen.queryByTestId('protected-content')).toBeNull();
      expect(screen.getByTestId('verify-email-page')).toBeDefined();
    });
  });

  // ── Otros roles no verificados ────────────────────────────────────────────

  describe('Roles no-CUSTOMER con isAccountVerified=false', () => {
    [UserRole.VENUE_OWNER, UserRole.KITCHEN_STAFF, UserRole.DRIVER, UserRole.ADMIN].forEach((role) => {
      it(`${role} no verificado → redirige a /verify-email`, () => {
        mockUseAuth.mockReturnValue(
          buildAuth({ role, isAccountVerified: false }),
        );
        // Protegemos con el rol del usuario para que la verificación sea la única barrera
        renderWithProtectedRoute([role]);
        expect(screen.queryByTestId('protected-content')).toBeNull();
        expect(screen.getByTestId('verify-email-page')).toBeDefined();
      });
    });
  });

  // ── Orden de verificaciones: guest → account → role ──────────────────────

  describe('Orden de prioridad de checks', () => {
    it('guest + isAccountVerified=false → ProtectedRoute deja pasar isAccountVerified primero (guest no usa disallowGuests aquí)', () => {
      // Sin disallowGuests, un guest con cuenta no verificada va a /verify-email
      mockUseAuth.mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        isAccountVerified: false,
        isEmailVerified: false,
        user: { id: 'guest-unverified', role: UserRole.CUSTOMER, isGuest: true },
        hasRole: vi.fn(() => true),
      } as any);
      renderWithProtectedRoute([UserRole.CUSTOMER]);
      // Sin disallowGuests: pasa el check de guest, luego falla verificación
      expect(screen.getByTestId('verify-email-page')).toBeDefined();
    });

    it('isAccountVerified check ocurre antes que role check', () => {
      // CUSTOMER no verificado intentando ruta de ADMIN → debe ir a /verify-email, no a /
      mockUseAuth.mockReturnValue(
        buildAuth({ role: UserRole.CUSTOMER, isAccountVerified: false }),
      );
      renderWithProtectedRoute([UserRole.ADMIN]); // CUSTOMER no es ADMIN
      // La verificación se ejecuta ANTES del check de rol
      expect(screen.getByTestId('verify-email-page')).toBeDefined();
      expect(screen.queryByTestId('home-page')).toBeNull();
    });
  });
});
