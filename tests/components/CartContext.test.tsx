import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { CartProvider, useCart } from '../../context/CartContext';
import { ProductType } from '../../types';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123' } })
}));

const mockProduct = {
  id: 'prod-1',
  venueId: 'venue-1',
  name: 'Combo Sorpresa',
  type: ProductType.SURPRISE_PACK,
  originalPrice: 30000,
  discountedPrice: 15000,
  quantity: 5,
  imageUrl: 'https://example.com/img.jpg',
  availableUntil: '2026-12-31T23:59:59Z',
  isDynamicPricing: false,
};

const mockProduct2 = {
  ...mockProduct,
  id: 'prod-2',
  name: 'Plato Especial',
  discountedPrice: 20000,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should start with empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(result.current.getTotalItems()).toBe(0);
    expect(result.current.getTotalPrice()).toBe(0);
  });

  it('should add product to cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct, 'Restaurante Test');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('Combo Sorpresa');
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.getTotalItems()).toBe(1);
  });

  it('should increment quantity when adding existing product', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
      result.current.addToCart(mockProduct);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.getTotalItems()).toBe(2);
  });

  it('should remove product from cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
    });
    act(() => {
      result.current.removeFromCart('prod-1');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('should update quantity correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
    });
    act(() => {
      result.current.updateQuantity('prod-1', 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.getTotalItems()).toBe(5);
  });

  it('should remove item when quantity set to 0', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
    });
    act(() => {
      result.current.updateQuantity('prod-1', 0);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('should remove item when quantity set to negative', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
    });
    act(() => {
      result.current.updateQuantity('prod-1', -1);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('should calculate total price correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct); // 15000
      result.current.addToCart(mockProduct2); // 20000
    });

    // 15000 * 1 + 20000 * 1 = 35000
    expect(result.current.getTotalPrice()).toBe(35000);
  });

  it('should clear cart and remove from localStorage', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
      result.current.addToCart(mockProduct2);
    });
    act(() => {
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    // After clearCart(), useEffect re-runs and saves '[]' to localStorage
    // The cart state is empty, which is what matters
    const stored = localStorage.getItem('cart');
    expect(stored === null || stored === '[]').toBe(true);
  });

  it('should group items by venue correctly', () => {
    const productFromVenue2 = { ...mockProduct2, id: 'prod-3', venueId: 'venue-2' };
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct); // venue-1
      result.current.addToCart(mockProduct2); // venue-1
      result.current.addToCart(productFromVenue2); // venue-2
    });

    const byVenue = result.current.getCartByVenue();
    expect(byVenue.get('venue-1')).toHaveLength(2);
    expect(byVenue.get('venue-2')).toHaveLength(1);
  });

  it('should persist cart to localStorage', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(mockProduct);
    });

    const stored = localStorage.getItem('cart');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Combo Sorpresa');
  });

  it('should throw error when useCart is used outside CartProvider', () => {
    expect(() => renderHook(() => useCart())).toThrow(
      'useCart debe ser usado dentro de CartProvider'
    );
  });
});
