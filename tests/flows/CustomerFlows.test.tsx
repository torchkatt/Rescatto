import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { ProductType, type Product, type Venue } from '../../types';

// ─── Mock child components as simple divs ────────────────────────────────────

vi.mock('../../components/customer/common/Loading', () => ({
  HomeSkeletonLoader: () => <div data-testid="home-skeleton">Loading skeleton...</div>,
}));

vi.mock('../../components/customer/venue/VenueCard', () => ({
  VenueCard: (props: any) => <div data-testid={`venue-card-${props.venue.id}`}>{props.venue.name}</div>,
}));

vi.mock('../../components/customer/home/ProductDiscoveryRow', () => ({
  ProductDiscoveryRow: (props: any) => (
    <div data-testid={`discovery-row-${props.title}`}>
      {props.products.map((p: any) => (
        <span key={p.id} data-testid={`discovery-product-${p.id}`}>{p.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('../../components/customer/home/ActiveVenueCard', () => ({
  ActiveVenueCard: (props: any) => <div data-testid={`active-venue-${props.venue.id}`}>{props.venue.name}</div>,
}));

vi.mock('../../components/customer/home/HeroDealCard', () => ({
  HeroDealCard: (props: any) => (
    <div data-testid="hero-deal-card">
      {props.product.name} - {props.discountPct}%
    </div>
  ),
}));

vi.mock('../../components/customer/home/DesktopActiveVenues', () => ({
  DesktopActiveVenues: (props: any) => (
    <div data-testid="desktop-active-venues">
      {props.venues.map((v: any) => (
        <span key={v.id}>{v.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('../../components/customer/home/ProductSmallCard', () => ({
  ProductSmallCard: (props: any) => (
    <div data-testid={`product-card-${props.product.id}`}>{props.product.name}</div>
  ),
}));

vi.mock('../../components/customer/OnboardingTour', () => ({
  OnboardingTour: () => <div data-testid="onboarding-tour" />,
}));

vi.mock('../../components/common/SEO', () => ({
  SEO: () => null,
}));

vi.mock('../../components/common/NotificationDisplay', () => ({
  NotificationDisplay: () => <div data-testid="notification-display" />,
}));

// ─── Mock external modules ───────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockOutletContext = {
  openImpact: vi.fn(),
  onOpenLocation: vi.fn(),
  onOpenSearch: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => mockOutletContext,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params?.name) return `${key}::${params.name}`;
      return key;
    },
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock context hooks ──────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'test@rescatto.co',
  fullName: 'Carlos Pérez',
  role: 'CUSTOMER',
  isGuest: false,
  hasSeenOnboarding: true,
  streak: { current: 5, longest: 10, lastOrderDate: '2026-03-16', multiplier: 2.0 },
  impact: { co2Saved: 12, moneySaved: 50000, totalRescues: 8, points: 3200, level: 'HERO' as const, badges: [] },
};

const mockGuestUser = {
  id: 'guest-anon',
  email: '',
  fullName: '',
  role: 'CUSTOMER',
  isGuest: true,
  hasSeenOnboarding: true,
};

let currentMockUser: any = mockUser;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: currentMockUser }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}));

let mockLocationValues = { city: 'Bogotá', latitude: 4.6097, longitude: -74.0817 };

vi.mock('../../context/LocationContext', () => ({
  useLocation: () => mockLocationValues,
}));

// ─── Mock services ───────────────────────────────────────────────────────────

const now = new Date();
const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const inSixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
const inOneHour = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();

const makeVenue = (overrides: Partial<Venue> = {}): Venue => ({
  id: 'venue-1',
  name: 'Panadería La Esquina',
  address: 'Calle 100 #15-30',
  city: 'Bogotá',
  latitude: 4.6097,
  longitude: -74.0817,
  closingTime: '23:00',
  rating: 4.5,
  imageUrl: 'https://example.com/venue.jpg',
  businessType: 'Panadería',
  ...overrides,
});

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  venueId: 'venue-1',
  name: 'Pack Sorpresa Pan',
  type: ProductType.SURPRISE_PACK,
  originalPrice: 25000,
  discountedPrice: 12000,
  quantity: 5,
  imageUrl: 'https://example.com/prod.jpg',
  availableUntil: inTwoHours,
  isDynamicPricing: false,
  ...overrides,
});

const mockVenue1 = makeVenue();
const mockVenue2 = makeVenue({
  id: 'venue-2',
  name: 'Restaurante El Jardín',
  closingTime: '22:00',
  businessType: 'Restaurante',
});

const mockProduct1 = makeProduct();
const mockProduct2 = makeProduct({
  id: 'prod-2',
  venueId: 'venue-1',
  name: 'Combo Almuerzo Ejecutivo',
  type: ProductType.SPECIFIC_DISH,
  originalPrice: 30000,
  discountedPrice: 15000,
  availableUntil: inOneHour,
});
const mockProduct3 = makeProduct({
  id: 'prod-3',
  venueId: 'venue-2',
  name: 'Pack Sorpresa Sushi',
  originalPrice: 40000,
  discountedPrice: 18000,
  availableUntil: inSixHours,
});

const mockVenueService = {
  getAllVenuesPage: vi.fn(),
  getAllVenues: vi.fn(),
  getExpiringProductsByVenue: vi.fn(),
  getStockCountByVenue: vi.fn(),
  getDynamicPricingVenueIds: vi.fn(),
};

const mockProductService = {
  getAllActiveProductsPage: vi.fn(),
};

vi.mock('../../services/venueService', () => ({
  venueService: {
    getAllVenuesPage: (...args: any[]) => mockVenueService.getAllVenuesPage(...args),
    getAllVenues: (...args: any[]) => mockVenueService.getAllVenues(...args),
    getExpiringProductsByVenue: (...args: any[]) => mockVenueService.getExpiringProductsByVenue(...args),
    getStockCountByVenue: (...args: any[]) => mockVenueService.getStockCountByVenue(...args),
    getDynamicPricingVenueIds: (...args: any[]) => mockVenueService.getDynamicPricingVenueIds(...args),
  },
}));

vi.mock('../../services/productService', () => ({
  productService: {
    getAllActiveProductsPage: (...args: any[]) => mockProductService.getAllActiveProductsPage(...args),
  },
}));

vi.mock('../../services/ratingService', () => ({
  getRatingStats: vi.fn().mockResolvedValue({
    userId: 'venue-1',
    averageRating: 4.5,
    totalRatings: 120,
    breakdown: { 5: 60, 4: 30, 3: 20, 2: 5, 1: 5 },
    lastUpdated: '2026-03-16T12:00:00Z',
  }),
}));

vi.mock('../../services/locationService', () => ({
  calculateDistance: vi.fn(() => 1.5),
}));

vi.mock('../../utils/venueAvailability', () => ({
  isVenueOpen: vi.fn((venue: any) => {
    // Simulate: venue-1 open, venue-2 open
    return true;
  }),
}));

// ─── Helper: render within MemoryRouter ──────────────────────────────────────

const renderWithRouter = (ui: React.ReactElement, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

// ─── Setup default mock returns ──────────────────────────────────────────────

const setupHomeDefaults = (overrides?: {
  venues?: Venue[];
  products?: Product[];
  hasMoreVenues?: boolean;
  hasMoreProducts?: boolean;
}) => {
  const venues = overrides?.venues ?? [mockVenue1, mockVenue2];
  const products = overrides?.products ?? [mockProduct1, mockProduct2, mockProduct3];

  mockVenueService.getAllVenuesPage.mockResolvedValue({
    venues,
    lastDoc: null,
    hasMore: overrides?.hasMoreVenues ?? false,
  });
  mockVenueService.getExpiringProductsByVenue.mockResolvedValue(
    new Map([['venue-1', inTwoHours]])
  );
  mockVenueService.getStockCountByVenue.mockResolvedValue({
    stockMap: new Map([['venue-1', 10], ['venue-2', 5]]),
    productCountMap: new Map([['venue-1', 3], ['venue-2', 2]]),
  });
  mockVenueService.getDynamicPricingVenueIds.mockResolvedValue(new Set());
  mockProductService.getAllActiveProductsPage.mockResolvedValue({
    products,
    lastDoc: null,
    hasMore: overrides?.hasMoreProducts ?? false,
  });
};

const setupExploreDefaults = (overrides?: {
  venues?: Venue[];
  products?: Product[];
  hasMoreProducts?: boolean;
}) => {
  const venues = overrides?.venues ?? [mockVenue1, mockVenue2];
  const products = overrides?.products ?? [mockProduct1, mockProduct2, mockProduct3];

  mockVenueService.getAllVenues.mockResolvedValue(venues);
  mockProductService.getAllActiveProductsPage.mockResolvedValue({
    products,
    lastDoc: null,
    hasMore: overrides?.hasMoreProducts ?? false,
  });
};

// ─── Import components under test (after all mocks) ──────────────────────────

import CustomerHome from '../../pages/customer/Home';
import Explore from '../../pages/customer/Explore';

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS: Home Page
// ═══════════════════════════════════════════════════════════════════════════════

describe('CustomerHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = mockUser;
    mockLocationValues = { city: 'Bogotá', latitude: 4.6097, longitude: -74.0817 };
  });

  it('shows skeleton loader while loading', () => {
    // Services never resolve → stays in loading state
    mockVenueService.getAllVenuesPage.mockReturnValue(new Promise(() => {}));
    mockVenueService.getExpiringProductsByVenue.mockReturnValue(new Promise(() => {}));
    mockVenueService.getStockCountByVenue.mockReturnValue(new Promise(() => {}));
    mockVenueService.getDynamicPricingVenueIds.mockReturnValue(new Promise(() => {}));
    mockProductService.getAllActiveProductsPage.mockReturnValue(new Promise(() => {}));

    renderWithRouter(<CustomerHome />);
    expect(screen.getByTestId('home-skeleton')).toBeInTheDocument();
  });

  it('renders greeting with user name when logged in', async () => {
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    // The t function returns 'hello::Carlos' for t('hello', { name: 'Carlos' })
    expect(screen.getByText('hello::Carlos')).toBeInTheDocument();
  });

  it('renders gamification pill with streak info for non-guest users', async () => {
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    // Streak days text: "5 streak_days"
    expect(screen.getByText('streak_days', { exact: false })).toBeInTheDocument();

    // Multiplier badge: "x2.0"
    expect(screen.getByText('x2.0')).toBeInTheDocument();
  });

  it('does NOT show gamification pill for guest users', async () => {
    currentMockUser = mockGuestUser;
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    // welcome key is shown instead of hello
    expect(screen.getByText('welcome')).toBeInTheDocument();

    // Streak/multiplier pill should not be present
    expect(screen.queryByText('streak_days')).not.toBeInTheDocument();
    expect(screen.queryByText(/x1\.0/)).not.toBeInTheDocument();
  });

  it('renders "Activos ahora" section when open venues exist', async () => {
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    // The active_now text should appear (mobile carousel heading)
    expect(screen.getByText('active_now')).toBeInTheDocument();

    // DesktopActiveVenues component should be rendered
    expect(screen.getByTestId('desktop-active-venues')).toBeInTheDocument();
  });

  it('renders "Ending soon" section when products are expiring', async () => {
    // mockProduct2 expires in 1 hour → should appear in endingSoonProducts
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    // The ending_soon discovery row should include expiring products
    const row = screen.getByTestId('discovery-row-ending_soon');
    expect(row).toBeInTheDocument();

    // mockProduct1 (2h) and mockProduct2 (1h) are within 4h window
    expect(screen.getAllByTestId('discovery-product-prod-1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('discovery-product-prod-2').length).toBeGreaterThanOrEqual(1);
  });

  it('shows HeroDealCard when a qualifying deal exists', async () => {
    // Products with discount + expiring within 24h qualify for hero deal
    setupHomeDefaults();

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('hero-deal-card')).toBeInTheDocument();
  });

  it('renders "Load more" button when hasMoreProducts is true', async () => {
    setupHomeDefaults({ hasMoreProducts: true });

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('load_more_products')).toBeInTheDocument();
  });

  it('does NOT render "Load more" button when hasMoreProducts is false', async () => {
    setupHomeDefaults({ hasMoreProducts: false });

    renderWithRouter(<CustomerHome />);

    await waitFor(() => {
      expect(screen.queryByTestId('home-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('load_more_products')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS: Explore Page
// ═══════════════════════════════════════════════════════════════════════════════

describe('Explore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = mockUser;
    mockLocationValues = { city: 'Bogotá', latitude: 4.6097, longitude: -74.0817 };
  });

  it('shows loading spinner on initial load', () => {
    // Services never resolve
    mockVenueService.getAllVenues.mockReturnValue(new Promise(() => {}));
    mockProductService.getAllActiveProductsPage.mockReturnValue(new Promise(() => {}));

    renderWithRouter(<Explore />);

    expect(screen.getByText('loading...')).toBeInTheDocument();
  });

  it('renders filter chips (type, distance, discount, expiry)', async () => {
    setupExploreDefaults();

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    // Type chips
    expect(screen.getByText('type_all')).toBeInTheDocument();
    expect(screen.getByText('type_packs')).toBeInTheDocument();
    expect(screen.getByText('type_dishes')).toBeInTheDocument();

    // Distance filter chips
    expect(screen.getByText('1km')).toBeInTheDocument();
    expect(screen.getByText('2.5km')).toBeInTheDocument();
    expect(screen.getByText('5km')).toBeInTheDocument();
    expect(screen.getByText('10km')).toBeInTheDocument();

    // Discount filter chips
    expect(screen.getByText(/≥20%/)).toBeInTheDocument();
    expect(screen.getByText(/≥40%/)).toBeInTheDocument();
    expect(screen.getByText(/≥60%/)).toBeInTheDocument();

    // Expiry filter chips
    expect(screen.getByText(/≤1h/)).toBeInTheDocument();
    expect(screen.getByText(/≤2h/)).toBeInTheDocument();
    expect(screen.getByText(/≤4h/)).toBeInTheDocument();
    expect(screen.getByText(/≤12h/)).toBeInTheDocument();

    // Filter section labels
    expect(screen.getByText('filter_distance')).toBeInTheDocument();
    expect(screen.getByText('filter_discount')).toBeInTheDocument();
    expect(screen.getByText('filter_expires')).toBeInTheDocument();
  });

  it('renders product grid after loading', async () => {
    setupExploreDefaults();

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    // All 3 products should be rendered via ProductSmallCard mock
    expect(screen.getByTestId('product-card-prod-1')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-prod-2')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-prod-3')).toBeInTheDocument();
  });

  it('shows empty state when no products match filters', async () => {
    // Return venues but no products
    setupExploreDefaults({ products: [] });

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('no_results')).toBeInTheDocument();
    expect(screen.getByText('try_adjusting_filters')).toBeInTheDocument();
    expect(screen.getByText('clear_filters')).toBeInTheDocument();
  });

  it('shows "Load more" button when hasMoreProducts', async () => {
    setupExploreDefaults({ hasMoreProducts: true });

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('load_more_products')).toBeInTheDocument();
  });

  it('does NOT show "Load more" button when no more products', async () => {
    setupExploreDefaults({ hasMoreProducts: false });

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('load_more_products')).not.toBeInTheDocument();
  });

  it('shows location warning when latitude is null', async () => {
    mockLocationValues = { city: 'Bogotá', latitude: null as any, longitude: null as any };
    setupExploreDefaults();

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('enable_location_for_distance')).toBeInTheDocument();
  });

  it('does NOT show location warning when latitude is available', async () => {
    mockLocationValues = { city: 'Bogotá', latitude: 4.6097, longitude: -74.0817 };
    setupExploreDefaults();

    renderWithRouter(<Explore />);

    await waitFor(() => {
      expect(screen.queryByText('loading...')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('enable_location_for_distance')).not.toBeInTheDocument();
  });
});
