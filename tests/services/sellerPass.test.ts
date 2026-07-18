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
    },
    increment: vi.fn((n: number) => n),
    arrayUnion: vi.fn(),
    arrayRemove: vi.fn(),
    limit: vi.fn(),
    Unsubscribe: vi.fn(),
  };
});

// ─── Mock firebase/functions ───────────────────────────────────────────────────
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockHttpsCallable),
  getFunctions: vi.fn(),
}));

// ─── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── Mock firebase service ─────────────────────────────────────────────────────
vi.mock('../../services/firebase', () => ({
  db: {},
  functions: {},
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  storage: {},
}));

// ─── Mock sellerService (getById) used by sellerPassService.getCurrentPlan ─────
vi.mock('../../services/sellerService', () => ({
  sellerService: {
    getById: vi.fn(),
  },
}));

// ─── Typed mock helpers ───────────────────────────────────────────────────────
const mockGetDoc = vi.mocked(firestore.getDoc);
const mockDoc = vi.mocked(firestore.doc);

// ─── Imports ───────────────────────────────────────────────────────────────────
import { SELLER_PASS_PLANS, SellerPassPlan } from '../../types';
import { sellerPassService } from '../../services/sellerPassService';
import { sellerService } from '../../services/sellerService';

// ─── Shared setup ──────────────────────────────────────────────────────────────
const mockGetById = vi.mocked(sellerService.getById);

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockReturnValue({ id: 'mock-id' } as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SELLER_PASS_PLANS constant
// ═══════════════════════════════════════════════════════════════════════════════

describe('SELLER_PASS_PLANS', () => {
  it('should be an array with 2 plans', () => {
    expect(SELLER_PASS_PLANS).toHaveLength(2);
  });

  it('should have monthly plan with correct properties', () => {
    const monthly = SELLER_PASS_PLANS.find((p) => p.id === 'seller_pass_monthly');
    expect(monthly).toBeDefined();
    expect(monthly!.name).toBe('Seller Pass Mensual');
    expect(monthly!.price).toBe(49900);
    expect(monthly!.period).toBe('monthly');
    expect(monthly!.commissionRate).toBe(0.05);
    expect(monthly!.features).toContain('5% comisión en ventas');
    expect(monthly!.features).toContain('Listings destacados');
    expect(monthly!.features).toContain('Analytics avanzados');
    expect(monthly!.features).toContain('Soporte prioritario');
    expect(monthly!.features).toHaveLength(4);
  });

  it('should have annual plan with correct properties', () => {
    const annual = SELLER_PASS_PLANS.find((p) => p.id === 'seller_pass_annual');
    expect(annual).toBeDefined();
    expect(annual!.name).toBe('Seller Pass Anual');
    expect(annual!.price).toBe(499900);
    expect(annual!.period).toBe('annual');
    expect(annual!.commissionRate).toBe(0.05);
    expect(annual!.features).toContain('Badge verificado');
    expect(annual!.features).toHaveLength(5);
  });

  it('should have valid commission rates (0–1 range)', () => {
    for (const plan of SELLER_PASS_PLANS) {
      expect(plan.commissionRate).toBeGreaterThan(0);
      expect(plan.commissionRate).toBeLessThan(1);
    }
  });

  it('should have unique plan ids', () => {
    const ids = SELLER_PASS_PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have all required fields in each plan', () => {
    const requiredFields: (keyof SellerPassPlan)[] = [
      'id',
      'name',
      'price',
      'features',
      'period',
      'commissionRate',
    ];
    for (const plan of SELLER_PASS_PLANS) {
      for (const field of requiredFields) {
        expect(plan[field]).toBeDefined();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  sellerPassService
// ═══════════════════════════════════════════════════════════════════════════════

describe('sellerPassService', () => {
  describe('getAvailablePlans', () => {
    it('should return SELLER_PASS_PLANS', () => {
      const plans = sellerPassService.getAvailablePlans();
      expect(plans).toBe(SELLER_PASS_PLANS);
      expect(plans).toHaveLength(2);
    });

    it('should include both monthly and annual plans', () => {
      const plans = sellerPassService.getAvailablePlans();
      const ids = plans.map((p) => p.id);
      expect(ids).toContain('seller_pass_monthly');
      expect(ids).toContain('seller_pass_annual');
    });
  });

  describe('getCurrentPlan', () => {
    it('should return the monthly plan when seller has seller_pass_monthly subscription', async () => {
      mockGetById.mockResolvedValueOnce({
        id: 'seller-1',
        name: 'Premium Shop',
        subscription: 'seller_pass_monthly',
        ownerId: 'owner-1',
        type: 'retail',
        location: { city: 'Bogotá', lat: 4.6, lng: -74.1, address: 'Calle 1' },
        stats: { totalTransactions: 10, totalRevenue: 50000 },
        isActive: true,
      });

      const plan = await sellerPassService.getCurrentPlan('seller-1');

      expect(plan).not.toBeNull();
      expect(plan!.id).toBe('seller_pass_monthly');
      expect(plan!.name).toBe('Seller Pass Mensual');
      expect(plan!.period).toBe('monthly');
      expect(plan!.price).toBe(49900);
      expect(mockGetById).toHaveBeenCalledWith('seller-1');
    });

    it('should return the annual plan when seller has seller_pass_annual subscription', async () => {
      mockGetById.mockResolvedValueOnce({
        id: 'seller-2',
        name: 'Elite Shop',
        subscription: 'seller_pass_annual',
        ownerId: 'owner-2',
        type: 'service',
        location: { city: 'Medellín', lat: 6.2, lng: -75.5, address: 'Carrera 2' },
        stats: { totalTransactions: 100, totalRevenue: 1000000 },
        isActive: true,
      });

      const plan = await sellerPassService.getCurrentPlan('seller-2');

      expect(plan).not.toBeNull();
      expect(plan!.id).toBe('seller_pass_annual');
      expect(plan!.name).toBe('Seller Pass Anual');
      expect(plan!.period).toBe('annual');
      expect(plan!.price).toBe(499900);
      expect(mockGetById).toHaveBeenCalledWith('seller-2');
    });

    it('should return null when seller has free subscription', async () => {
      mockGetById.mockResolvedValueOnce({
        id: 'seller-3',
        name: 'Free Shop',
        subscription: 'free',
        ownerId: 'owner-3',
        type: 'food',
        location: { city: 'Cali', lat: 3.4, lng: -76.5, address: 'Avenida 3' },
        stats: { totalTransactions: 5, totalRevenue: 20000 },
        isActive: true,
      });

      const plan = await sellerPassService.getCurrentPlan('seller-3');

      // 'free' is not in SELLER_PASS_PLANS, so it should return null
      expect(plan).toBeNull();
    });

    it('should return null when seller does not exist', async () => {
      mockGetById.mockResolvedValueOnce(null);

      const plan = await sellerPassService.getCurrentPlan('nonexistent');

      expect(plan).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetById.mockRejectedValueOnce(new Error('Firestore error'));

      const plan = await sellerPassService.getCurrentPlan('seller-error');

      expect(plan).toBeNull();
    });
  });

  describe('upgradePlan', () => {
    it('should return success true on successful upgrade', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { success: true },
      });

      const result = await sellerPassService.upgradePlan('seller-1', 'seller_pass_monthly');

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.id).toBe('seller_pass_monthly');
      expect(result.error).toBeUndefined();
    });

    it('should return success false with error on failure', async () => {
      mockHttpsCallable.mockRejectedValueOnce(new Error('Insufficient funds'));

      const result = await sellerPassService.upgradePlan('seller-2', 'seller_pass_annual');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
      // plan is not included in error path (see source)
      expect(result.plan).toBeUndefined();
    });

    it('should pass sellerId and planId to cloud function', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { success: true },
      });

      await sellerPassService.upgradePlan('seller-3', 'seller_pass_annual');

      expect(mockHttpsCallable).toHaveBeenCalledWith({
        sellerId: 'seller-3',
        planId: 'seller_pass_annual',
      });
    });
  });
});
