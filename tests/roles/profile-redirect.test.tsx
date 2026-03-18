/**
 * FASE 1.2 — ProfileRedirect
 *
 * Verifica que /profile redirige al perfil correcto según el rol del usuario.
 * La lógica espejada de App.tsx (ProfileRedirect, líneas 256-275).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

// ─── Espejo de ProfileRedirect (App.tsx:256-275) ─────────────────────────────

const ProfileRedirect: React.FC = () => {
  const { user } = useAuth();

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
      return <Navigate to="/regional-dashboard/profile" replace />;
    default:
      // VENUE_OWNER, KITCHEN_STAFF
      return <Navigate to="/dashboard/profile" replace />;
  }
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderProfileRedirect() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/app/profile" element={<div data-testid="app-profile" />} />
        <Route path="/driver/profile" element={<div data-testid="driver-profile" />} />
        <Route path="/admin/profile" element={<div data-testid="admin-profile" />} />
        <Route path="/regional-dashboard/profile" element={<div data-testid="regional-profile" />} />
        <Route path="/dashboard/profile" element={<div data-testid="dashboard-profile" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function buildUser(role: UserRole, isGuest = false) {
  return { id: `${role}-1`, role, isGuest };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FASE 1.2 — ProfileRedirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin usuario → redirige a /app/profile', () => {
    mockUseAuth.mockReturnValue({ user: null } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('app-profile')).toBeDefined();
  });

  it('usuario GUEST → redirige a /app/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.CUSTOMER, true) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('app-profile')).toBeDefined();
  });

  it('CUSTOMER → redirige a /app/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.CUSTOMER) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('app-profile')).toBeDefined();
  });

  it('DRIVER → redirige a /driver/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.DRIVER) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('driver-profile')).toBeDefined();
  });

  it('SUPER_ADMIN → redirige a /admin/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.SUPER_ADMIN) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('admin-profile')).toBeDefined();
  });

  it('ADMIN → redirige a /admin/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.ADMIN) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('admin-profile')).toBeDefined();
  });

  it('CITY_ADMIN → redirige a /regional-dashboard/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.CITY_ADMIN) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('regional-profile')).toBeDefined();
  });

  it('VENUE_OWNER → redirige a /dashboard/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.VENUE_OWNER) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('dashboard-profile')).toBeDefined();
  });

  it('KITCHEN_STAFF → redirige a /dashboard/profile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser(UserRole.KITCHEN_STAFF) } as any);
    renderProfileRedirect();
    expect(screen.getByTestId('dashboard-profile')).toBeDefined();
  });
});
