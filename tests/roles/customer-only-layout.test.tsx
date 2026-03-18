/**
 * FASE 1.3 — CustomerOnlyLayout
 *
 * Verifica que el guard /app/* bloquea roles no-CUSTOMER y los redirige
 * a su destino correcto.
 * La lógica espejada de App.tsx (CustomerOnlyLayout, líneas 234-253).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { UserRole } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/customer/common/Loading', () => ({
  LoadingScreen: () => <div data-testid="loading-screen" />,
}));

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ─── Espejo de CustomerOnlyLayout (App.tsx:234-253) ──────────────────────────

const CustomerOnlyLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div data-testid="loading-screen" />;

  if (user && !user.isGuest) {
    switch (user.role) {
      case UserRole.VENUE_OWNER:
      case UserRole.KITCHEN_STAFF:
        return <Navigate to="/dashboard" replace />;
      case UserRole.DRIVER:
        return <Navigate to="/driver" replace />;
      case UserRole.SUPER_ADMIN:
      case UserRole.ADMIN:
        return <Navigate to="/backoffice/dashboard" replace />;
      default:
        break; // CUSTOMER → renderiza layout normal
    }
  }
  // Guest o CUSTOMER: renderiza contenido normalmente
  return (
    <div data-testid="customer-layout">
      <Outlet />
    </div>
  );
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderCustomerLayout(role: UserRole, isGuest = false) {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<CustomerOnlyLayout />}>
          <Route index element={<div data-testid="customer-home">Home</div>} />
        </Route>
        <Route path="/dashboard" element={<div data-testid="page-dashboard" />} />
        <Route path="/driver" element={<div data-testid="page-driver" />} />
        <Route path="/backoffice/dashboard" element={<div data-testid="page-backoffice" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FASE 1.3 — CustomerOnlyLayout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isLoading → muestra loading screen', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, user: null } as any);
    renderCustomerLayout(UserRole.CUSTOMER);
    expect(screen.getByTestId('loading-screen')).toBeDefined();
  });

  it('CUSTOMER registrado → renderiza layout normal', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'cust-1', role: UserRole.CUSTOMER, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.CUSTOMER);
    expect(screen.getByTestId('customer-layout')).toBeDefined();
    expect(screen.getByTestId('customer-home')).toBeDefined();
  });

  it('GUEST (isGuest=true) → renderiza layout normal', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'guest-1', role: UserRole.CUSTOMER, isGuest: true },
    } as any);
    renderCustomerLayout(UserRole.CUSTOMER, true);
    expect(screen.getByTestId('customer-layout')).toBeDefined();
  });

  it('sin usuario (null) → renderiza layout normal (permite auto-login de guest)', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, user: null } as any);
    renderCustomerLayout(UserRole.CUSTOMER);
    expect(screen.getByTestId('customer-layout')).toBeDefined();
  });

  it('VENUE_OWNER → redirige a /dashboard', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'vo-1', role: UserRole.VENUE_OWNER, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.VENUE_OWNER);
    expect(screen.queryByTestId('customer-layout')).toBeNull();
    expect(screen.getByTestId('page-dashboard')).toBeDefined();
  });

  it('KITCHEN_STAFF → redirige a /dashboard', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'ks-1', role: UserRole.KITCHEN_STAFF, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.KITCHEN_STAFF);
    expect(screen.queryByTestId('customer-layout')).toBeNull();
    expect(screen.getByTestId('page-dashboard')).toBeDefined();
  });

  it('DRIVER → redirige a /driver', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'drv-1', role: UserRole.DRIVER, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.DRIVER);
    expect(screen.queryByTestId('customer-layout')).toBeNull();
    expect(screen.getByTestId('page-driver')).toBeDefined();
  });

  it('SUPER_ADMIN → redirige a /backoffice/dashboard', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'sa-1', role: UserRole.SUPER_ADMIN, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.SUPER_ADMIN);
    expect(screen.queryByTestId('customer-layout')).toBeNull();
    expect(screen.getByTestId('page-backoffice')).toBeDefined();
  });

  it('ADMIN → redirige a /backoffice/dashboard', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      user: { id: 'admin-1', role: UserRole.ADMIN, isGuest: false },
    } as any);
    renderCustomerLayout(UserRole.ADMIN);
    expect(screen.queryByTestId('customer-layout')).toBeNull();
    expect(screen.getByTestId('page-backoffice')).toBeDefined();
  });
});
