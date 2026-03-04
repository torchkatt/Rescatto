import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWompiSignature } from '../../services/paymentService';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('paymentService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getWompiSignature', () => {
    it('should return signature data on successful response', async () => {
      const mockResponse = {
        signature: 'ABC123',
        reference: 'ORDER-001',
        amountInCents: 5000000,
        currency: 'COP',
        publicKey: 'pub_test_key',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getWompiSignature('ORDER-001', 50000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/generateWompiSignature'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: 'ORDER-001', amount: 50000, currency: 'COP' }),
        })
      );
      expect(result.signature).toBe('ABC123');
      expect(result.reference).toBe('ORDER-001');
      expect(result.amountInCents).toBe(5000000);
    });

    it('should use custom currency when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signature: 'XYZ',
          reference: 'REF-002',
          amountInCents: 1000000,
          currency: 'USD',
          publicKey: 'pub_test',
        }),
      });

      await getWompiSignature('REF-002', 10000, 'USD');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ reference: 'REF-002', amount: 10000, currency: 'USD' }),
        })
      );
    });

    it('should return mock signature in DEV when backend is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      // In DEV mode (mocked in setup.ts), should return mock data
      const result = await getWompiSignature('REF-003', 25000);

      expect(result.signature).toMatch(/^mock_signature_/);
      expect(result.reference).toBe('REF-003');
      expect(result.amountInCents).toBe(2500000);
      expect(result.currency).toBe('COP');
    });

    it('should call the API URL from environment variable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signature: 'sig',
          reference: 'REF-004',
          amountInCents: 100000,
          currency: 'COP',
          publicKey: 'pub_test',
        }),
      });

      await getWompiSignature('REF-004', 1000);

      // Should call the URL defined in VITE_API_URL env var (set in setup.ts)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/generateWompiSignature'),
        expect.any(Object)
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getWompiSignature('REF-005', 10000)).rejects.toThrow('Network Error');
    });
  });
});
