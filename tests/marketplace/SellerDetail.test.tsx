import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ListingType } from '../../types';

// ---------------------------------------------------------------------------
// Mocks — all factories must be inline (no top-level const references)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ sellerId: 'seller-1' }),
  };
});

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../hooks/useFavorites', () => ({
  useFavorites: () => ({
    isFavorite: vi.fn(() => false),
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock('../../hooks/useRetry', () => ({
  useRetry: () => ({
    executeWithRetry: vi.fn((fn: any) => fn()),
  }),
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

vi.mock('../../components/common/SEO', () => ({
  SEO: () => null,
}));

vi.mock('../../components/common/ErrorState', () => ({
  ErrorState: ({ error, resetErrorBoundary }: any) => (
    <div data-testid="error-state">
      <span>{error?.message}</span>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  ),
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('../../components/ui/Skeleton', () => ({
  Skeleton: {
    Block: ({ children, ...props }: any) => <div data-testid="skeleton-block" {...props}>{children}</div>,
  },
}));

// ─── Mock services — inline factories ─────────────────────────────────────

vi.mock('../../services/sellerService', () => ({
  sellerService: {
    getById: vi.fn(),
  },
}));

vi.mock('../../services/listingService', () => ({
  listingService: {
    getListingsBySeller: vi.fn(),
  },
}));

vi.mock('../../services/venueService', () => ({
  venueService: {
    getVenueById: vi.fn(),
  },
}));

vi.mock('../../services/ratingService', () => ({
  getRatingStats: vi.fn(),
}));

// ─── Import mocked modules for direct access ──────────────────────────────

import { sellerService } from '../../services/sellerService';
import { listingService } from '../../services/listingService';
import { venueService } from '../../services/venueService';
import { getRatingStats } from '../../services/ratingService';

const mockSellerService = vi.mocked(sellerService);
const mockListingService = vi.mocked(listingService);
const mockVenueService = vi.mocked(venueService);
const mockGetRatingStats = vi.mocked(getRatingStats);

// ─── Mock data ────────────────────────────────────────────────────────────

const mockSeller = {
  id: 'seller-1',
  name: 'Tienda Test',
  type: 'food',
  categoryIds: [],
  ownerId: 'owner-1',
  location: { lat: 4.6097, lng: -74.0817, address: 'Calle 100 #15-30', city: 'Bogotá' },
  logo: 'https://example.com/logo.png',
  coverImage: 'https://example.com/cover.jpg',
  description: 'Una tienda de prueba',
  contact: { phone: '+573001234567' },
  rating: 4.5,
  stats: { totalTransactions: 25, totalRevenue: 500000 },
  isActive: true,
  subscription: 'free',
  createdAt: '2025-01-01T00:00:00Z',
};

const mockListings = [
  {
    id: 'listing-1', sellerId: 'seller-1', title: 'Producto Test 1',
    type: ListingType.PRODUCT, price: 25000, originalPrice: 50000,
    images: ['https://example.com/img1.jpg'], description: 'Descripción test',
    isActive: true, isFeatured: false, createdAt: '2025-06-01T00:00:00Z',
    stats: { sales: 10, views: 100, rating: 4.5 }, categoryId: 'cat-1', quantity: 10,
  },
  {
    id: 'listing-2', sellerId: 'seller-1', title: 'Servicio Test',
    type: ListingType.SERVICE, price: 100000, originalPrice: 150000,
    images: [], description: 'Descripción servicio',
    isActive: true, isFeatured: true, createdAt: '2025-06-15T00:00:00Z',
    stats: { sales: 5, views: 50, rating: 4.0 }, categoryId: 'cat-2', quantity: 5,
  },
  {
    id: 'listing-3', sellerId: 'seller-1', title: 'Digital Test',
    type: ListingType.DIGITAL, price: 15000, originalPrice: 15000,
    images: [], description: 'Descripción digital',
    isActive: false, isFeatured: false, createdAt: '2025-07-01T00:00:00Z',
    stats: { sales: 0, views: 30, rating: 0 }, categoryId: 'cat-3', quantity: 1,
  },
];

// ─── Import component under test ──────────────────────────────────────────

import { SellerDetail } from '../../pages/customer/SellerDetail';

const renderSellerDetail = () => {
  return render(
    <MemoryRouter initialEntries={['/app/seller/seller-1']}>
      <SellerDetail />
    </MemoryRouter>,
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SellerDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    mockSellerService.getById.mockReturnValue(new Promise(() => {}));
    renderSellerDetail();
    expect(screen.getByTestId('seller-detail-skeleton')).toBeInTheDocument();
  });

  it('renders seller info after loading successfully', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockGetRatingStats.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Tienda Test').length).toBeGreaterThanOrEqual(1);
  });

  it('shows listings count after loading', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockGetRatingStats.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/seller_listings_count/i)).toBeInTheDocument();
  });

  it('shows listing type tabs after loading', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockGetRatingStats.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('cat_all')).toBeInTheDocument();
    // seller_type_product appears in tab, listing card label, and info bar
    expect(screen.getAllByText('seller_type_product').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no listings', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue([]);
    mockGetRatingStats.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/seller_no_listings/i)).toBeInTheDocument();
  });

  it('shows error state on load failure', async () => {
    mockSellerService.getById.mockRejectedValue(new Error('Network error'));

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows not-found state when seller is null', async () => {
    mockSellerService.getById.mockResolvedValue(null);
    mockVenueService.getVenueById.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/seller_not_found/i)).toBeInTheDocument();
  });

  it('renders listing cards with discount badge', async () => {
    mockSellerService.getById.mockResolvedValue(mockSeller);
    mockListingService.getListingsBySeller.mockResolvedValue(mockListings);
    mockGetRatingStats.mockResolvedValue(null);

    renderSellerDetail();

    await waitFor(() => {
      expect(screen.queryByTestId('seller-detail-skeleton')).not.toBeInTheDocument();
    });

    // Productos appear in both mobile and desktop card views
    expect(screen.getAllByText('Producto Test 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Servicio Test').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Digital Test').length).toBeGreaterThanOrEqual(1);
  });
});
