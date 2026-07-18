import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';

// ─── Augment firebase/firestore mock (mirrors marketplace.test.ts pattern) ──────
vi.mock('firebase/firestore', async () => {
  const mod = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...mod,
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
const mockDoc = vi.mocked(firestore.doc);
const mockCollection = vi.mocked(firestore.collection);
const mockQuery = vi.mocked(firestore.query);

// ─── Import service under test ─────────────────────────────────────────────────
import { sellerService } from '../../services/sellerService';

// ─── Shared setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockReturnValue({ id: 'mock-id' } as any);
  mockCollection.mockReturnValue({ id: 'mock-collection' } as any);
  mockQuery.mockReturnValue({ id: 'mock-query' } as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  sellerService — Onboarding
// ═══════════════════════════════════════════════════════════════════════════════

describe('sellerService — onboarding', () => {
  describe('create', () => {
    it('should create a Firestore doc and return a seller with id', async () => {
      mockAddDoc.mockResolvedValueOnce({
        id: 'new-seller-123',
      } as any);

      const result = await sellerService.create({
        name: 'Mi Negocio',
        type: 'retail' as any,
        categoryIds: ['cat-1'],
        ownerId: 'owner-abc',
        location: {
          lat: 4.6,
          lng: -74.1,
          address: 'Calle 123 #45-67',
          city: 'Bogotá',
        },
        contact: { phone: '3001234567' },
        rating: 0,
        isActive: true,
        subscription: 'free',
        stats: { totalTransactions: 0, totalRevenue: 0 },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('new-seller-123');
      expect(result.name).toBe('Mi Negocio');
      expect(result.ownerId).toBe('owner-abc');
      expect(result.location.city).toBe('Bogotá');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);

      // Verify the Firestore payload includes defaults
      const addDocCallArgs = mockAddDoc.mock.calls[0];
      expect(addDocCallArgs[0]).toEqual({ id: 'mock-collection' }); // collection ref
      const payload = addDocCallArgs[1];
      expect(payload.name).toBe('Mi Negocio');
      expect(payload.ownerId).toBe('owner-abc');
      expect(payload.subscription).toBe('free');
      expect(payload.isActive).toBe(true);
      expect(payload.rating).toBe(0);
      expect(payload.stats).toEqual({ totalTransactions: 0, totalRevenue: 0 });
    });

    it('should apply defaults for stats, rating, isActive, and subscription when omitted', async () => {
      mockAddDoc.mockResolvedValueOnce({
        id: 'seller-defaults',
      } as any);

      const result = await sellerService.create({
        name: 'Minimal Shop',
        type: 'food' as any,
        categoryIds: [],
        ownerId: 'owner-xyz',
        location: {
          lat: 0,
          lng: 0,
          address: 'Somewhere',
          city: 'Cali',
        },
        contact: {},
        rating: undefined as any,
        isActive: undefined as any,
        subscription: undefined as any,
        stats: undefined as any,
      });

      expect(result.id).toBe('seller-defaults');

      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload.stats).toEqual({ totalTransactions: 0, totalRevenue: 0 });
      expect(payload.rating).toBe(0);
      expect(payload.isActive).toBe(true);
      expect(payload.subscription).toBe('free');
    });

    it('should propagate Firestore errors', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(sellerService.create({
        name: 'Fail Shop',
        type: 'food' as any,
        categoryIds: [],
        ownerId: 'owner-fail',
        location: { lat: 0, lng: 0, address: 'X', city: 'X' },
        contact: {},
      })).rejects.toThrow('Permission denied');
    });
  });

  describe('getByOwner', () => {
    it('should return sellers belonging to the given owner', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'seller-a',
            data: () => ({
              name: 'Shop A',
              ownerId: 'owner-1',
              type: 'food',
              location: { city: 'Bogotá', lat: 4.6, lng: -74.1, address: 'Calle 1' },
              rating: 4.5,
              isActive: true,
              subscription: 'free',
              stats: { totalTransactions: 10, totalRevenue: 50000 },
            }),
          },
          {
            id: 'seller-b',
            data: () => ({
              name: 'Shop B',
              ownerId: 'owner-1',
              type: 'retail',
              location: { city: 'Medellín', lat: 6.2, lng: -75.5, address: 'Carrera 2' },
              rating: 3.8,
              isActive: true,
              subscription: 'seller_pass_monthly',
              stats: { totalTransactions: 25, totalRevenue: 200000 },
            }),
          },
        ],
      } as any);

      const results = await sellerService.getByOwner('owner-1');

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Shop A');
      expect(results[0].ownerId).toBe('owner-1');
      expect(results[1].name).toBe('Shop B');
      expect(results[1].subscription).toBe('seller_pass_monthly');
    });

    it('should return empty array when owner has no sellers', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      } as any);

      const results = await sellerService.getByOwner('owner-no-sellers');

      expect(results).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      const results = await sellerService.getByOwner('owner-error');

      expect(results).toEqual([]);
    });
  });
});
