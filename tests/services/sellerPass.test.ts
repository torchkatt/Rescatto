import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({ db: {}, functions: {}, auth: {} }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

vi.mock('../../services/sellerService', () => ({
  sellerService: { getById: vi.fn() },
}));

vi.mock('../../services/planService', () => ({
  planService: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'free', name: 'Gratuito', price: 0, period: 'monthly', commissionRate: 0.10, features: [] },
      { id: 'seller_pass_monthly', name: 'Seller Pass Mensual', price: 49900, period: 'monthly', commissionRate: 0.05, features: [] },
      { id: 'seller_pass_annual', name: 'Seller Pass Anual', price: 499900, period: 'annual', commissionRate: 0.05, features: [] },
    ]),
    getById: vi.fn().mockImplementation((id) => {
      const plans: Record<string, any> = {
        free: { id: 'free', name: 'Gratuito', price: 0, period: 'monthly', commissionRate: 0.10, features: [] },
        seller_pass_monthly: { id: 'seller_pass_monthly', name: 'Seller Pass Mensual', price: 49900, period: 'monthly', commissionRate: 0.05, features: [] },
        seller_pass_annual: { id: 'seller_pass_annual', name: 'Seller Pass Anual', price: 499900, period: 'annual', commissionRate: 0.05, features: [] },
      };
      return Promise.resolve(plans[id] || null);
    }),
  },
}));

import { sellerPassService } from '../../services/sellerPassService';
import { sellerService } from '../../services/sellerService';

const mockGetById = vi.mocked(sellerService.getById);

const mockSeller = {
  id: 'seller-1', name: 'Test Seller', type: 'food', categoryIds: [],
  ownerId: 'user-1', location: { lat: 0, lng: 0, address: '', city: '' },
  contact: { phone: '' }, rating: 0, stats: { totalTransactions: 0, totalRevenue: 0 },
  isActive: true, subscription: 'seller_pass_monthly', commissionRate: 0.05, createdAt: '',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('sellerPassService', () => {
  describe('getAvailablePlans', () => {
    it('should return plans from planService', async () => {
      const plans = await sellerPassService.getAvailablePlans();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCurrentPlan', () => {
    it('should return a plan when seller has a subscription', async () => {
      mockGetById.mockResolvedValue(mockSeller);
      const result = await sellerPassService.getCurrentPlan('seller-1');
      expect(result).not.toBeNull();
    });

    it('should return the free plan when seller has free subscription', async () => {
      mockGetById.mockResolvedValue({ ...mockSeller, subscription: 'free', commissionRate: 0.10 });
      const result = await sellerPassService.getCurrentPlan('seller-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('free');
    });

    it('should return null when seller is not found', async () => {
      mockGetById.mockResolvedValue(null);
      const result = await sellerPassService.getCurrentPlan('seller-1');
      expect(result).toBeNull();
    });
  });

  describe('upgradePlan', () => {
    it('should return success true on successful upgrade', async () => {
      const mockCallable = vi.fn().mockResolvedValue({ data: { success: true } });
      const { httpsCallable } = await import('firebase/functions');
      vi.mocked(httpsCallable).mockReturnValue(mockCallable as any);
      const result = await sellerPassService.upgradePlan('seller-1', 'seller_pass_monthly');
      expect(result.success).toBe(true);
    });
  });
});