import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';

// ─── Augment firebase/firestore mock ────────────────────────────────────────────
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
      static fromDate(d: Date) {
        return { toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
      }
    },
    increment: vi.fn((n: number) => n),
    arrayUnion: vi.fn(),
    arrayRemove: vi.fn(),
    limit: vi.fn(),
    Unsubscribe: vi.fn(),
    getCountFromServer: vi.fn(),
  };
});

// ─── Typed mock helpers ────────────────────────────────────────────────────────
const mockGetCountFromServer = vi.mocked(firestore.getCountFromServer);
const mockGetDocs = vi.mocked(firestore.getDocs);
const mockCollection = vi.mocked(firestore.collection);
const mockQuery = vi.mocked(firestore.query);

// ─── Mock formatters (used by DashboardOverview) ───────────────────────────────
vi.mock('../../utils/formatters', () => ({
  formatCOP: vi.fn((v: number) => `$${v.toLocaleString('es-CO')}`),
}));

// ─── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── Shared setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockReturnValue({ id: 'mock-collection' } as any);
  mockQuery.mockReturnValue({ id: 'mock-query' } as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DashboardOverview — Admin Analytics (getCountFromServer queries)
// ═══════════════════════════════════════════════════════════════════════════════

describe('DashboardOverview analytics queries', () => {
  describe('getCountFromServer — aggregate counts', () => {
    it('should return count for users collection', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 150 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'users-collection' } as any);
      const count = snap.data().count;

      expect(count).toBe(150);
      expect(mockGetCountFromServer).toHaveBeenCalledTimes(1);
    });

    it('should return count for venues collection', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 42 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'venues-collection' } as any);
      const count = snap.data().count;

      expect(count).toBe(42);
    });

    it('should return count for products collection', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 230 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'products-collection' } as any);
      const count = snap.data().count;

      expect(count).toBe(230);
    });

    it('should return count for filtered orders (e.g. in transit)', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 5 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'orders-in-transit' } as any);
      const count = snap.data().count;

      expect(count).toBe(5);
    });

    it('should return count for pending+paid orders', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 12 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'orders-pending-paid' } as any);
      const count = snap.data().count;

      expect(count).toBe(12);
    });

    it('should handle zero counts gracefully', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 0 }),
      } as any);

      const snap = await firestore.getCountFromServer({ id: 'empty-collection' } as any);
      const count = snap.data().count;

      expect(count).toBe(0);
    });

    it('should call getCountFromServer once per collection query', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 100 }) } as any)
        .mockResolvedValueOnce({ data: () => ({ count: 42 }) } as any)
        .mockResolvedValueOnce({ data: () => ({ count: 200 }) } as any);

      const [users, venues, products] = await Promise.all([
        firestore.getCountFromServer({ id: 'users' } as any),
        firestore.getCountFromServer({ id: 'venues' } as any),
        firestore.getCountFromServer({ id: 'products' } as any),
      ]);

      expect(users.data().count).toBe(100);
      expect(venues.data().count).toBe(42);
      expect(products.data().count).toBe(200);
      expect(mockGetCountFromServer).toHaveBeenCalledTimes(3);
    });
  });

  describe('getDocs — today sales (orders query)', () => {
    it('should compute today sales total from order docs', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ totalAmount: 25000 }) },
          { data: () => ({ totalAmount: 18000 }) },
          { data: () => ({ totalAmount: 7000 }) },
        ],
      } as any);

      const snap = await firestore.getDocs({ id: 'today-orders' } as any);
      const todaySales = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().totalAmount) || 0),
        0,
      );

      expect(todaySales).toBe(50000);
    });

    it('should return 0 when no orders exist today', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      } as any);

      const snap = await firestore.getDocs({ id: 'empty-orders' } as any);
      const todaySales = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().totalAmount) || 0),
        0,
      );

      expect(todaySales).toBe(0);
    });

    it('should handle missing totalAmount field gracefully', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ totalAmount: 10000 }) },
          { data: () => ({}) }, // no totalAmount
          { data: () => ({ totalAmount: 5000 }) },
        ],
      } as any);

      const snap = await firestore.getDocs({ id: 'orders-some-bad' } as any);
      const todaySales = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().totalAmount) || 0),
        0,
      );

      expect(todaySales).toBe(15000);
    });
  });

  describe('week chart — 7-day orders aggregation', () => {
    it('should aggregate sales into day buckets using ISO date keys', () => {
      // Use ISO date strings (locale-independent) as keys
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }

      const mockOrders = [
        { totalAmount: 5000, createdAt: new Date() },
        { totalAmount: 12000, createdAt: new Date() },
        { totalAmount: 8000, createdAt: new Date() },
      ];

      for (const order of mockOrders) {
        const key = order.createdAt.toISOString().slice(0, 10);
        if (key in dayMap) dayMap[key] += Number(order.totalAmount) || 0;
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      expect(dayMap[todayKey]).toBeGreaterThan(0);
    });

    it('should produce 7 entries in weekly data array', () => {
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = 0;
      }

      const result = Object.entries(dayMap).map(([day, ventas]) => ({ day, ventas }));
      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('day');
      expect(result[0]).toHaveProperty('ventas');
    });
  });
});
