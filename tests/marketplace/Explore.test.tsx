import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProductType } from '../../types';

// ---------------------------------------------------------------------------
// Mocks — all factories inline (no top-level const refs)
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'results_found') return `${opts?.count || 0} resultados`;
      return key;
    },
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../context/LocationContext', () => ({
  useLocation: () => ({ latitude: null, longitude: null, city: null, setCity: vi.fn() }),
}));

vi.mock('../../services/venueService', () => ({
  venueService: { getAllVenues: vi.fn() },
}));

vi.mock('../../services/productService', () => ({
  productService: { getAllActiveProductsPage: vi.fn(), searchProducts: vi.fn() },
}));

vi.mock('../../services/categoryService', () => ({
  categoryService: { getCategoryTree: vi.fn() },
}));

vi.mock('../../services/locationService', () => ({
  calculateDistance: vi.fn(() => 2.5),
}));

vi.mock('../../utils/venueAvailability', () => ({
  isVenueOpen: vi.fn(() => true),
}));

vi.mock('../../components/customer/home/PackCard', () => ({
  PackCard: (props: any) => <div data-testid={`pack-card-${props.product.id}`}>{props.product.name}</div>,
}));

vi.mock('../../components/ui/FilterChip', () => {
  const FilterChip = (props: any) => {
    const { value, children, isSelected, onClick, disabled } = props;
    const testKey = value || String(children || '').toLowerCase().replace(/\s+/g, '-');
    return (
      <button data-testid={`filter-chip-${testKey}`} data-selected={isSelected ? 'true' : 'false'} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  };
  const Group = ({ children, value, onChange, className }: any) => (
    <div data-testid="filter-chip-group" className={className}>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              isSelected: child.props.value === value,
              onClick: child.props.onClick || (() => onChange?.(child.props.value)),
            })
          : child
      )}
    </div>
  );
  FilterChip.Group = Group;
  return { FilterChip };
});

vi.mock('../../components/ui/EmptyState', () => ({
  EmptyState: (props: any) => <div data-testid="empty-state">{props.title}</div>,
}));

vi.mock('../../components/ui/SectionHeader', () => ({
  SectionHeader: (props: any) => <div data-testid="section-header">{props.title}</div>,
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: (props: any) => <button data-testid="load-more-btn" onClick={props.onClick} disabled={props.isLoading}>{props.children}</button>,
}));

vi.mock('../../components/common/SEO', () => ({
  SEO: () => null,
}));

import { venueService } from '../../services/venueService';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';

const mockVenueService = vi.mocked(venueService);
const mockProductService = vi.mocked(productService);
const mockCategoryService = vi.mocked(categoryService);

const mockVenues = [
  { id: 'v1', name: 'Panadería El Pan', latitude: 4.6, longitude: -74.1, city: 'Bogotá', category: 'comida', isActive: true, isOpenNow: true },
  { id: 'v2', name: 'Carnicería Don Pepe', latitude: 4.7, longitude: -74.08, city: 'Bogotá', category: 'comida', isActive: true, isOpenNow: true },
];

const mockProducts = [
  { id: 'p1', name: 'Pan de yuca', venueId: 'v1', originalPrice: 5000, discountedPrice: 3000, dynamicDiscountedPrice: null, type: ProductType.SPECIFIC_DISH, category: 'comida', isActive: true, isRescue: true, quantity: 10, availableUntil: new Date(Date.now() + 86400000).toISOString(), imageUrl: 'https://example.com/pan.jpg', description: 'Delicioso pan de yuca', searchKeywords: ['pan', 'yuca'] },
  { id: 'p2', name: 'Carne de res', venueId: 'v2', originalPrice: 25000, discountedPrice: 18000, dynamicDiscountedPrice: null, type: ProductType.SPECIFIC_DISH, category: 'comida', isActive: true, isRescue: false, quantity: 5, availableUntil: new Date(Date.now() + 86400000).toISOString(), imageUrl: '', description: 'Carne de res fresca', searchKeywords: ['carne', 'res'] },
];

import Explore from '../../pages/customer/Explore';

describe('Explore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVenueService.getAllVenues.mockResolvedValue(mockVenues);
    mockProductService.getAllActiveProductsPage.mockResolvedValue({ products: mockProducts, lastDoc: null, hasMore: false });
    mockProductService.searchProducts.mockResolvedValue(mockProducts);
    mockCategoryService.getCategoryTree.mockResolvedValue([]);
  });

  const renderExplore = (initialPath = '/app/explore') => render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Explore />
    </MemoryRouter>
  );

  it('shows loading skeleton initially', () => {
    mockProductService.getAllActiveProductsPage.mockReturnValue(new Promise(() => {}));
    renderExplore();
    expect(screen.getByTestId('explore-skeleton')).toBeInTheDocument();
  });

  it('renders the page title', async () => {
    renderExplore();
    await waitFor(() => expect(screen.getByText('explore_title')).toBeInTheDocument());
  });

  it('renders search input with placeholder', async () => {
    renderExplore();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
    });
  });

  it('renders products in grid after loading', async () => {
    renderExplore();
    await waitFor(() => {
      expect(screen.getByTestId('pack-card-p1')).toBeInTheDocument();
      expect(screen.getByTestId('pack-card-p2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no products', async () => {
    mockProductService.getAllActiveProductsPage.mockResolvedValue({ products: [], lastDoc: null, hasMore: false });
    renderExplore();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows category pills when categories loaded', async () => {
    mockCategoryService.getCategoryTree.mockResolvedValue([
      { id: 'cat-food', name: 'Comida', slug: 'comida', icon: '🍽️', parentId: null, order: 1, children: [] },
    ]);
    renderExplore();
    await vi.waitFor(() => {
      const btns = screen.queryAllByRole('button');
      const comidaBtn = btns.find(b => b.textContent?.includes('Comida'));
      expect(comidaBtn).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows sort dropdown with price options', async () => {
    renderExplore();
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.innerHTML).toContain('price-asc');
      expect(select.innerHTML).toContain('price-desc');
    });
  });

  it('shows clear filters button when search is active via URL', async () => {
    renderExplore('/app/explore?q=pan');
    await waitFor(() => {
      expect(screen.getByText(/clear_filters/i)).toBeInTheDocument();
    });
  });

  it('search input shows URL q param value', async () => {
    renderExplore('/app/explore?q=pan');
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/buscar/i) as HTMLInputElement;
      expect(input.value).toBe('pan');
    });
  });
});
