import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';

// ─── Mock writeBatch + startAfter (not in setup.ts global mock) ────────────────
// We augment the firebase/firestore mock already created by tests/setup.ts.
// vitest hoists vi.mock so this will take effect before any imports.
vi.mock('firebase/firestore', async () => {
  // Import the setup.ts mock (which is the currently active mock)
  // Since setup.ts already mocked without importOriginal, we rebuild the full mock
  const mod = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    // Keep the functions that setup.ts provides
    ...mod,
    // Add the ones missing from setup.ts mocks
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      update: vi.fn(),
    })),
    startAfter: vi.fn(),
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    addDoc: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    Timestamp: class FakeTimestamp {
      static now() { return new FakeTimestamp(); }
      toDate() { return new Date(); }
    },
    increment: vi.fn((n: number) => n),
    arrayUnion: vi.fn(),
    arrayRemove: vi.fn(),
    limit: vi.fn(),
    Unsubscribe: vi.fn(),
  };
});

// ─── Typed mock helpers ────────────────────────────────────────────────────────
const mockGetDoc = vi.mocked(firestore.getDoc);
const mockGetDocs = vi.mocked(firestore.getDocs);
const mockAddDoc = vi.mocked(firestore.addDoc);
const mockUpdateDoc = vi.mocked(firestore.updateDoc);
const mockDeleteDoc = vi.mocked(firestore.deleteDoc);
const mockDoc = vi.mocked(firestore.doc);
const mockCollection = vi.mocked(firestore.collection);
const mockQuery = vi.mocked(firestore.query);
const mockWriteBatch = vi.mocked(firestore.writeBatch);
const mockStartAfter = vi.mocked(firestore.startAfter);

// ─── Imports ───────────────────────────────────────────────────────────────────
import { categoryService } from '../../services/categoryService';
import { listingService } from '../../services/listingService';
import { sellerService } from '../../services/sellerService';
import { transactionService } from '../../services/transactionService';
import { bookingService } from '../../services/bookingService';
import { migrationService } from '../../services/migrationService';

