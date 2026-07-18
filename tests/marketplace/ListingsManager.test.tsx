import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ListingType } from '../../types';

// ---------------------------------------------------------------------------
// Mocks — all factories inline (no top-level const references)
// ---------------------------------------------------------------------------

vi.mock('../../context/ToastContext', () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));

vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

vi.mock('../../components/common/Tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../components/common/DataTable', () => ({
  DataTable: ({ columns, data, placeholder, isLoading }: any) => (
    <div data-testid="data-table">
      {isLoading && <div data-testid="table-loading">Loading...</div>}
      <input placeholder={placeholder} data-testid="table-search" />
      <div data-testid="table-rows">{data?.length} rows</div>
      {data?.map((item: any, i: number) => (
        <div key={i} data-testid={`row-${item.id || i}`}>
          <span data-testid={`row-title-${i}`}>{item.title || ''}</span>
          <span data-testid={`row-type-${i}`}>
            {item.type === ListingType.PRODUCT ? 'Producto'
              : item.type === ListingType.SERVICE ? 'Servicio'
              : item.type === ListingType.DIGITAL ? 'Digital' : ''}
          </span>
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
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 3 }) }),
}));

// ─── Mock listingService — inline ────────────────────────────────────────

vi.mock('../../services/listingService', () => ({
  listingService: {
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
  },
}));

import { listingService } from '../../services/listingService';
const mockListingService = vi.mocked(listingService);

// ─── Mock useAdminTable ───────────────────────────────────────────────────

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

// ─── Mock listing data ───────────────────────────────────────────────────

const mockListings = [
  {
    id: 'listing-1', title: 'Producto Test A', type: ListingType.PRODUCT,
    sellerId: 'seller-1', categoryId: 'cat-1', price: 25000, originalPrice: 50000,
    isActive: true, isFeatured: false,
    stats: { sales: 10, views: 100, rating: 4.5 }, createdAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'listing-2', title: 'Servicio Test B', type: ListingType.SERVICE,
    sellerId: 'seller-2', categoryId: 'cat-2', price: 100000,
    isActive: true, isFeatured: true,
    stats: { sales: 5, views: 50, rating: 4.0 }, createdAt: '2025-06-15T00:00:00Z',
  },
  {
    id: 'listing-3', title: 'Digital Test C', type: ListingType.DIGITAL,
    sellerId: 'seller-1', categoryId: 'cat-3', price: 15000,
    isActive: false, isFeatured: false,
    stats: { sales: 0, views: 30, rating: 0 }, createdAt: '2025-07-01T00:00:00Z',
  },
];

// ─── Import component under test ──────────────────────────────────────────

import { ListingsManager } from '../../pages/admin/ListingsManager';

const renderListingsManager = () => {
  return render(
    <MemoryRouter>
      <ListingsManager />
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminTableData = mockListings;
  });

  it('renders header with title', () => {
    renderListingsManager();
    expect(screen.getByText('Gestión de Listings')).toBeInTheDocument();
    expect(
      screen.getByText('Administración de productos, servicios y digitales del marketplace'),
    ).toBeInTheDocument();
  });

  it('renders DataTable with listing rows', () => {
    renderListingsManager();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();
  });

  it('shows listing titles in rows', () => {
    renderListingsManager();
    expect(screen.getByTestId('row-title-0')).toHaveTextContent('Producto Test A');
    expect(screen.getByTestId('row-title-1')).toHaveTextContent('Servicio Test B');
    expect(screen.getByTestId('row-title-2')).toHaveTextContent('Digital Test C');
  });

  it('shows listing types in rows', () => {
    renderListingsManager();
    expect(screen.getByTestId('row-type-0')).toHaveTextContent('Producto');
    expect(screen.getByTestId('row-type-1')).toHaveTextContent('Servicio');
    expect(screen.getByTestId('row-type-2')).toHaveTextContent('Digital');
  });

  it('renders refresh button', () => {
    renderListingsManager();
    const refreshBtn = document.querySelector('[title="Refrescar listings"]');
    expect(refreshBtn).toBeInTheDocument();
  });

  it('renders search input via DataTable', () => {
    renderListingsManager();
    expect(screen.getByTestId('table-search')).toBeInTheDocument();
    expect(screen.getByTestId('table-search')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Buscar listings'),
    );
  });
});
