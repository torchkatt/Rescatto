/**
 * FASE 3.2 — Sidebar Customer (DesktopSidebar)
 *
 * Verifica que el sidebar de la app de cliente muestra/oculta elementos
 * correctamente para CUSTOMER registrado vs GUEST anónimo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

import { useAuth } from '../../../context/AuthContext';
import { DesktopSidebar } from '../../components/customer/layout/DesktopSidebar';

// Necesitamos importar desde la ruta correcta
import { useAuth as useAuthImport } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuthImport);

// ─── Helper ───────────────────────────────────────────────────────────────────

const onOpenImpact = vi.fn();

function renderDesktopSidebar(isGuest: boolean) {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <DesktopSidebar onOpenImpact={onOpenImpact} />
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FASE 3.2 — DesktopSidebar Customer vs Guest', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('CUSTOMER registrado', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'cust-1',
          role: UserRole.CUSTOMER,
          isGuest: false,
          fullName: 'Test Customer',
        },
        logout: vi.fn(),
      } as any);
    });

    it('muestra navegación: Home, Explore, Favorites, Orders, Impact, Profile', () => {
      renderDesktopSidebar(false);
      // t() devuelve la clave, verificamos nav keys
      expect(screen.getByText('nav_home')).toBeDefined();
      expect(screen.getByText('nav_explore')).toBeDefined();
      expect(screen.getByText('nav_favorites')).toBeDefined();
      expect(screen.getByText('nav_orders')).toBeDefined();
      expect(screen.getByText('nav_impact')).toBeDefined();
      expect(screen.getByText('nav_profile')).toBeDefined();
    });

    it('muestra botón de Logout', () => {
      renderDesktopSidebar(false);
      expect(screen.getByText('nav_logout')).toBeDefined();
    });
  });

  describe('GUEST anónimo (isGuest=true)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'guest-1',
          role: UserRole.CUSTOMER,
          isGuest: true,
        },
        logout: vi.fn(),
      } as any);
    });

    it('muestra navegación básica', () => {
      renderDesktopSidebar(true);
      expect(screen.getByText('nav_home')).toBeDefined();
      expect(screen.getByText('nav_explore')).toBeDefined();
    });

    it('NO muestra botón de Logout (isGuest → !user?.isGuest es false)', () => {
      renderDesktopSidebar(true);
      expect(screen.queryByText('nav_logout')).toBeNull();
    });
  });
});