// ─── Shared setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockReturnValue({ id: 'mock-id' } as any);
  mockCollection.mockReturnValue({ id: 'mock-collection' } as any);
  mockQuery.mockReturnValue({ id: 'mock-query' } as any);
  mockStartAfter.mockReturnValue('mock-cursor' as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  categoryService
// ═══════════════════════════════════════════════════════════════════════════════

describe('categoryService', () => {
  describe('getRootCategories', () => {
    it('should return root categories (parentId === null)', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'cat-1',
            data: () => ({
              name: 'Comida',
              slug: 'comida',
              parentId: null,
              icon: '🍽️',
              level: 0,
              order: 1,
              isActive: true,
              listingAttributes: [],
              stats: { listingCount: 0, transactionCount: 0 },
            }),
          },
          {
            id: 'cat-2',
            data: () => ({
              name: 'Tecnología',
              slug: 'tecnologia',
              parentId: null,
              icon: '💻',
              level: 0,
              order: 2,
              isActive: true,
              listingAttributes: [],
              stats: { listingCount: 0, transactionCount: 0 },
            }),
          },
        ],
      } as any);

      const categories = await categoryService.getRootCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('Comida');
      expect(categories[0].parentId).toBeNull();
      expect(categories[1].name).toBe('Tecnología');
    });

    it('should return empty array when no root categories exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const categories = await categoryService.getRootCategories();

      expect(categories).toHaveLength(0);
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should return empty array on Firestore error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore connection error'));

      const categories = await categoryService.getRootCategories();

      expect(categories).toEqual([]);
    });
  });

  describe('getSubCategories', () => {
    it('should return subcategories for a given parentId', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'sub-1',
            data: () => ({
              name: 'Packs Sorpresa',
              slug: 'packs-sorpresa',
              parentId: 'cat-1',
              icon: '🎁',
              level: 1,
              order: 1,
              isActive: true,
            }),
          },
          {
            id: 'sub-2',
            data: () => ({
              name: 'Platos Específicos',
              slug: 'platos-especificos',
              parentId: 'cat-1',
              icon: '🍝',
              level: 1,
              order: 2,
              isActive: true,
            }),
          },
        ],
      } as any);

      const subs = await categoryService.getSubCategories('cat-1');

      expect(subs).toHaveLength(2);
      expect(subs[0].parentId).toBe('cat-1');
      expect(subs[1].name).toBe('Platos Específicos');
    });

    it('should return empty array when parent has no children', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const subs = await categoryService.getSubCategories('empty-parent');

      expect(subs).toHaveLength(0);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const subs = await categoryService.getSubCategories('cat-1');

      expect(subs).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  listingService
// ═══════════════════════════════════════════════════════════════════════════════

describe('listingService', () => {
  describe('searchListings', () => {
    it('should search listings with a searchTerm', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'listing-1',
            data: () => ({
              title: 'Combo Sorpresa 3 platos',
              sellerId: 'seller-1',
              categoryId: 'cat-food',
              type: 'product',
              price: 15000,
              originalPrice: 30000,
              quantity: 5,
              isActive: true,
            }),
          },
        ],
      } as any);

      const listings = await listingService.searchListings('combo');

      expect(listings).toHaveLength(1);
      expect(listings[0].title).toBe('Combo Sorpresa 3 platos');
    });

    it('should search listings without searchTerm (category filter)', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'listing-1',
            data: () => ({
              title: 'iPhone 14',
              sellerId: 'seller-2',
              categoryId: 'cat-tech',
              type: 'product',
              price: 2000000,
              isActive: true,
            }),
          },
          {
            id: 'listing-2',
            data: () => ({
              title: 'MacBook Air',
              sellerId: 'seller-2',
              categoryId: 'cat-tech',
              type: 'product',
              price: 4500000,
              isActive: true,
            }),
          },
        ],
      } as any);

      const listings = await listingService.searchListings('', {
        categoryId: 'cat-tech',
      });

      expect(listings).toHaveLength(2);
      expect(listings[0].title).toBe('iPhone 14');
    });

    it('should return empty array on Firestore error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const listings = await listingService.searchListings('test');

      expect(listings).toEqual([]);
    });

    it('should return empty array when no results found', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const listings = await listingService.searchListings('nonexistent');

      expect(listings).toHaveLength(0);
    });
  });

  describe('getListingsBySeller', () => {
    it('should return listings for a seller (new + legacy)', async () => {
      // First call: new collection
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'listing-1',
            data: () => ({
              title: 'Nuevo Listing',
              sellerId: 'seller-1',
              price: 25000,
              isActive: true,
            }),
          },
        ],
      } as any);
      // Second call: legacy collection
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const listings = await listingService.getListingsBySeller('seller-1');

      expect(listings.length).toBeGreaterThanOrEqual(1);
      expect(listings[0].title).toBe('Nuevo Listing');
    });

    it('should return legacy listings when new collection is empty', async () => {
      // First call: new collection empty
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);
      // Second call: legacy collection has data
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'prod-legacy',
            data: () => ({
              name: 'Producto Legacy',
              venueId: 'seller-1',
              originalPrice: 40000,
              discountedPrice: 20000,
              quantity: 3,
              availableUntil: '2027-12-31T23:59:59Z',
              imageUrl: 'https://example.com/img.jpg',
              description: 'Desc legacy',
            }),
          },
        ],
      } as any);

      const listings = await listingService.getListingsBySeller('seller-1');

      expect(listings.length).toBeGreaterThanOrEqual(1);
      expect(listings[0].title).toBe('Producto Legacy');
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const listings = await listingService.getListingsBySeller('seller-1');

      expect(listings).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  sellerService
// ═══════════════════════════════════════════════════════════════════════════════

