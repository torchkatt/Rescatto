import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/firebase', () => ({ functions: {} }));
vi.mock('firebase/functions');

import { httpsCallable } from 'firebase/functions';
import { getWompiSignature } from '../../services/paymentService';

describe('paymentService', () => {
  const mockHttpsCallable = vi.fn();

  beforeEach(() => {
    mockHttpsCallable.mockReset();
    vi.mocked(httpsCallable).mockReturnValue(mockHttpsCallable as any);
  });

  describe('getWompiSignature', () => {
    it('should return signature data on successful response', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: {
          signature: 'ABC123',
          reference: 'ORDER-001',
          amountInCents: 5000000,
          currency: 'COP',
        },
      });

      const result = await getWompiSignature('ORDER-001', 50000);

      expect(mockHttpsCallable).toHaveBeenCalledWith({
        reference: 'ORDER-001', amount: 50000, currency: 'COP',
      });
      expect(result.signature).toBe('ABC123');
      expect(result.reference).toBe('ORDER-001');
      expect(result.amountInCents).toBe(5000000);
    });

    it('should use custom currency when provided', async () => {
      mockHttpsCallable.mockResolvedValueOnce({
        data: { signature: 'XYZ', reference: 'REF-002', amountInCents: 1000000, currency: 'USD' },
      });

      await getWompiSignature('REF-002', 10000, 'USD');

      expect(mockHttpsCallable).toHaveBeenCalledWith({
        reference: 'REF-002', amount: 10000, currency: 'USD',
      });
    });

    it('should throw descriptive error when backend is unreachable', async () => {
      mockHttpsCallable.mockRejectedValueOnce(new Error('Network Error'));
      const result = getWompiSignature('REF-005', 10000);
      await expect(result).rejects.toThrow(/backend de pagos|no está disponible/);
    });
  });
});
