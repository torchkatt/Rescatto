import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataService } from '../../services/dataService';
import * as firestore from 'firebase/firestore';
import { OrderStatus, ProductType } from '../../types';

const mockGetDoc = vi.mocked(firestore.getDoc);
const mockGetDocs = vi.mocked(firestore.getDocs);
const mockAddDoc = vi.mocked(firestore.addDoc);
const mockUpdateDoc = vi.mocked(firestore.updateDoc);
const mockDeleteDoc = vi.mocked(firestore.deleteDoc);
const mockDoc = vi.mocked(firestore.doc);
const mockCollection = vi.mocked(firestore.collection);
const mockQuery = vi.mocked(firestore.query);
const mockOnSnapshot = vi.mocked(firestore.onSnapshot);

describe('dataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'mock-id' } as any);
    mockCollection.mockReturnValue({ id: 'mock-collection' } as any);
    mockQuery.mockReturnValue({ id: 'mock-query' } as any);
  });

  // --- VENUE TESTS ---
  describe('getVenue', () => {
    it('should return venue when document exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'venue-1',
        data: () => ({
          name: 'Restaurante Test',
          address: 'Calle 123',
          latitude: 4.6,
          longitude: -74.1,
          closingTime: '22:00',
          phone: '3001234567',
          rating: 4.5,
        }),
      } as any);

      const venue = await dataService.getVenue('venue-1');

      expect(venue).not.toBeNull();
      expect(venue?.name).toBe('Restaurante Test');
      expect(venue?.rating).toBe(4.5);
    });

    it('should return null when venue does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      } as any);

      const venue = await dataService.getVenue('nonexistent');
      expect(venue).toBeNull();
    });
  });

  // --- PRODUCT TESTS ---
  describe('getProducts', () => {
    it('should return array of products for a venue', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'prod-1',
            data: () => ({
              venueId: 'venue-1',
              name: 'Combo Sorpresa',
              type: ProductType.SURPRISE_PACK,
              originalPrice: 30000,
              discountedPrice: 15000,
              quantity: 5,
              imageUrl: 'https://example.com/img.jpg',
              availableUntil: '2026-12-31T23:59:59Z',
              isDynamicPricing: false,
            }),
          },
        ],
      } as any);

      const products = await dataService.getProducts('venue-1');

      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Combo Sorpresa');
      expect(products[0].discountedPrice).toBe(15000);
    });

    it('should return empty array when no products', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const products = await dataService.getProducts('empty-venue');
      expect(products).toHaveLength(0);
    });
  });

  describe('createProduct', () => {
    it('should create product and return it with generated id', async () => {
      mockAddDoc.mockResolvedValueOnce({ id: 'new-prod-id' } as any);

      const product = await dataService.createProduct({
        venueId: 'venue-1',
        name: 'Nuevo Producto',
        type: ProductType.SPECIFIC_DISH,
        originalPrice: 20000,
        discountedPrice: 12000,
        quantity: 3,
        imageUrl: 'https://example.com/img.jpg',
        availableUntil: '2026-12-31T23:59:59Z',
        isDynamicPricing: false,
      });

      expect(product.id).toBe('new-prod-id');
      expect(product.name).toBe('Nuevo Producto');
      expect(mockAddDoc).toHaveBeenCalledOnce();
    });
  });

  describe('updateProductStock', () => {
    it('should update stock successfully with valid quantity', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await expect(dataService.updateProductStock('prod-1', 10)).resolves.toBeUndefined();
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
    });

    it('should throw error when quantity is negative', async () => {
      await expect(dataService.updateProductStock('prod-1', -5)).rejects.toThrow(
        'Cantidad inválida: el stock no puede ser negativo'
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should throw error when quantity is NaN', async () => {
      await expect(dataService.updateProductStock('prod-1', NaN)).rejects.toThrow(
        'Cantidad inválida: debe ser un número válido'
      );
    });
  });

  describe('adjustProductStock', () => {
    it('should adjust stock atomically', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await expect(dataService.adjustProductStock('prod-1', -2)).resolves.toBeUndefined();
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
    });

    it('should throw error when delta is NaN', async () => {
      await expect(dataService.adjustProductStock('prod-1', NaN)).rejects.toThrow(
        'Delta inválido: debe ser un número válido'
      );
    });
  });

  describe('deleteProduct', () => {
    it('should call deleteDoc with correct ref', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await dataService.deleteProduct('prod-1');
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await dataService.updateOrderStatus('order-1', OrderStatus.IN_PREPARATION);
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
    });
  });

  // --- ORDER SUBSCRIPTION TESTS ---
  describe('subscribeToOrders', () => {
    it('should return unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const unsubscribe = dataService.subscribeToOrders('venue-1', vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return empty unsubscribe when venueId array is empty', () => {
      const callback = vi.fn();
      const unsubscribe = dataService.subscribeToOrders([], callback);

      expect(callback).toHaveBeenCalledWith([]);
      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should use in-query for array of venueIds', () => {
      const mockUnsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      dataService.subscribeToOrders(['venue-1', 'venue-2'], vi.fn());
      expect(mockOnSnapshot).toHaveBeenCalledOnce();
    });
  });

  // --- ANALYTICS TESTS ---
  // getAnalytics uses an O(1) approach: reads pre-computed stats from the venue doc,
  // not from querying individual orders.
  describe('getAnalytics', () => {
    it('should return revenue and meals from venue stats', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'venue-1',
        data: () => ({
          name: 'Restaurante Test',
          address: 'Calle 123',
          latitude: 4.6,
          longitude: -74.1,
          closingTime: '22:00',
          rating: 4.5,
          stats: {
            totalRevenue: 50000,
            mealsSaved: 1,
          },
        }),
      } as any);

      const analytics = await dataService.getAnalytics('venue-1');

      expect(analytics.revenue).toBe(50000);
      expect(analytics.mealsSaved).toBe(1);
      expect(analytics.wasteSavedKg).toBe(0.5); // mealsSaved * 0.5
    });

    it('should return zero metrics when no orders', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'empty-venue',
        data: () => ({ name: 'Empty', address: '', latitude: 0, longitude: 0, closingTime: '22:00', rating: 0 }),
      } as any);

      const analytics = await dataService.getAnalytics('empty-venue');
      expect(analytics.revenue).toBe(0);
      expect(analytics.mealsSaved).toBe(0);
    });
  });
});
