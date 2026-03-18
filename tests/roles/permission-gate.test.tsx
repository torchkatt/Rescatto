/**
 * FASE 6 — PermissionGate y usePermissions
 *
 * 6.1 — Verifica que ROLE_PERMISSIONS mapea correctamente para cada rol.
 * 6.2 — Verifica que PermissionGate renderiza/oculta según requires/requiresAny/requiresAll/fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../../types';
import { PermissionGate } from '../../components/PermissionGate';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePermissions = vi.mocked(usePermissions);

// ─── Helper: usePermissions real logic para tests de ROLE_PERMISSIONS ─────────

/**
 * Simula la lógica real de usePermissions usando ROLE_PERMISSIONS del código.
 */
function buildPermissionsHook(role: UserRole) {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return {
    hasPermission: (p: Permission) => permissions.includes(p),
    hasAnyPermission: (ps: Permission[]) => ps.some((p) => permissions.includes(p)),
    hasAllPermissions: (ps: Permission[]) => ps.every((p) => permissions.includes(p)),
    getUserPermissions: () => permissions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.1 — ROLE_PERMISSIONS correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 6.1 — ROLE_PERMISSIONS por rol', () => {
  describe('SUPER_ADMIN tiene TODOS los permisos', () => {
    const hook = buildPermissionsHook(UserRole.SUPER_ADMIN);
    Object.values(Permission).forEach((p) => {
      it(`tiene ${p}`, () => {
        expect(hook.hasPermission(p)).toBe(true);
      });
    });
  });

  describe('ADMIN', () => {
    const hook = buildPermissionsHook(UserRole.ADMIN);

    it('tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(true));
    it('tiene CREATE_USERS', () => expect(hook.hasPermission(Permission.CREATE_USERS)).toBe(true));
    it('tiene EDIT_USERS', () => expect(hook.hasPermission(Permission.EDIT_USERS)).toBe(true));
    it('tiene DELETE_USERS', () => expect(hook.hasPermission(Permission.DELETE_USERS)).toBe(true));
    it('tiene VIEW_VENUES', () => expect(hook.hasPermission(Permission.VIEW_VENUES)).toBe(true));
    it('tiene VIEW_ANALYTICS', () => expect(hook.hasPermission(Permission.VIEW_ANALYTICS)).toBe(true));
    it('NO tiene MANAGE_PLATFORM_SETTINGS', () =>
      expect(hook.hasPermission(Permission.MANAGE_PLATFORM_SETTINGS)).toBe(false));
    it('NO tiene VIEW_DELIVERIES', () =>
      expect(hook.hasPermission(Permission.VIEW_DELIVERIES)).toBe(false));
  });

  describe('VENUE_OWNER', () => {
    const hook = buildPermissionsHook(UserRole.VENUE_OWNER);

    it('tiene EDIT_OWN_VENUE', () => expect(hook.hasPermission(Permission.EDIT_OWN_VENUE)).toBe(true));
    it('tiene CREATE_PRODUCTS', () => expect(hook.hasPermission(Permission.CREATE_PRODUCTS)).toBe(true));
    it('tiene VIEW_ORDERS', () => expect(hook.hasPermission(Permission.VIEW_ORDERS)).toBe(true));
    it('tiene MANAGE_ORDERS', () => expect(hook.hasPermission(Permission.MANAGE_ORDERS)).toBe(true));
    it('tiene VIEW_ANALYTICS', () => expect(hook.hasPermission(Permission.VIEW_ANALYTICS)).toBe(true));
    it('tiene MANAGE_SETTINGS', () => expect(hook.hasPermission(Permission.MANAGE_SETTINGS)).toBe(true));
    it('NO tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(false));
    it('NO tiene CREATE_VENUES', () => expect(hook.hasPermission(Permission.CREATE_VENUES)).toBe(false));
  });

  describe('KITCHEN_STAFF', () => {
    const hook = buildPermissionsHook(UserRole.KITCHEN_STAFF);

    it('tiene VIEW_ORDERS', () => expect(hook.hasPermission(Permission.VIEW_ORDERS)).toBe(true));
    it('tiene MANAGE_ORDERS', () => expect(hook.hasPermission(Permission.MANAGE_ORDERS)).toBe(true));
    it('tiene VIEW_PRODUCTS', () => expect(hook.hasPermission(Permission.VIEW_PRODUCTS)).toBe(true));
    it('NO tiene CREATE_PRODUCTS', () => expect(hook.hasPermission(Permission.CREATE_PRODUCTS)).toBe(false));
    it('NO tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(false));
    it('NO tiene VIEW_ANALYTICS', () => expect(hook.hasPermission(Permission.VIEW_ANALYTICS)).toBe(false));
  });

  describe('DRIVER', () => {
    const hook = buildPermissionsHook(UserRole.DRIVER);

    it('tiene VIEW_DELIVERIES', () => expect(hook.hasPermission(Permission.VIEW_DELIVERIES)).toBe(true));
    it('tiene ACCEPT_DELIVERIES', () => expect(hook.hasPermission(Permission.ACCEPT_DELIVERIES)).toBe(true));
    it('tiene MANAGE_DELIVERIES', () => expect(hook.hasPermission(Permission.MANAGE_DELIVERIES)).toBe(true));
    it('tiene VIEW_ORDERS', () => expect(hook.hasPermission(Permission.VIEW_ORDERS)).toBe(true));
    it('NO tiene CREATE_ORDERS', () => expect(hook.hasPermission(Permission.CREATE_ORDERS)).toBe(false));
    it('NO tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(false));
  });

  describe('CUSTOMER', () => {
    const hook = buildPermissionsHook(UserRole.CUSTOMER);

    it('tiene CREATE_ORDERS', () => expect(hook.hasPermission(Permission.CREATE_ORDERS)).toBe(true));
    it('tiene VIEW_ORDERS', () => expect(hook.hasPermission(Permission.VIEW_ORDERS)).toBe(true));
    it('tiene VIEW_PRODUCTS', () => expect(hook.hasPermission(Permission.VIEW_PRODUCTS)).toBe(true));
    it('NO tiene MANAGE_ORDERS', () => expect(hook.hasPermission(Permission.MANAGE_ORDERS)).toBe(false));
    it('NO tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(false));
    it('NO tiene VIEW_ANALYTICS', () => expect(hook.hasPermission(Permission.VIEW_ANALYTICS)).toBe(false));
  });

  describe('CITY_ADMIN', () => {
    const hook = buildPermissionsHook(UserRole.CITY_ADMIN);

    it('tiene VIEW_USERS', () => expect(hook.hasPermission(Permission.VIEW_USERS)).toBe(true));
    it('tiene VIEW_VENUES', () => expect(hook.hasPermission(Permission.VIEW_VENUES)).toBe(true));
    it('tiene VIEW_ANALYTICS', () => expect(hook.hasPermission(Permission.VIEW_ANALYTICS)).toBe(true));
    it('tiene EXPORT_REPORTS', () => expect(hook.hasPermission(Permission.EXPORT_REPORTS)).toBe(true));
    it('NO tiene CREATE_USERS', () => expect(hook.hasPermission(Permission.CREATE_USERS)).toBe(false));
    it('NO tiene MANAGE_PLATFORM_SETTINGS', () =>
      expect(hook.hasPermission(Permission.MANAGE_PLATFORM_SETTINGS)).toBe(false));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.2 — PermissionGate component
// ─────────────────────────────────────────────────────────────────────────────

describe('FASE 6.2 — PermissionGate component', () => {
  beforeEach(() => vi.clearAllMocks());

  const Child = () => <div data-testid="gate-content">Contenido</div>;
  const Fallback = () => <div data-testid="gate-fallback">Sin permiso</div>;

  describe('prop: requires (permiso único)', () => {
    it('renderiza children cuando el usuario TIENE el permiso', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => true),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requires={Permission.VIEW_ORDERS}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.getByTestId('gate-content')).toBeDefined();
    });

    it('no renderiza nada cuando el usuario NO TIENE el permiso (sin fallback)', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requires={Permission.DELETE_USERS}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
    });

    it('renderiza fallback cuando el usuario NO TIENE el permiso', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requires={Permission.DELETE_USERS} fallback={<Fallback />}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
      expect(screen.getByTestId('gate-fallback')).toBeDefined();
    });
  });

  describe('prop: requiresAny', () => {
    it('renderiza children cuando el usuario tiene AL MENOS UNO de los permisos', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => true),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requiresAny={[Permission.EDIT_PRODUCTS, Permission.DELETE_PRODUCTS]}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.getByTestId('gate-content')).toBeDefined();
    });

    it('no renderiza cuando el usuario NO TIENE NINGUNO de los permisos', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requiresAny={[Permission.CREATE_VENUES, Permission.DELETE_VENUES]}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
    });
  });

  describe('prop: requiresAll', () => {
    it('renderiza children cuando el usuario tiene TODOS los permisos', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => true),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requiresAll={[Permission.VIEW_ORDERS, Permission.MANAGE_ORDERS]}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.getByTestId('gate-content')).toBeDefined();
    });

    it('no renderiza cuando el usuario falta ALGUNO de los permisos', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate requiresAll={[Permission.VIEW_ORDERS, Permission.DELETE_USERS]}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
    });
  });

  describe('sin props de permiso especificadas', () => {
    it('deniega acceso por defecto (hasAccess=false)', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
    });

    it('muestra fallback cuando se proporciona y no hay permisos configurados', () => {
      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate fallback={<Fallback />}>
          <Child />
        </PermissionGate>,
      );
      expect(screen.queryByTestId('gate-content')).toBeNull();
      expect(screen.getByTestId('gate-fallback')).toBeDefined();
    });
  });

  describe('precedencia de props (requires > requiresAny > requiresAll)', () => {
    it('usa requires cuando se especifica junto con requiresAny', () => {
      const hasPermission = vi.fn(() => true); // requires → true
      const hasAnyPermission = vi.fn(() => false);

      mockUsePermissions.mockReturnValue({
        hasPermission,
        hasAnyPermission,
        hasAllPermissions: vi.fn(() => false),
        getUserPermissions: vi.fn(() => []),
      });

      render(
        <PermissionGate
          requires={Permission.VIEW_ORDERS}
          requiresAny={[Permission.DELETE_USERS]}
        >
          <Child />
        </PermissionGate>,
      );
      // requires tiene prioridad, hasPermission fue llamado
      expect(hasPermission).toHaveBeenCalled();
      expect(screen.getByTestId('gate-content')).toBeDefined();
    });
  });
});
