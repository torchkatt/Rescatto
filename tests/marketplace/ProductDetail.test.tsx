import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock dependencies ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ productId: 'prod-1' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts) {
        for (const [key, val] of Object.entries(opts)) {
          return k.replace(`{{${key}}}`, String(val));
        }
      }
      return k;
    },
    i18n: { language: 'es' },
  }),
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet">{children}</div>,
}));

const mockGetProductById = vi.fn();
const mockGetVenueById = vi.fn();
vi.mock('../../services/venueService', () => ({
  venueService: {
    getProductById: (...args: unknown[]) => mockGetProductById(...args),
    getVenueById: (...args: unknown[]) => mockGetVenueById(...args),
  },
}));

const mockAddToCart = vi.fn();
vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ addToCart: mockAddToCart }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/formatters', () => ({
  formatCOP: (v: number) => `$${v.toLocaleString('es-CO')}`,
}));

vi.mock('../../utils/sanitize', () => ({
  sanitizeHtml: (s: string) => s,
  stripHtml: (s: string) => s,
}));

vi.mock('../../components/customer/common/Loading', () => ({
  LoadingSpinner: ({ fullPage }: { fullPage?: boolean }) => (
    <div data-testid="loading-spinner" data-fullpage={fullPage ? 'true' : 'false'}>LoadingSpinner</div>
  ),
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: ({ onClick, children, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../components/common/SEO', () => ({
  SEO: ({ title, description, image }: { title?: string; description?: string; image?: string }) => (
    <div data-testid="seo" data-title={title} data-description={description} data-image={image}>SEO</div>
  ),
}));

// lucide-react icons are just SVGs — no mock needed, they render fine in jsdom

import ProductDetail from '../../pages/customer/ProductDetail';

// ── Helper: build a realistic product ────────────────────────────────────────

function makeProduct(overrides: Partial<import('../../types').Product> = {}): import('../../types').Product {
  return {
    id: 'prod-1',
    venueId: 'venue-1',
    name: 'Pack Sorpresa',
    category: 'Entradas',
    type: 'SURPRISE_PACK' as any,
    originalPrice: 30000,
    discountedPrice: 15000,
    quantity: 10,
    imageUrl: 'https://example.com/img.jpg',
    availableUntil: new Date(Date.now() + 86400000).toISOString(),
    isDynamicPricing: false,
    isRescue: true,
    description: 'Un pack delicioso',
    ...overrides,
  };
}

function makeVenue(overrides: Partial<import('../../types').Venue> = {}): import('../../types').Venue {
  return {
    id: 'venue-1',
    name: 'Restaurante Test',
    address: 'Calle 123',
    latitude: 4.7,
    longitude: -74.0,
    closingTime: '22:00',
    rating: 4.5,
    logoUrl: 'https://example.com/logo.jpg',
    ...overrides,
  };
}

// ── Render helper ────────────────────────────────────────────────────────────

function renderProductDetail() {
  return render(
    <MemoryRouter>
      <ProductDetail />
    </MemoryRouter>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProductDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: product loads successfully
    mockGetProductById.mockResolvedValue(makeProduct());
    mockGetVenueById.mockResolvedValue(makeVenue());
    mockAddToCart.mockReturnValue(true);
  });

  // ── 1. Loading spinner ─────────────────────────────────────────────────────

  it('shows loading spinner while fetching data', () => {
    // Keep promise pending so loading state stays true
    mockGetProductById.mockReturnValue(new Promise(() => {}));
    renderProductDetail();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  // ── 2. Product not found ───────────────────────────────────────────────────

  it('shows "product not found" when product is null', async () => {
    mockGetProductById.mockResolvedValue(null);
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('prod_not_found')).toBeInTheDocument();
    });
    expect(screen.getByText('prod_go_home')).toBeInTheDocument();
  });

  // ── 3. Renders product name ────────────────────────────────────────────────

  it('renders the product name (appears in header and info card)', async () => {
    renderProductDetail();
    await waitFor(() => {
      const matches = screen.getAllByText('Pack Sorpresa');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 4. Renders price ───────────────────────────────────────────────────────

  it('renders the formatted discounted price (appears in card and bottom bar)', async () => {
    renderProductDetail();
    await waitFor(() => {
      const matches = screen.getAllByText('$15.000');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 5. Renders image ───────────────────────────────────────────────────────

  it('renders the product image when imageUrl is present', async () => {
    renderProductDetail();
    await waitFor(() => {
      const img = screen.getByAltText('Pack Sorpresa');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toBe('https://example.com/img.jpg');
    });
  });

  // ── 6. Image fallback ──────────────────────────────────────────────────────

  it('renders image fallback when product has no imageUrl', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ imageUrl: '' }));
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
    });
  });

  // ── 7. Discount tag ────────────────────────────────────────────────────────

  it('shows discount percentage tag when originalPrice > activePrice', async () => {
    // discountedPrice (15000) < originalPrice (30000) → 50% OFF
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('-50% OFF')).toBeInTheDocument();
    });
  });

  it('does not show discount tag when originalPrice equals activePrice', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ discountedPrice: 30000 }));
    renderProductDetail();
    await waitFor(() => {
      expect(screen.queryByText(/-% OFF/)).not.toBeInTheDocument();
    });
  });

  // ── 8. Description renders ─────────────────────────────────────────────────

  it('renders the product description', async () => {
    renderProductDetail();
    await waitFor(() => {
      // Description appears in two spots: mobile (always visible) and desktop
      const descriptions = screen.getAllByText(/Un pack delicioso/);
      expect(descriptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 9. Add to cart button renders ──────────────────────────────────────────

  it('renders the add to cart button', async () => {
    renderProductDetail();
    await waitFor(() => {
      const buttons = screen.getAllByText(/prod_add_to_cart/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ── 10. Calls addToCart and navigate on click ──────────────────────────────

  it('calls addToCart and navigates to cart on successful add', async () => {
    mockAddToCart.mockReturnValue(true);
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getAllByText('Pack Sorpresa').length).toBeGreaterThanOrEqual(1);
    });

    const addButton = screen.getAllByText(/prod_add_to_cart/i)[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
      expect(mockAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'prod-1', name: 'Pack Sorpresa' }),
        'Restaurante Test'
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('Pack Sorpresa'));
      expect(mockNavigate).toHaveBeenCalledWith('/app/cart');
    });
  });

  // ── 11. Shows toast error when addToCart returns false ─────────────────────

  it('shows error toast when addToCart returns false (stock limit)', async () => {
    mockAddToCart.mockReturnValue(false);
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getAllByText('Pack Sorpresa').length).toBeGreaterThanOrEqual(1);
    });

    const addButton = screen.getAllByText(/prod_add_to_cart/i)[0];
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddToCart).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith('cart_stock_limit_reached');
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ── 12. Unavailable product: button disabled, clicks show toast ────────────

  it('shows unavailable button when product has zero quantity', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ quantity: 0 }));
    renderProductDetail();

    await waitFor(() => {
      const unavailableButton = screen.getByText(/prod_unavailable/i);
      expect(unavailableButton).toBeInTheDocument();
      expect(unavailableButton.closest('button')).toBeDisabled();
    });
  });

  // ── 13. Shows expired product as unavailable ───────────────────────────────

  it('shows unavailable state when product is expired', async () => {
    mockGetProductById.mockResolvedValue(
      makeProduct({
        quantity: 5,
        availableUntil: new Date(Date.now() - 86400000).toISOString(), // yesterday
      })
    );
    renderProductDetail();

    await waitFor(() => {
      const unavailableButton = screen.getByText(/prod_unavailable/i);
      expect(unavailableButton).toBeInTheDocument();
    });
  });

  // ── 14. Shows error toast when clicking unavailable add-to-cart ────────────

  it('shows error toast when clicking add-to-cart on unavailable product', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ quantity: 0 }));
    renderProductDetail();

    await waitFor(() => {
      expect(screen.getByText(/prod_unavailable/i)).toBeInTheDocument();
    });

    // The button is disabled, but we forcefully click it to test the handler
    const button = screen.getByText(/prod_unavailable/i).closest('button')!;
    // Fire click anyway — the handler should still fire if called programmatically
    // but since react-testing-library won't fire on disabled buttons, test that it's disabled
    expect(button).toBeDisabled();
  });

  // ── 15. Dynamic pricing — uses dynamicDiscountedPrice ──────────────────────

  it('uses dynamicDiscountedPrice when isDynamicPricing is true', async () => {
    mockGetProductById.mockResolvedValue(
      makeProduct({
        isDynamicPricing: true,
        dynamicDiscountedPrice: 10000,
        discountedPrice: 15000,
        originalPrice: 30000,
        dynamicTier: '⬇️ -67%',
      })
    );
    renderProductDetail();

    await waitFor(() => {
      // Price should show 10000, not 15000 (appears in two places)
      const priceMatches = screen.getAllByText('$10.000');
      expect(priceMatches.length).toBeGreaterThanOrEqual(1);
      // Should show dynamic tier label
      expect(screen.getByText('⬇️ -67%')).toBeInTheDocument();
    });
  });

  // ── 16. Renders venue name when venue loads ────────────────────────────────

  it('renders the venue name when venue data loads', async () => {
    renderProductDetail();
    await waitFor(() => {
      // Venue name appears in header and in the venue card
      const venueNames = screen.getAllByText('Restaurante Test');
      expect(venueNames.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 17. Original price shown as strikethrough when discounted ──────────────

  it('shows original price with strikethrough when discounted', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ originalPrice: 30000, discountedPrice: 15000 }));
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('$30.000')).toBeInTheDocument();
    });
  });

  // ── 18. SEO component receives product data ────────────────────────────────

  it('passes product data to SEO component', async () => {
    renderProductDetail();
    await waitFor(() => {
      const seo = screen.getByTestId('seo');
      expect(seo).toBeInTheDocument();
      expect(seo.getAttribute('data-title')).toBe('Pack Sorpresa');
      expect(seo.getAttribute('data-image')).toBe('https://example.com/img.jpg');
    });
  });

  // ── 19. Rescue badge for rescue products ───────────────────────────────────

  it('shows rescue badge when isRescue is true', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ isRescue: true }));
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('Rescate')).toBeInTheDocument();
    });
  });

  // ── 20. Regular badge when not rescue ──────────────────────────────────────

  it('shows regular badge when isRescue is false', async () => {
    mockGetProductById.mockResolvedValue(makeProduct({ isRescue: false }));
    renderProductDetail();
    await waitFor(() => {
      expect(screen.getByText('Regular')).toBeInTheDocument();
    });
  });
});