describe('sellerService', () => {
  describe('getById', () => {
    it('should return seller when found in new collection', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'seller-1',
        data: () => ({
          name: 'Tienda Test',
          type: 'food',
          location: { city: 'Bogotá', lat: 4.6, lng: -74.1, address: 'Calle 123' },
          rating: 4.5,
          isActive: true,
          subscription: 'free',
        }),
      } as any);

      const seller = await sellerService.getById('seller-1');

      expect(seller).not.toBeNull();
      expect(seller?.name).toBe('Tienda Test');
      expect(seller?.rating).toBe(4.5);
    });

    it('should fallback to legacy venues when not in sellers', async () => {
      // New collection: not found
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      } as any);
      // Legacy collection: found
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'venue-legacy',
        data: () => ({
          name: 'Venue Legacy',
          ownerId: 'owner-1',
          latitude: 4.7,
          longitude: -74.2,
          address: 'Av Siempre Viva',
          city: 'Bogotá',
          phone: '3001234567',
          rating: 4.2,
          stats: { totalOrders: 100, totalRevenue: 500000 },
        }),
      } as any);

      const seller = await sellerService.getById('venue-legacy');

      expect(seller).not.toBeNull();
      expect(seller?.name).toBe('Venue Legacy');
      expect(seller?.type).toBe('food');
    });

    it('should return null when seller does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);
      mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);

      const seller = await sellerService.getById('nonexistent');

      expect(seller).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const seller = await sellerService.getById('seller-err');

      expect(seller).toBeNull();
    });
  });

  describe('search', () => {
    it('should filter sellers by name', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 's-1',
            data: () => ({
              name: 'Comidas Rápidas El Veloz',
              location: { city: 'Bogotá' },
            }),
          },
          {
            id: 's-2',
            data: () => ({
              name: 'Tecnología Express',
              location: { city: 'Medellín' },
            }),
          },
          {
            id: 's-3',
            data: () => ({
              name: 'Servicios Veloz Hogar',
              location: { city: 'Cali' },
            }),
          },
        ],
      } as any);

      const results = await sellerService.search('veloz');

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Comidas Rápidas El Veloz');
      expect(results[1].name).toBe('Servicios Veloz Hogar');
    });

    it('should filter sellers by city', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 's-1',
            data: () => ({
              name: 'Tienda A',
              location: { city: 'Bogotá' },
            }),
          },
          {
            id: 's-2',
            data: () => ({
              name: 'Tienda B',
              location: { city: 'Medellín' },
            }),
          },
        ],
      } as any);

      const results = await sellerService.search('bogotá');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Tienda A');
    });

    it('should return empty array when no matches', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 's-1',
            data: () => ({ name: 'Tienda X', location: { city: 'Cali' } }),
          },
        ],
      } as any);

      const results = await sellerService.search('zzz_nonexistent_zzz');

      expect(results).toHaveLength(0);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const results = await sellerService.search('anything');

      expect(results).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  transactionService
// ═══════════════════════════════════════════════════════════════════════════════

