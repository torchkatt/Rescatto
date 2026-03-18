/**
 * FASE 3.1 — Sidebar Business/Admin
 *
 * Verifica que cada sección del menú lateral se muestra/oculta
 * correctamente según el rol del usuario.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '../../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    venue: null,
    logoUrl: null,
    isDarkMode: false,
    toggleDarkMode: vi.fn(),
  })),
}));
vi.mock('../../context/ChatContext', () => ({
  useChat: vi.fn(() => ({ unreadCount: 0 })),
}));
vi.mock('../../context/LocationContext', () => ({
  useLocation: vi.fn(() => ({ city: 'Bogotá', address: '' })),
}));
vi.mock('../../hooks/usePWA', () => ({
  usePWA: vi.fn(() => ({
    isInstalled: false,
    installApp: vi.fn(),
    showInstructions: false,
    setShowInstructions: vi.fn(),
  })),
}));
vi.mock('../../components/PWANotification', () => ({
  PWANotification: () => null,
}));
vi.mock('../../components/common/Logo', () => ({
  Logo: () => <span>Logo</span>,
}));
vi.mock('../../components/customer/home/LocationSelector', () => ({
  LocationSelector: () => null,
}));
vi.mock('../../services/firebase', () => ({
  db: {},
  auth: {},
  functions: {},
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((_q, cb) => {
    cb({ size: 0 });
    return vi.fn(); // unsubscribe
  }),
}));
vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';

const mockUseAuth = vi.mocked(useAuth);

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildAuth(role: UserRole, extra: Record<string, unknown> = {}) {
  return {
    user: {
      id: `${role}-1`,
      role,
      fullName: `Test ${role}`,
      isGuest: false,
      venueId: role === UserRole.VENUE_OWNER ? 'venue-1' : undefined,
      venueIds: role === UserRole.VENUE_OWNER ? ['venue-1'] : [],
      ...extra,
    },
    isAuthenticated: true,
    isLoading: false,
    hasRole: vi.fn((roles: UserRole[]) => roles.includes(role)),
    logout: vi.fn(),
  } as any;
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FASE 3.1 — Sidebar Business/Admin por rol', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── VENUE_OWNER ────────────────────────────────────────────────────────────

  describe('VENUE_OWNER con venueId', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuth(UserRole.VENUE_OWNER));
    });

    it('muestra Dashboard link', () => {
      renderSidebar();
      expect(screen.getByText('Dashboard')).toBeDefined();
    });

    it('muestra Pedidos (KDS) en sección Operaciones', () => {
      renderSidebar();
      expect(screen.getByText(/Pedidos \(KDS\)/i)).toBeDefined();
    });

    it('muestra sección Gestión con Catalogo, Historial, Analytics, Flash Deals', () => {
      renderSidebar();
      expect(screen.getByText('Catalogo')).toBeDefined();
      expect(screen.getByText('Historial')).toBeDefined();
      expect(screen.getByText('Analytics')).toBeDefined();
      expect(screen.getByText('Flash Deals')).toBeDefined();
    });

    it('muestra Billetera (solo VENUE_OWNER)', () => {
      renderSidebar();
      expect(screen.getByText('Billetera')).toBeDefined();
    });

    it('muestra Configuración en sección Sistema', () => {
      renderSidebar();
      expect(screen.getByText('Configuración')).toBeDefined();
    });

    it('NO muestra sección Admin (Usuarios, Categorías, Negocios)', () => {
      renderSidebar();
      expect(screen.queryByText('Usuarios')).toBeNull();
      expect(screen.queryByText('Categorías')).toBeNull();
      expect(screen.queryByText('Negocios')).toBeNull();
    });

    it('NO muestra items Solo Super (Logs, Finanzas Global, Comisiones, etc.)', () => {
      renderSidebar();
      expect(screen.queryByText('Logs')).toBeNull();
      expect(screen.queryByText('Finanzas Global')).toBeNull();
      expect(screen.queryByText('Comisiones')).toBeNull();
    });
  });

  // ── KITCHEN_STAFF ──────────────────────────────────────────────────────────

  describe('KITCHEN_STAFF', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuth(UserRole.KITCHEN_STAFF));
    });

    it('muestra Pedidos (KDS) en sección Operaciones', () => {
      renderSidebar();
      expect(screen.getByText(/Pedidos \(KDS\)/i)).toBeDefined();
    });

    it('NO muestra Dashboard link', () => {
      renderSidebar();
      expect(screen.queryByText('Dashboard')).toBeNull();
    });

    it('NO muestra sección Gestión (sin venueId)', () => {
      renderSidebar();
      expect(screen.queryByText('Catalogo')).toBeNull();
      expect(screen.queryByText('Analytics')).toBeNull();
      expect(screen.queryByText('Flash Deals')).toBeNull();
    });

    it('NO muestra Billetera', () => {
      renderSidebar();
      expect(screen.queryByText('Billetera')).toBeNull();
    });

    it('NO muestra sección Admin', () => {
      renderSidebar();
      expect(screen.queryByText('Usuarios')).toBeNull();
    });
  });

  // ── DRIVER ─────────────────────────────────────────────────────────────────

  describe('DRIVER', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuth(UserRole.DRIVER));
    });

    it('muestra Mis Entregas en sección Operaciones', () => {
      renderSidebar();
      expect(screen.getByText('Mis Entregas')).toBeDefined();
    });

    it('NO muestra Dashboard link', () => {
      renderSidebar();
      expect(screen.queryByText('Dashboard')).toBeNull();
    });

    it('NO muestra sección Gestión', () => {
      renderSidebar();
      expect(screen.queryByText('Catalogo')).toBeNull();
      expect(screen.queryByText('Analytics')).toBeNull();
    });

    it('NO muestra sección Admin', () => {
      renderSidebar();
      expect(screen.queryByText('Usuarios')).toBeNull();
    });

    it('NO muestra Pedidos (KDS)', () => {
      renderSidebar();
      expect(screen.queryByText(/Pedidos \(KDS\)/i)).toBeNull();
    });
  });

  // ── SUPER_ADMIN ────────────────────────────────────────────────────────────

  describe('SUPER_ADMIN', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        ...buildAuth(UserRole.SUPER_ADMIN),
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.SUPER_ADMIN) ||
          roles.includes(UserRole.ADMIN) ||
          roles.includes(UserRole.VENUE_OWNER),
        ),
      });
    });

    it('muestra sección Admin: Usuarios, Categorías, Negocios', () => {
      renderSidebar();
      expect(screen.getByText('Usuarios')).toBeDefined();
      expect(screen.getByText('Categorías')).toBeDefined();
      expect(screen.getByText('Negocios')).toBeDefined();
    });

    it('muestra items Solo Super: Logs, Finanzas Global, Comisiones, Ventas Global, Domicilios, Suscripciones, Datos Bancarios, Config. Plataforma', () => {
      renderSidebar();
      expect(screen.getByText('Logs')).toBeDefined();
      expect(screen.getByText('Finanzas Global')).toBeDefined();
      expect(screen.getByText('Comisiones')).toBeDefined();
      expect(screen.getByText('Ventas Global')).toBeDefined();
      expect(screen.getByText('Domicilios')).toBeDefined();
      expect(screen.getByText('Suscripciones')).toBeDefined();
      expect(screen.getByText('Datos Bancarios')).toBeDefined();
      expect(screen.getByText('Config. Plataforma')).toBeDefined();
    });

    it('muestra Configuración en sección Sistema', () => {
      renderSidebar();
      expect(screen.getByText('Configuración')).toBeDefined();
    });
  });

  // ── ADMIN ──────────────────────────────────────────────────────────────────

  describe('ADMIN', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        ...buildAuth(UserRole.ADMIN),
        hasRole: vi.fn((roles: UserRole[]) =>
          roles.includes(UserRole.ADMIN) || roles.includes(UserRole.SUPER_ADMIN),
        ),
      });
    });

    it('muestra sección Admin: Usuarios, Categorías, Negocios', () => {
      renderSidebar();
      expect(screen.getByText('Usuarios')).toBeDefined();
      expect(screen.getByText('Categorías')).toBeDefined();
      expect(screen.getByText('Negocios')).toBeDefined();
    });

    it('NO muestra items Solo Super (Logs, Finanzas Global, Comisiones, etc.)', () => {
      // ADMIN no pasa el hasRole([SUPER_ADMIN]) check interno del Sidebar
      const auth = buildAuth(UserRole.ADMIN);
      // Override hasRole: ADMIN tiene ADMIN+SUPER_ADMIN para la sección Admin
      // pero NO pasa hasRole([SUPER_ADMIN]) solo
      auth.hasRole = vi.fn((roles: UserRole[]) => {
        if (roles.length === 1 && roles[0] === UserRole.SUPER_ADMIN) return false;
        return roles.includes(UserRole.ADMIN);
      });
      mockUseAuth.mockReturnValue(auth);

      renderSidebar();
      expect(screen.queryByText('Logs')).toBeNull();
      expect(screen.queryByText('Finanzas Global')).toBeNull();
      expect(screen.queryByText('Comisiones')).toBeNull();
    });
  });
});
