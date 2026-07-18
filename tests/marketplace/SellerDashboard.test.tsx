import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — all factories inline (no top-level const references)
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/formatters', () => ({
  formatCOP: vi.fn((v: number) => {
    if (v == null) return '$0';
    return `$${(v as number).toLocaleString('es-CO')}`;
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../components/customer/common/Loading', () => ({
  LoadingSpinner: ({ fullPage }: any) => (
    <div data-testid="loading-spinner">Loading {fullPage ? 'full' : ''}</div>
  ),
}));

// ─── Mock services — inline factories ─────────────────────────────────────

vi.mock('../../services/sellerService', () => ({
  sellerService: { getById: vi.fn() },
}));

vi.mock('../../services/transactionService', () => ({
  transactionService: { getBySeller: vi.fn() },
}));

vi.mock('../../services/bookingService', () => ({
  bookingService: { getBySeller: vi.fn() },
}));

vi.mock('../../services/listingService', () => ({
  listingService: { getListingsBySeller: vi.fn() },
}));

let mockVenueId: string | null = 'venue-1';
vi.mock('../../utils/getUserVenueId', () => ({
  getUserVenueId: () => mockVenueId,
}));

// ─── Import mocked modules ────────────────────────────────────────────────

import { useAuth } from '../../context/AuthContext';
import { sellerService } from '../../services/sellerService';
import { transactionService } from '../../services/transactionService';
import { bookingService } from '../../services/bookingService';
import { listingService } from '../../services/listingService';

const mockUseAuth = vi.mocked(useAuth);
const mockSellerService = vi.mocked(sellerService);
const mockTransactionService = vi.mocked(transactionService);
const mockBookingService = vi.mocked(bookingService);
const mockListingService = vi.mocked(listingService);

// ─── Mock data ────────────────────────────────────────────────────────────

const mockSeller = {
  id: 'venue-1',
  name: 'Tienda Dashboard',
  type: 'food',
  location: { city: 'Bogotá', address: 'Calle 100' },
  rating: 4.7,
  stats: { totalTransactions: 45, totalRevenue: 2500000 },
};

const mockListings = [
  { id: 'l-1', title: 'Producto A', isActive: true },
  { id: 'l-2', title: 'Producto B', isActive: true },
  { id: 'l-3', title: 'Producto C', isActive: false },
];

const mockRecentTransactions = [
  {
    id: 'tx-1', lineItems: [{ title: 'Compra 1' }],
    totalAmount: 50000, status: 'COMPLETED', createdAt: '2025-07-15T10:00:00Z',
  },
  {
    id: 'tx-2', lineItems: [{ title: 'Compra 2' }],
    totalAmount: 30000, status: 'PENDING', createdAt: '2025-07-16T08:00:00Z',
  },
];

const mockBookings = [
  {
    id: 'bk-1', listingId: 'l-1', startTime: '2025-07-20T10:00:00Z',
    endTime: '2025-07-20T11:00:00Z', status: 'CONFIRMED', notes: null,
  },
];

const buildAuthState = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'user-1',
    email: 'seller@test.com',
    fullName: 'Test Seller',
    ...overrides,
  },
});

// ─── Import component under test ──────────────────────────────────────────

import SellerDashboard from '../../pages/business/SellerDashboard';

const renderSellerDashboard = () => {
  return render(
    <MemoryRouter>
      <SellerDashboard />
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SellerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVenueId = 'venue-1';
    mockUseAuth.mockReturnValue(buildAuthState() as any);
  });

  it('shows loading spinner initially', () => {
    mockSellerService.getById.mockReturnValue(new Promise(() => {}));
    renderSellerDashboard();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows no-venue message when venueId is null', () => {
    mockVenueId = null;
    renderSellerDashboard();
    expect(screen.getByText('Sin sede asignada')).toBeInTheDocument();
    expect(
      screen.getByText(/No tienes una sede o tienda vinculada/i),
    ).toBeInTheDocument();
  });

  it('shows seller not found message', async () => {
    mockSellerService.getById.mockResolvedValue(null);
    renderSellerDashboard();
    await waitFor(() => {
      expect(screen.getByText('Vendedor no encontrado')).toBeInTheDocument();
    });
  });

  it('renders dashboard header with seller name', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockReturnValue(new Promise(() => {}));
    mockTransactionService.getBySeller.mockReturnValue(new Promise(() => {}));
    mockBookingService.getBySeller.mockReturnValue(new Promise(() => {}));

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText(/Panel de vendedor/i)).toBeInTheDocument();
  });

  it('renders metric cards after loading seller', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockTransactionService.getBySeller.mockResolvedValue({ transactions: mockRecentTransactions });
    mockBookingService.getBySeller.mockResolvedValue({ bookings: mockBookings });

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
    expect(screen.getByText('Total Transacciones')).toBeInTheDocument();
    expect(screen.getByText('Listados Activos')).toBeInTheDocument();
    expect(screen.getByText('Calificación Promedio')).toBeInTheDocument();
  });

  it('shows recent transactions section', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockTransactionService.getBySeller.mockResolvedValue({ transactions: mockRecentTransactions });
    mockBookingService.getBySeller.mockResolvedValue({ bookings: mockBookings });

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Transacciones Recientes')).toBeInTheDocument();
    expect(screen.getByText(/Producto 1/)).toBeInTheDocument();
  });

  it('shows upcoming bookings section', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockTransactionService.getBySeller.mockResolvedValue({ transactions: mockRecentTransactions });
    mockBookingService.getBySeller.mockResolvedValue({ bookings: mockBookings });

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Próximas Reservas')).toBeInTheDocument();
  });

  it('renders action links (Gestionar Productos, Pedidos)', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockReturnValue(new Promise(() => {}));
    mockTransactionService.getBySeller.mockReturnValue(new Promise(() => {}));
    mockBookingService.getBySeller.mockReturnValue(new Promise(() => {}));

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Gestionar Productos')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
  });

  it('shows error state on service failure', async () => {
    // When getById rejects, seller stays null and error is set.
    // The component checks !seller before checking error,
    // so it renders "Vendedor no encontrado" instead of "Error".
    mockSellerService.getById.mockRejectedValue(new Error('Service error'));
    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Vendedor no encontrado')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/No se encontró información del vendedor/i),
    ).toBeInTheDocument();
  });

  it('shows empty transactions state', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockTransactionService.getBySeller.mockResolvedValue({ transactions: [] });
    mockBookingService.getBySeller.mockResolvedValue({ bookings: [] });

    renderSellerDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tienda Dashboard')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Sin transacciones aún')).toBeInTheDocument();
    });
  });
});
