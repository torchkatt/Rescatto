import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SellerType } from '../../types';

// ---------------------------------------------------------------------------
// Mocks — all factories must be inline (no top-level const references)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'admin-1', role: 'SUPER_ADMIN' } })),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));

vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
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

vi.mock('../../components/common/DataTable', () => ({
  DataTable: ({ columns, data, placeholder }: any) => (
    <div data-testid="data-table">
      <input placeholder={placeholder} data-testid="table-search" />
      <div data-testid="table-rows">{data?.length} rows</div>
      {data?.map((item: any, i: number) => (
        <div key={i} data-testid={`row-${item.id || i}`}>
          {columns?.map((col: any, j: number) => (
            <span key={j} data-testid={`cell-${i}-${j}`}>
              {col.render
                ? col.render(item[String(col.accessor)], item)
                : String(item[String(col.accessor)] ?? '')}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 3 }) }),
}));

// ─── Mock sellerService — inline ─────────────────────────────────────────

vi.mock('../../services/sellerService', () => ({
  sellerService: {
    search: vi.fn(),
    getPage: vi.fn(),
    update: vi.fn(),
  },
}));

import { sellerService } from '../../services/sellerService';
const mockSellerService = vi.mocked(sellerService);

// ─── useAdminTable mock ──────────────────────────────────────────────────

let mockAdminTableData: any[] = [];

vi.mock('../../hooks/useAdminTable', () => ({
  useAdminTable: () => ({
    data: mockAdminTableData,
    totalItems: mockAdminTableData.length,
    currentPage: 1,
    pageSize: 20,
    isLoading: false,
    isSearching: false,
    searchTerm: '',
    setSearchTerm: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    reload: vi.fn(),
    setData: vi.fn(),
    hasMore: false,
  }),
}));

// ─── Mock seller data ────────────────────────────────────────────────────

const mockSellers = [
  {
    id: 'seller-1', name: 'Tienda A', type: SellerType.FOOD,
    ownerId: 'owner-1', location: { city: 'Bogotá', address: 'Calle 1' },
    subscription: 'free', isActive: true, logo: null,
    stats: { totalTransactions: 50, totalRevenue: 1000000 },
  },
  {
    id: 'seller-2', name: 'Tienda B', type: SellerType.RETAIL,
    ownerId: 'owner-2', location: { city: 'Medellín', address: 'Carrera 2' },
    subscription: 'seller_pass_monthly', isActive: false, logo: null,
    stats: { totalTransactions: 30, totalRevenue: 500000 },
  },
  {
    id: 'seller-3', name: 'Tienda C', type: SellerType.SERVICE,
    ownerId: 'owner-3', location: { city: 'Cali', address: 'Avenida 3' },
    subscription: 'seller_pass_annual', isActive: true, logo: null,
    stats: { totalTransactions: 120, totalRevenue: 3000000 },
  },
];

// ─── Import component under test ──────────────────────────────────────────

import { SellersManager } from '../../pages/admin/SellersManager';

const renderSellersManager = () => {
  return render(
    <MemoryRouter>
      <SellersManager />
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SellersManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminTableData = mockSellers;
  });

  it('renders header with title', () => {
    renderSellersManager();
    expect(screen.getByText('Vendedores')).toBeInTheDocument();
    expect(screen.getByText('Administra los vendedores del marketplace')).toBeInTheDocument();
  });

  it('renders DataTable with seller rows', () => {
    renderSellersManager();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();
  });

  it('renders filter tab buttons', () => {
    renderSellersManager();
    expect(screen.getByText('Todos')).toBeInTheDocument();
    // "Comida" appears both as filter tab and in table cells, so use getAllByText
    expect(screen.getAllByText('Comida').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Retail').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Servicio').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Individual')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    renderSellersManager();
    expect(screen.getByText('Actualizar')).toBeInTheDocument();
  });

  it('renders seller names in rows', () => {
    renderSellersManager();
    expect(screen.getByText('Tienda A')).toBeInTheDocument();
    expect(screen.getByText('Tienda B')).toBeInTheDocument();
    expect(screen.getByText('Tienda C')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderSellersManager();
    expect(screen.getByTestId('table-search')).toBeInTheDocument();
  });
});
