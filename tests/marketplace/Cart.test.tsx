import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es', changeLanguage: vi.fn() } }),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/productAvailability', () => ({
  isProductExpired: vi.fn(() => false),
}));

vi.mock('../../utils/formatters', () => ({
  formatCOP: vi.fn((v: number) => `$${v.toLocaleString('es-CO')}`),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), showToast: vi.fn() }),
}));

vi.mock('../../context/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../../components/customer/common/Countdown', () => ({
  Countdown: (props: any) => <span data-testid="countdown">{props.targetDate}</span>,
}));

vi.mock('../../components/customer/common/Button', () => ({
  Button: (props: any) => <button data-testid="checkout-btn" onClick={props.onClick} disabled={props.isLoading}>{props.children}</button>,
}));

const mockCartContext = {
  items: [],
  removeFromCart: vi.fn(),
  updateQuantity: vi.fn(),
  getTotalPrice: vi.fn(() => 0),
  getTotalItems: vi.fn(() => 0),
  getCartByVenue: vi.fn(() => []),
  addToCart: vi.fn(),
  clearCart: vi.fn(),
};

vi.mock('../../context/CartContext', () => ({
  useCart: () => mockCartContext,
  CartProvider: ({ children }: any) => children,
}));

import { Cart } from '../../pages/customer/Cart';

describe('Cart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartContext.items = [];
    mockCartContext.getCartByVenue.mockReturnValue([]);
    mockCartContext.getTotalPrice.mockReturnValue(0);
    mockCartContext.getTotalItems.mockReturnValue(0);
  });

  const renderCart = () => render(<MemoryRouter><Cart /></MemoryRouter>);

  it('shows empty cart message when no items', () => {
    renderCart();
    expect(screen.getByText('cart_empty')).toBeInTheDocument();
  });

  it('shows back button that navigates to home', () => {
    renderCart();
    expect(screen.getByText('cart_keep_exploring')).toBeInTheDocument();
  });

  it('shows explore deals button in empty state', () => {
    renderCart();
    expect(screen.getByText('cart_view_deals')).toBeInTheDocument();
  });

  it('shows my impact link in empty state', () => {
    renderCart();
    expect(screen.getByText('cart_my_impact')).toBeInTheDocument();
  });

  it('renders venue groups when items exist', () => {
    const items = [
      { id: 'p1', name: 'Pan de yuca', venueId: 'v1', venueName: 'Panadería El Pan', originalPrice: 5000, discountedPrice: 3000, quantity: 2, availableUntil: new Date(Date.now() + 86400000).toISOString() },
    ];
    mockCartContext.items = items;
    const venueMap = new Map();
    venueMap.set('v1', items);
    mockCartContext.getCartByVenue.mockReturnValue(venueMap);
    mockCartContext.getTotalItems.mockReturnValue(1);
    renderCart();
    expect(screen.getByText(/Panadería El Pan/)).toBeInTheDocument();
    expect(screen.getByText('Pan de yuca')).toBeInTheDocument();
  });

  it('shows item quantity controls', () => {
    const items = [
      { id: 'p1', name: 'Pan de yuca', venueId: 'v1', venueName: 'Panadería El Pan', originalPrice: 5000, discountedPrice: 3000, quantity: 2, availableUntil: new Date(Date.now() + 86400000).toISOString() },
    ];
    mockCartContext.items = items;
    const venueMap = new Map();
    venueMap.set('v1', items);
    mockCartContext.getCartByVenue.mockReturnValue(venueMap);
    mockCartContext.getTotalItems.mockReturnValue(1);
    renderCart();
    expect(screen.getByText('Pan de yuca')).toBeInTheDocument();
  });
});