describe('transactionService', () => {
  describe('getByBuyer', () => {
    it('should return paginated transactions for a buyer', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'txn-1',
            data: () => ({
              buyerId: 'buyer-1',
              sellerId: 'seller-a',
              transactionType: 'purchase',
              status: 'completed',
              lineItems: [{ listingId: 'l-1', quantity: 2, unitPrice: 15000 }],
              totalAmount: 30000,
              subtotal: 30000,
              commission: 3000,
              sellerEarnings: 27000,
              payment: { method: 'wompi', id: 'pay-1', status: 'approved' },
              deliveryMethod: 'pickup',
              createdAt: new Date('2026-07-01').toISOString(),
            }),
          },
          {
            id: 'txn-2',
            data: () => ({
              buyerId: 'buyer-1',
              sellerId: 'seller-b',
              transactionType: 'booking',
              status: 'pending',
              lineItems: [{ listingId: 'l-2', quantity: 1, unitPrice: 50000 }],
              totalAmount: 50000,
              subtotal: 50000,
              commission: 5000,
              sellerEarnings: 45000,
              payment: { method: 'wompi', id: 'pay-2', status: 'pending' },
              deliveryMethod: 'pickup',
              createdAt: new Date('2026-07-15').toISOString(),
            }),
          },
        ],
      } as any);

      const result = await transactionService.getByBuyer('buyer-1');

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].buyerId).toBe('buyer-1');
      expect(result.transactions[0].totalAmount).toBe(30000);
      expect(result.hasMore).toBe(false);
      expect(result.lastDoc).toBeDefined();
    });

    it('should return empty pagination structure when no transactions', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const result = await transactionService.getByBuyer('buyer-empty');

      expect(result.transactions).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('should return hasMore=true when page is full', async () => {
      const docs = Array.from({ length: 20 }, (_, i) => ({
        id: `txn-${i}`,
        data: () => ({
          buyerId: 'buyer-1',
          sellerId: `seller-${i}`,
          transactionType: 'purchase',
          status: 'completed',
          lineItems: [],
          totalAmount: 10000,
          subtotal: 10000,
          commission: 1000,
          sellerEarnings: 9000,
          payment: { method: 'wompi', id: `pay-${i}`, status: 'approved' },
          deliveryMethod: 'pickup',
          createdAt: new Date().toISOString(),
        }),
      }));
      mockGetDocs.mockResolvedValueOnce({ docs } as any);

      const result = await transactionService.getByBuyer('buyer-1', null, 20);

      expect(result.transactions).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('should return empty on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await transactionService.getByBuyer('buyer-err');

      expect(result.transactions).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  bookingService
// ═══════════════════════════════════════════════════════════════════════════════

describe('bookingService', () => {
  describe('getByBuyer', () => {
    it('should return bookings for a buyer', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'book-1',
            data: () => ({
              transactionId: 'txn-1',
              sellerId: 'seller-a',
              buyerId: 'buyer-1',
              listingId: 'listing-1',
              startTime: '2026-08-01T10:00:00Z',
              endTime: '2026-08-01T11:00:00Z',
              status: 'confirmed',
              notes: 'Llevar materiales',
              createdAt: new Date().toISOString(),
            }),
          },
          {
            id: 'book-2',
            data: () => ({
              transactionId: 'txn-2',
              sellerId: 'seller-b',
              buyerId: 'buyer-1',
              listingId: 'listing-2',
              startTime: '2026-08-15T14:00:00Z',
              endTime: '2026-08-15T15:30:00Z',
              status: 'confirmed',
              createdAt: new Date().toISOString(),
            }),
          },
        ],
      } as any);

      const result = await bookingService.getByBuyer('buyer-1');

      expect(result.bookings).toHaveLength(2);
      expect(result.bookings[0].buyerId).toBe('buyer-1');
      expect(result.bookings[0].status).toBe('confirmed');
      expect(result.hasMore).toBe(false);
    });

    it('should return empty array when no bookings exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] } as any);

      const result = await bookingService.getByBuyer('buyer-empty');

      expect(result.bookings).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('should return empty on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await bookingService.getByBuyer('buyer-err');

      expect(result.bookings).toEqual([]);
      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  migrationService
// ═══════════════════════════════════════════════════════════════════════════════

describe('migrationService', () => {
  describe('migrateVenuesToSellers (venueToSeller adapter)', () => {
    it('should handle venue with undefined fields gracefully', async () => {
      // Venue with many missing/undefined fields
      const venueData = {
        id: 'venue-incomplete',
        name: 'Venue Incompleto',
        // ownerId is undefined → should default to ''
        // latitude is undefined → should default to 0
        // longitude is undefined → should default to 0
        // address is undefined → should default to ''
        // city is undefined → should default to ''
        // neighborhood is undefined → should default to ''
        // logoUrl and imageUrl are undefined → logo should default to ''
        // phone is undefined → should default to ''
        // rating is undefined → should default to 0
        // stats is undefined → should default to 0
      };

      mockGetDocs
        // First call: get venues
        .mockResolvedValueOnce({
          docs: [
            { id: 'venue-incomplete', data: () => venueData },
          ],
        } as any)
        // Second call: get existing sellers (empty, nothing to skip)
        .mockResolvedValueOnce({ docs: [] } as any);

      const batchMock = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        update: vi.fn(),
      };
      mockWriteBatch.mockReturnValue(batchMock as any);

      const result = await migrationService.migrateVenuesToSellers();

      // Should have migrated 1 and skipped 0
      expect(result.total).toBe(1);
      expect(result.migrated).toBe(1);
      expect(result.skipped).toBe(0);

      // Verify batch.set was called with correctly defaulted values
      expect(batchMock.set).toHaveBeenCalledTimes(1);
      const [_ref, sellerData] = batchMock.set.mock.calls[0];

      // Check that undefined venue fields produce sensible seller defaults
      expect(sellerData.name).toBe('Venue Incompleto');
      expect(sellerData.ownerId).toBe('');
      expect(sellerData.location.lat).toBe(0);
      expect(sellerData.location.lng).toBe(0);
      expect(sellerData.location.address).toBe('');
      expect(sellerData.location.city).toBe('');
      expect(sellerData.location.neighborhood).toBe('');
      expect(sellerData.logo).toBe('');
      expect(sellerData.contact.phone).toBe('');
      expect(sellerData.rating).toBe(0);
      expect(sellerData.stats.totalTransactions).toBe(0);
      expect(sellerData.stats.totalRevenue).toBe(0);
    });

    it('should skip venues that already exist as sellers', async () => {
      mockGetDocs
        // First call: get venues
        .mockResolvedValueOnce({
          docs: [
            { id: 'venue-existing', data: () => ({ name: 'Already Migrated' }) },
            { id: 'venue-new', data: () => ({ name: 'New Venue' }) },
          ],
        } as any)
        // Second call: existing sellers includes venue-existing
        .mockResolvedValueOnce({
          docs: [
            { id: 'venue-existing' },
          ],
        } as any);

      const batchMock = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        update: vi.fn(),
      };
      mockWriteBatch.mockReturnValue(batchMock as any);

      const result = await migrationService.migrateVenuesToSellers();

      expect(result.total).toBe(2);
      expect(result.migrated).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('migrateProductsToListings (productToListing adapter)', () => {
    it('should handle product with missing fields gracefully', async () => {
      // Product with many missing fields
      const productData = {
        id: 'prod-incomplete',
        name: 'Producto Incompleto',
        // venueId is undefined → should default to ''
        // description is undefined → should default to ''
        // imageUrl is undefined → images should be []
        // originalPrice is undefined → should default to 0
        // discountedPrice is undefined → price should default to 0
        // quantity is undefined → should default to 0, isActive should be false
        // availableUntil is undefined → should default to ''
        // dietaryTags is undefined → should default to []
        // tags is undefined → should default to []
      };

      mockGetDocs
        // Call 1: pagination loop — getDocs(query(collection(db, 'products'), limit(500)))
        .mockResolvedValueOnce({
          docs: [
            { id: 'prod-incomplete', data: () => productData },
          ],
        } as any)
        // Call 2: pagination loop — allSnaps (same query)
        .mockResolvedValueOnce({
          docs: [
            { id: 'prod-incomplete', data: () => productData },
          ],
        } as any)
        // Call 3: fullSnap — getDocs(collection(db, 'products'))
        .mockResolvedValueOnce({
          docs: [
            { id: 'prod-incomplete', data: () => productData },
          ],
        } as any)
        // Call 4: get existing listings — getDocs(query(collection(db, 'listings'), limit(1000)))
        .mockResolvedValueOnce({ docs: [] } as any);

      const batchMock = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        update: vi.fn(),
      };
      mockWriteBatch.mockReturnValue(batchMock as any);

      const result = await migrationService.migrateProductsToListings();

      expect(result.total).toBe(1);
      expect(result.migrated).toBe(1);
      expect(result.skipped).toBe(0);

      // Verify batch.set was called with correctly defaulted values
      expect(batchMock.set).toHaveBeenCalledTimes(1);
      const [_ref, listingData] = batchMock.set.mock.calls[0];

      expect(listingData.sellerId).toBe('');
      expect(listingData.title).toBe('Producto Incompleto');
      expect(listingData.description).toBe('');
      expect(listingData.images).toEqual([]);
      expect(listingData.price).toBe(0);
      expect(listingData.originalPrice).toBe(0);
      expect(listingData.quantity).toBe(0);
      expect(listingData.isActive).toBe(false);
      expect(listingData.attributes.allergens).toEqual([]);
      expect(listingData.attributes.expiresAt).toBe('');
    });

    it('should skip products that already exist as listings', async () => {
      const productData = { name: 'Already Migrated', venueId: 'v1' };
      mockGetDocs
        // Call 1: pagination loop — getDocs(query(collection(db, 'products'), limit(500)))
        .mockResolvedValueOnce({ docs: [{ id: 'prod-existing', data: () => productData }] } as any)
        // Call 2: pagination loop — allSnaps
        .mockResolvedValueOnce({ docs: [{ id: 'prod-existing', data: () => productData }] } as any)
        // Call 3: fullSnap — getDocs(collection(db, 'products'))
        .mockResolvedValueOnce({ docs: [{ id: 'prod-existing', data: () => productData }] } as any)
        // Call 4: existing listings — already exists
        .mockResolvedValueOnce({ docs: [{ id: 'prod-existing' }] } as any);

      const batchMock = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        update: vi.fn(),
      };
      mockWriteBatch.mockReturnValue(batchMock as any);

      const result = await migrationService.migrateProductsToListings();

      expect(result.total).toBe(1);
      expect(result.migrated).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
