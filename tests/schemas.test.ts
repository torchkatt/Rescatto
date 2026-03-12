import { describe, it, expect } from 'vitest';
import { VenueSchema, ProductSchema, CartItemSchema } from '../schemas';

describe('VenueSchema', () => {
  const validVenue = {
    id: 'venue1',
    name: 'Test Venue',
    address: 'Calle 1',
    latitude: 4.6,
    longitude: -74.1,
    closingTime: '22:00',
    rating: 4.5,
  };

  it('accepts a valid venue', () => {
    expect(VenueSchema.safeParse(validVenue).success).toBe(true);
  });

  it('rejects venue without required fields', () => {
    expect(VenueSchema.safeParse({ id: 'x' }).success).toBe(false);
  });

  it('accepts venue with optional fields', () => {
    const result = VenueSchema.safeParse({ ...validVenue, city: 'Bogotá', ownerId: 'uid1' });
    expect(result.success).toBe(true);
  });

  it('preserves extra fields via passthrough', () => {
    const result = VenueSchema.safeParse({ ...validVenue, customField: 'ok' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customField).toBe('ok');
    }
  });
});

describe('ProductSchema', () => {
  const validProduct = {
    id: 'prod1',
    venueId: 'venue1',
    name: 'Pack Sorpresa',
    type: 'SURPRISE_PACK',
    originalPrice: 20000,
    discountedPrice: 12000,
    quantity: 5,
    availableUntil: '2026-03-15T22:00:00.000Z',
    isDynamicPricing: false,
  };

  it('accepts a valid product', () => {
    expect(ProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rejects product with negative quantity', () => {
    expect(ProductSchema.safeParse({ ...validProduct, quantity: -1 }).success).toBe(false);
  });

  it('defaults imageUrl to empty string', () => {
    const result = ProductSchema.safeParse(validProduct);
    if (result.success) {
      expect(result.data.imageUrl).toBe('');
    }
  });

  it('rejects invalid product type', () => {
    expect(ProductSchema.safeParse({ ...validProduct, type: 'INVALID' }).success).toBe(false);
  });
});

describe('CartItemSchema', () => {
  const validItem = {
    id: 'prod1',
    venueId: 'venue1',
    name: 'Pack Sorpresa',
    price: 12000,
    originalPrice: 20000,
    quantity: 2,
  };

  it('accepts a valid cart item', () => {
    expect(CartItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('rejects cart item with zero quantity', () => {
    expect(CartItemSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false);
  });

  it('rejects cart item without price', () => {
    const { price, ...noPriceItem } = validItem;
    expect(CartItemSchema.safeParse(noPriceItem).success).toBe(false);
  });

  it('defaults imageUrl to empty string', () => {
    const result = CartItemSchema.safeParse(validItem);
    if (result.success) {
      expect(result.data.imageUrl).toBe('');
    }
  });
});
