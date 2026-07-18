import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionStatus, TransactionType, DeliveryMethod } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));

vi.mock('../../hooks/useEscapeKey', () => ({
  useEscapeKey: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/formatters', () => ({
  formatCOP: vi.fn((v: number) => `$${v.toLocaleString('es-CO')}`),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../components/customer/common/Loading', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock('../../components/customer/common/GuestConversionBanner', () => ({
  GuestConversionBanner: () => <div data-testid="guest-banner">Guest Banner</div>,
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
}));

// Dynamic import mock for transactionService in handleCancel
vi.mock('../../services/transactionService', () => ({
  transactionService: {
    cancelByBuyer: vi.fn(),
  },
}));

// ─── Import types and mocked hooks ────────────────────────────────────────

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  fullName: 'Test User',
  role: 'CUSTOMER',
  isGuest: false,
};

const buildAuthState = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  ...overrides,
});

// ─── Mock transaction data ────────────────────────────────────────────────

const mockTransactions = [
  {
    id: 'tx-1',
    buyerId: 'user-1',
    sellerId: 'seller-1',
    transactionType: TransactionType.PURCHASE,
    status: TransactionStatus.COMPLETED,
    lineItems: [{ title: 'Producto A', quantity: 2, price: 25000 }],
    subtotal: 50000,
    totalAmount: 50000,
    deliveryMethod: DeliveryMethod.PICKUP,
    payment: { method: 'wompi', id: 'pay-1', status: 'approved' },
    createdAt: '2025-07-15T10:00:00Z',
    updatedAt: '2025-07-15T10:30:00Z',
  },
  {
    id: 'tx-2',
    buyerId: 'user-1',
    sellerId: 'seller-2',
    transactionType: TransactionType.PURCHASE,
    status: TransactionStatus.PENDING,
    lineItems: [{ title: 'Producto B', quantity: 1, price: 100000 }],
    subtotal: 100000,
    totalAmount: 100000,
    deliveryMethod: DeliveryMethod.SHIPPING,
    payment: { method: 'wompi', id: 'pay-2', status: 'pending' },
    createdAt: '2025-07-16T08:00:00Z',
    updatedAt: '2025-07-16T08:00:00Z',
    trackingNumber: 'TRACK-123',
  },
  {
    id: 'tx-3',
    buyerId: 'user-1',
    sellerId: 'seller-3',
    transactionType: TransactionType.DIGITAL,
    status: TransactionStatus.CANCELLED,
    lineItems: [{ title: 'Ebook Test', quantity: 1, price: 15000 }],
    subtotal: 15000,
    totalAmount: 15000,
    deliveryMethod: DeliveryMethod.DIGITAL,
    payment: { method: 'wompi', id: 'pay-3', status: 'voided' },
    createdAt: '2025-07-10T12:00:00Z',
    updatedAt: '2025-07-12T00:00:00Z',
  },
];

// ─── Import component under test ──────────────────────────────────────────

import { MyTransactions } from '../../pages/customer/MyTransactions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from 'firebase/firestore';

const renderMyTransactions = () => {
  return render(
    <MemoryRouter>
      <MyTransactions />
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows guest banner when user is not logged in', () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: null }) as any);

    renderMyTransactions();
    expect(screen.getByTestId('guest-banner')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    // getDocs never resolves
    vi.mocked(getDocs).mockReturnValue(new Promise(() => {}) as any);

    renderMyTransactions();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows empty state when no transactions', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/No tienes transacciones aún/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorar Marketplace/i)).toBeInTheDocument();
  });

  it('renders transactions list', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockTransactions.map(tx => ({
        id: tx.id,
        data: () => tx,
      })),
    } as any);

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Should show transaction items
    expect(screen.getByText('2x Producto A')).toBeInTheDocument();
    expect(screen.getByText('1x Producto B')).toBeInTheDocument();
    expect(screen.getByText('1x Ebook Test')).toBeInTheDocument();
  });

  it('shows cancel button for pending transactions', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{
        id: 'tx-2',
        data: () => mockTransactions[1],
      }],
    } as any);

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // The pending transaction should have a "Cancelar" button
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('shows status labels for each transaction', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockTransactions.map(tx => ({
        id: tx.id,
        data: () => tx,
      })),
    } as any);

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });

  it('shows delivery method icons/labels', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{
        id: 'tx-2',
        data: () => mockTransactions[1],
      }],
    } as any);

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Envío')).toBeInTheDocument();
  });

  it('handles fetch error gracefully', async () => {
    mockUseAuth.mockReturnValue(buildAuthState({ user: mockUser }) as any);
    vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

    renderMyTransactions();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Should show empty state after error
    expect(screen.getByText(/No tienes transacciones aún/i)).toBeInTheDocument();
  });
});
