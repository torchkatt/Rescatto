import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

const TestChild = () => <div data-testid="protected-content">Contenido protegido</div>;

const renderWithRouter = (ui: React.ReactElement, { path = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  it('should show loading screen when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      isEmailVerified: false,
      isAccountVerified: false,
      hasRole: vi.fn(),
    } as any);

    renderWithRouter(
      <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER]}>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('loading-screen')).toBeDefined();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should redirect to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      isEmailVerified: false,
      isAccountVerified: false,
      hasRole: vi.fn(() => false),
    } as any);

    const { container } = renderWithRouter(
      <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER]}>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should redirect to /verify-email when account is not verified', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'user-1', role: UserRole.CUSTOMER },
      isEmailVerified: false,
      isAccountVerified: false,
      hasRole: vi.fn(() => true),
    } as any);

    renderWithRouter(
      <ProtectedRoute allowedRoles={[UserRole.CUSTOMER]}>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should render children when authenticated, verified, and has correct role', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'user-1', role: UserRole.VENUE_OWNER },
      isEmailVerified: true,
      isAccountVerified: true,
      hasRole: vi.fn(() => true),
    } as any);

    renderWithRouter(
      <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER]}>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeDefined();
  });

  it('should redirect to / when user does not have required role', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'user-1', role: UserRole.CUSTOMER },
      isEmailVerified: true,
      isAccountVerified: true,
      hasRole: vi.fn(() => false),
    } as any);

    renderWithRouter(
      <ProtectedRoute allowedRoles={[UserRole.VENUE_OWNER]}>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('should render children when no allowedRoles specified (any authenticated user)', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'user-1', role: UserRole.CUSTOMER },
      isEmailVerified: true,
      isAccountVerified: true,
      hasRole: vi.fn(() => true),
    } as any);

    renderWithRouter(
      <ProtectedRoute>
        <TestChild />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeDefined();
  });
});
