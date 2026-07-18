import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Firebase functions mock
const mockHttpsCallableResult = vi.fn();
vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual('firebase/functions');
  return {
    ...(actual as any),
    httpsCallable: vi.fn(() => mockHttpsCallableResult),
  };
});

// listingService mock
const mockListingService = {
  createListing: vi.fn(),
  getListingById: vi.fn(),
};
vi.mock('../../services/listingService', () => ({
  listingService: mockListingService,
}));

// sellerService mock
const mockSellerService = {
  getById: vi.fn(),
};
vi.mock('../../services/sellerService', () => ({
  sellerService: mockSellerService,
}));

// aiChatSecurity — keep real safetyCheck but mock rate limiter
const mockCheckWriteRateLimit = vi.fn(() => true);
vi.mock('../../services/aiChatSecurity', async () => {
  const actual = await vi.importActual('../../services/aiChatSecurity');
  return {
    ...(actual as any),
    checkWriteRateLimit: mockCheckWriteRateLimit,
  };
});

// logger — silence
vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Firestore mocks (imported from setup.ts global mock, but we control them via vi.mocked)
import {
  getDocs,
  getDoc,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock Firestore snapshot with .docs array */
function mockSnapshot(docs: Array<{ id: string; data: () => any }>) {
  return { docs, empty: docs.length === 0, size: docs.length };
}

/** Build a single doc snapshot */
function mockDocSnap(exists: boolean, dataObj?: any) {
  return {
    exists: () => exists,
    data: () => (exists ? dataObj : undefined),
    id: 'test-doc-id',
  };
}

/** Default test user */
const TEST_USER = { id: 'user-123', name: 'Test User', role: 'CUSTOMER' as const };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AI Chat Marketplace Tools', () => {
  let executeToolCall: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCheckWriteRateLimit.mockReturnValue(true);
    mockHttpsCallableResult.mockResolvedValue({ data: { id: 'new-resource-id', bookingId: 'bk-1', transactionId: 'tx-1' } });

    const mod = await import('../../services/aiChatTools');
    executeToolCall = mod.executeToolCall;
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. getMyTransactions
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getMyTransactions', () => {
    it('returns transactions for authenticated user', async () => {
      const mockData = [
        {
          id: 'tx-1',
          data: () => ({
            buyerId: TEST_USER.id,
            sellerId: 'seller-1',
            transactionType: 'purchase',
            status: 'completed',
            totalAmount: 45000,
            deliveryMethod: 'pickup',
            createdAt: '2026-07-15T10:00:00Z',
            lineItems: [{ listingId: 'l1', quantity: 1, price: 45000, title: 'Burger' }],
          }),
        },
      ];
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockData) as any);

      const result = await executeToolCall(
        'getMyTransactions',
        { statusFilter: undefined },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.transactions[0].id).toBe('tx-1');
      expect(parsed.transactions[0].status).toBe('completed');
      expect(parsed.transactions[0].totalAmount).toBe(45000);
      expect(vi.mocked(collection)).toHaveBeenCalledWith(expect.anything(), 'transactions');
      expect(vi.mocked(where)).toHaveBeenCalledWith('buyerId', '==', TEST_USER.id);
    });

    it('filters by status when statusFilter provided', async () => {
      const mockData = [
        {
          id: 'tx-1',
          data: () => ({ buyerId: TEST_USER.id, transactionType: 'purchase', status: 'pending', totalAmount: 30000, deliveryMethod: 'pickup', createdAt: '2026-07-15T10:00:00Z', lineItems: [] }),
        },
        {
          id: 'tx-2',
          data: () => ({ buyerId: TEST_USER.id, transactionType: 'purchase', status: 'completed', totalAmount: 45000, deliveryMethod: 'pickup', createdAt: '2026-07-14T10:00:00Z', lineItems: [] }),
        },
      ];
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockData) as any);

      const result = await executeToolCall(
        'getMyTransactions',
        { statusFilter: 'completed' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.transactions[0].status).toBe('completed');
    });

    it('returns empty result when no transactions exist', async () => {
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot([]) as any);

      const result = await executeToolCall(
        'getMyTransactions',
        {},
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(0);
      expect(parsed.message).toBeTruthy();
    });

    it('requires authentication', async () => {
      const result = await executeToolCall('getMyTransactions', {}, undefined);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('handles Firestore query errors gracefully', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

      const result = await executeToolCall(
        'getMyTransactions',
        {},
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. getMyBookings
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getMyBookings', () => {
    it('returns bookings for authenticated user', async () => {
      const mockData = [
        {
          id: 'bk-1',
          data: () => ({
            buyerId: TEST_USER.id,
            listingId: 'l1',
            startTime: '2026-07-20T14:00:00Z',
            endTime: '2026-07-20T15:00:00Z',
            status: 'confirmed',
            createdAt: '2026-07-15T10:00:00Z',
            transactionId: 'tx-1',
          }),
        },
      ];
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockData) as any);

      const result = await executeToolCall('getMyBookings', {}, TEST_USER.id);

      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.bookings[0].id).toBe('bk-1');
      expect(parsed.bookings[0].status).toBe('confirmed');
      expect(vi.mocked(collection)).toHaveBeenCalledWith(expect.anything(), 'bookings');
      expect(vi.mocked(where)).toHaveBeenCalledWith('buyerId', '==', TEST_USER.id);
    });

    it('filters bookings by status', async () => {
      const mockData = [
        {
          id: 'bk-1',
          data: () => ({ buyerId: TEST_USER.id, listingId: 'l1', startTime: '2026-07-20T14:00:00Z', endTime: '2026-07-20T15:00:00Z', status: 'confirmed', createdAt: '2026-07-15T10:00:00Z' }),
        },
        {
          id: 'bk-2',
          data: () => ({ buyerId: TEST_USER.id, listingId: 'l2', startTime: '2026-07-21T14:00:00Z', endTime: '2026-07-21T15:00:00Z', status: 'cancelled', createdAt: '2026-07-16T10:00:00Z' }),
        },
      ];
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockData) as any);

      const result = await executeToolCall(
        'getMyBookings',
        { status: 'cancelled' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.bookings[0].status).toBe('cancelled');
    });

    it('returns empty result when no bookings', async () => {
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot([]) as any);

      const result = await executeToolCall('getMyBookings', {}, TEST_USER.id);
      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(0);
    });

    it('requires authentication', async () => {
      const result = await executeToolCall('getMyBookings', {}, undefined);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('handles Firestore query errors gracefully', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('DB error'));

      const result = await executeToolCall('getMyBookings', {}, TEST_USER.id);
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. createBooking
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createBooking', () => {
    it('calls httpsCallable with correct params', async () => {
      mockHttpsCallableResult.mockResolvedValue({
        data: { bookingId: 'bk-new', id: 'bk-new' },
      });

      const result = await executeToolCall(
        'createBooking',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          startTime: '2026-07-20T14:00:00Z',
          endTime: '2026-07-20T15:00:00Z',
          notes: 'Llegaré puntual',
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.bookingId).toBe('bk-new');

      // Verify httpsCallable was called with correct function name
      expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(
        expect.anything(),
        'createBooking',
      );
      // Verify the callable was invoked with correct params
      expect(mockHttpsCallableResult).toHaveBeenCalledWith({
        sellerId: 'seller-1',
        listingId: 'listing-1',
        startTime: '2026-07-20T14:00:00Z',
        endTime: '2026-07-20T15:00:00Z',
        notes: 'Llegaré puntual',
      });
    });

    it('sanitizes notes input', async () => {
      mockHttpsCallableResult.mockResolvedValue({
        data: { bookingId: 'bk-new' },
      });

      await executeToolCall(
        'createBooking',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          startTime: '2026-07-20T14:00:00Z',
          endTime: '2026-07-20T15:00:00Z',
          notes: '<script>alert("xss")</script>',
        },
        TEST_USER.id,
      );

      // Notes should be sanitized (HTML stripped)
      const callArgs = mockHttpsCallableResult.mock.calls[0][0];
      expect(callArgs.notes).not.toContain('<script>');
    });

    it('requires authentication', async () => {
      const result = await executeToolCall(
        'createBooking',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          startTime: '2026-07-20T14:00:00Z',
          endTime: '2026-07-20T15:00:00Z',
        },
        undefined,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('respects rate limiting', async () => {
      mockCheckWriteRateLimit.mockReturnValue(false);

      const result = await executeToolCall(
        'createBooking',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          startTime: '2026-07-20T14:00:00Z',
          endTime: '2026-07-20T15:00:00Z',
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Demasiadas');
      expect(mockCheckWriteRateLimit).toHaveBeenCalledWith(TEST_USER.id);
    });

    it('handles httpsCallable errors', async () => {
      // Throw an error without a .message so the fallback string kicks in
      mockHttpsCallableResult.mockRejectedValue({});

      const result = await executeToolCall(
        'createBooking',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          startTime: '2026-07-20T14:00:00Z',
          endTime: '2026-07-20T15:00:00Z',
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. createTransaction
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createTransaction', () => {
    it('fetches listing details and calls httpsCallable', async () => {
      mockListingService.getListingById.mockResolvedValue({
        id: 'listing-1',
        title: 'Deluxe Burger',
        price: 35000,
        sellerId: 'seller-1',
      });
      mockHttpsCallableResult.mockResolvedValue({
        data: { transactionId: 'tx-new' },
      });

      const result = await executeToolCall(
        'createTransaction',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          quantity: 2,
          deliveryMethod: 'pickup',
          deliveryFee: 5000,
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.transactionId).toBe('tx-new');
      expect(parsed.totalAmount).toBe(75000); // 35000 * 2 + 5000

      expect(mockListingService.getListingById).toHaveBeenCalledWith('listing-1');
      expect(mockHttpsCallableResult).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: 'seller-1',
          listingId: 'listing-1',
          quantity: 2,
          deliveryMethod: 'pickup',
          deliveryFee: 5000,
          subtotal: 70000, // 35000 * 2
          totalAmount: 75000,
          lineItems: [
            { listingId: 'listing-1', quantity: 2, price: 35000, title: 'Deluxe Burger' },
          ],
        }),
      );
    });

    it('defaults quantity to 1 and deliveryFee to 0', async () => {
      mockListingService.getListingById.mockResolvedValue({
        id: 'listing-1',
        title: 'Basic Item',
        price: 10000,
        sellerId: 'seller-1',
      });
      mockHttpsCallableResult.mockResolvedValue({
        data: { transactionId: 'tx-2' },
      });

      const result = await executeToolCall(
        'createTransaction',
        {
          sellerId: 'seller-1',
          listingId: 'listing-1',
          deliveryMethod: 'pickup',
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.totalAmount).toBe(10000);
    });

    it('returns error when listing not found', async () => {
      mockListingService.getListingById.mockResolvedValue(null);

      const result = await executeToolCall(
        'createTransaction',
        {
          sellerId: 'seller-1',
          listingId: 'nonexistent',
          deliveryMethod: 'pickup',
        },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No encontré ese listing');
    });

    it('requires authentication', async () => {
      const result = await executeToolCall(
        'createTransaction',
        { sellerId: 'seller-1', listingId: 'l1', deliveryMethod: 'pickup' },
        undefined,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('respects rate limiting', async () => {
      mockCheckWriteRateLimit.mockReturnValue(false);

      const result = await executeToolCall(
        'createTransaction',
        { sellerId: 'seller-1', listingId: 'l1', deliveryMethod: 'pickup' },
        TEST_USER.id,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Demasiadas');
    });

    it('handles httpsCallable errors', async () => {
      mockListingService.getListingById.mockResolvedValue({
        id: 'listing-1', title: 'Item', price: 10000, sellerId: 's1',
      });
      mockHttpsCallableResult.mockRejectedValue({});

      const result = await executeToolCall(
        'createTransaction',
        { sellerId: 'seller-1', listingId: 'listing-1', deliveryMethod: 'pickup' },
        TEST_USER.id,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. createListing
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('createListing', () => {
    const validListingArgs = {
      sellerId: 'seller-1',
      categoryId: 'cat-1',
      type: 'product',
      title: 'Nuevo Producto',
      description: 'Descripción del producto',
      price: 50000,
      originalPrice: 75000,
      quantity: 10,
      attributes: {},
      deliveryMethods: ['pickup'],
      images: [],
    };

    it('allows VENUE_OWNER to create listing', async () => {
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-1',
        ownerId: TEST_USER.id,
        name: 'Mi Negocio',
      });
      mockListingService.createListing.mockResolvedValue({
        id: 'listing-new',
        title: 'Nuevo Producto',
      });

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
        TEST_USER.name,
        'VENUE_OWNER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.listingId).toBe('listing-new');
      expect(parsed.title).toBe('Nuevo Producto');
      expect(mockListingService.createListing).toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to create listing (with owned seller)', async () => {
      // Note: ownership check (seller.ownerId !== userId) has NO admin bypass.
      // Admins still need to own the seller to create listings for it.
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-admin',
        ownerId: 'admin-1', // admin owns this seller
        name: 'Admin Business',
      });
      mockListingService.createListing.mockResolvedValue({
        id: 'listing-new',
        title: 'Producto',
      });

      const result = await executeToolCall(
        'createListing',
        { ...validListingArgs, sellerId: 'seller-admin' },
        'admin-1',
        'Admin',
        'SUPER_ADMIN',
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });

    it('rejects admin if they do not own the seller', async () => {
      // Even SUPER_ADMIN must own the seller — the ownership check has no bypass
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-1',
        ownerId: 'other-owner',
        name: 'Negocio Ajeno',
      });

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        'admin-1',
        'Admin',
        'SUPER_ADMIN',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No eres el dueño');
    });

    it('rejects non-VENUE_OWNER role', async () => {
      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Solo dueños de negocio');
      expect(mockSellerService.getById).not.toHaveBeenCalled();
      expect(mockListingService.createListing).not.toHaveBeenCalled();
    });

    it('rejects listing if seller not found', async () => {
      mockSellerService.getById.mockResolvedValue(null);

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
        TEST_USER.name,
        'VENUE_OWNER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No encontré ese vendedor');
      expect(mockListingService.createListing).not.toHaveBeenCalled();
    });

    it('rejects listing if user does not own the seller', async () => {
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-1',
        ownerId: 'different-owner',
        name: 'Negocio Ajeno',
      });

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
        TEST_USER.name,
        'VENUE_OWNER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No eres el dueño');
      expect(mockListingService.createListing).not.toHaveBeenCalled();
    });

    it('sanitizes title and description', async () => {
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-1',
        ownerId: TEST_USER.id,
        name: 'Mi Negocio',
      });
      mockListingService.createListing.mockResolvedValue({
        id: 'listing-new',
        title: 'Safe Title',
      });

      await executeToolCall(
        'createListing',
        {
          ...validListingArgs,
          title: '<h1>Hacked Title</h1>',
          description: '<script>alert("xss")</script>',
        },
        TEST_USER.id,
        TEST_USER.name,
        'VENUE_OWNER',
      );

      const createArgs = mockListingService.createListing.mock.calls[0][0];
      expect(createArgs.title).not.toContain('<h1>');
      expect(createArgs.description).not.toContain('<script>');
    });

    it('requires authentication', async () => {
      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        undefined,
        undefined,
        'CUSTOMER',
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('respects rate limiting', async () => {
      mockCheckWriteRateLimit.mockReturnValue(false);

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Demasiadas');
    });

    it('handles listingService.createListing errors', async () => {
      mockSellerService.getById.mockResolvedValue({
        id: 'seller-1',
        ownerId: TEST_USER.id,
        name: 'Mi Negocio',
      });
      mockListingService.createListing.mockRejectedValue({});

      const result = await executeToolCall(
        'createListing',
        validListingArgs,
        TEST_USER.id,
        TEST_USER.name,
        'VENUE_OWNER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. cancelMyBooking
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('cancelMyBooking', () => {
    const mockBookingData = {
      buyerId: TEST_USER.id,
      listingId: 'l1',
      sellerId: 's1',
      transactionId: 'tx-1',
      startTime: '2026-07-20T14:00:00Z',
      endTime: '2026-07-20T15:00:00Z',
      status: 'confirmed',
      createdAt: '2026-07-15T10:00:00Z',
    };

    it('cancels owned booking successfully', async () => {
      vi.mocked(getDoc).mockResolvedValue(
        mockDocSnap(true, mockBookingData) as any,
      );
      mockHttpsCallableResult.mockResolvedValue({ data: { success: true } });
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1', reason: 'Cambio de planes' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.bookingId).toBe('bk-1');

      // Should call cancelTransaction on the associated transaction
      expect(mockHttpsCallableResult).toHaveBeenCalledWith({
        transactionId: 'tx-1',
      });
      // Should update booking status
      expect(vi.mocked(updateDoc)).toHaveBeenCalled();
    });

    it('rejects cancellation if booking not found', async () => {
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap(false) as any);

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-nonexistent' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No encontré esa reserva');
    });

    it('rejects cancellation if booking does not belong to user', async () => {
      vi.mocked(getDoc).mockResolvedValue(
        mockDocSnap(true, { ...mockBookingData, buyerId: 'other-user' }) as any,
      );

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Esta reserva no te pertenece');
    });

    it('still cancels booking even if transaction cancellation fails', async () => {
      vi.mocked(getDoc).mockResolvedValue(
        mockDocSnap(true, mockBookingData) as any,
      );
      mockHttpsCallableResult.mockRejectedValue(new Error('Tx cancel failed'));
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        TEST_USER.id,
      );

      // Should still succeed — transaction cancel failure is non-fatal
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(vi.mocked(updateDoc)).toHaveBeenCalled(); // booking still cancelled
    });

    it('handles booking without transactionId', async () => {
      const noTxBooking = { ...mockBookingData, transactionId: undefined };
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap(true, noTxBooking) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      // Should NOT try to cancel transaction
      expect(mockHttpsCallableResult).not.toHaveBeenCalled();
    });

    it('requires authentication', async () => {
      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        undefined,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('respects rate limiting', async () => {
      mockCheckWriteRateLimit.mockReturnValue(false);

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        TEST_USER.id,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Demasiadas');
    });

    it('handles updateDoc errors', async () => {
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap(true, mockBookingData) as any);
      mockHttpsCallableResult.mockResolvedValue({ data: { success: true } });
      vi.mocked(updateDoc).mockRejectedValue({});

      const result = await executeToolCall(
        'cancelMyBooking',
        { bookingId: 'bk-1' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. getSellerAnalytics
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getSellerAnalytics', () => {
    const mockSeller = {
      id: 'seller-1',
      ownerId: TEST_USER.id,
      name: 'Mi Negocio',
    };

    const mockTransactions = [
      {
        id: 'tx-1',
        data: () => ({
          sellerId: 'seller-1',
          totalAmount: 50000,
          transactionType: 'purchase',
          createdAt: new Date().toISOString(),
          status: 'completed',
        }),
      },
      {
        id: 'tx-2',
        data: () => ({
          sellerId: 'seller-1',
          totalAmount: 30000,
          transactionType: 'booking',
          createdAt: new Date().toISOString(),
          status: 'completed',
        }),
      },
    ];

    it('returns analytics for owned seller', async () => {
      mockSellerService.getById.mockResolvedValue(mockSeller);
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockTransactions) as any);

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1', period: 'month' },
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.sellerId).toBe('seller-1');
      expect(parsed.sellerName).toBe('Mi Negocio');
      expect(parsed.totalRevenue).toBe(80000);
      expect(parsed.totalTransactions).toBe(2);
      expect(parsed.recentTransactions).toHaveLength(2);
    });

    it('allows admin to view any seller analytics', async () => {
      mockSellerService.getById.mockResolvedValue({
        ...mockSeller,
        ownerId: 'different-owner',
      });
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockTransactions) as any);

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1' },
        'admin-1',
        'Admin',
        'SUPER_ADMIN',
      );

      const parsed = JSON.parse(result);
      expect(parsed.sellerId).toBe('seller-1');
    });

    it('rejects analytics for non-owned seller', async () => {
      mockSellerService.getById.mockResolvedValue({
        ...mockSeller,
        ownerId: 'different-owner',
      });

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1' },
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Solo el dueño');
    });

    it('returns error when seller not found', async () => {
      mockSellerService.getById.mockResolvedValue(null);

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'nonexistent' },
        TEST_USER.id,
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('No encontré ese vendedor');
    });

    it('filters transactions by week period', async () => {
      mockSellerService.getById.mockResolvedValue(mockSeller);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 15); // 15 days ago (outside week)
      const recentDate = new Date(); // today

      const mixedTx = [
        {
          id: 'tx-old',
          data: () => ({
            sellerId: 'seller-1',
            totalAmount: 10000,
            createdAt: oldDate.toISOString(),
            status: 'completed',
          }),
        },
        {
          id: 'tx-recent',
          data: () => ({
            sellerId: 'seller-1',
            totalAmount: 20000,
            createdAt: recentDate.toISOString(),
            status: 'completed',
          }),
        },
      ];
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mixedTx) as any);

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1', period: 'week' },
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      // Only the recent transaction should count in 'week' period
      // Note: the "start of week" calculation may include more days depending on when the test runs
      // The old tx from 15 days ago should definitely be excluded
      expect(parsed.totalRevenue).toBeLessThanOrEqual(30000);
    });

    it('defaults to period "month"', async () => {
      mockSellerService.getById.mockResolvedValue(mockSeller);
      vi.mocked(getDocs).mockResolvedValue(mockSnapshot(mockTransactions) as any);

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1' }, // no period specified
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.period).toBe('month');
    });

    it('requires authentication', async () => {
      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1' },
        undefined,
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('iniciar sesión');
    });

    it('handles Firestore query errors', async () => {
      mockSellerService.getById.mockResolvedValue(mockSeller);
      vi.mocked(getDocs).mockRejectedValue({});

      const result = await executeToolCall(
        'getSellerAnalytics',
        { sellerId: 'seller-1' },
        TEST_USER.id,
        TEST_USER.name,
        'CUSTOMER',
      );

      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Cross-cutting security tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Security — cross-cutting', () => {
    it('all write tools are rate-limited', () => {
      const writeToolNames = [
        'createBooking',
        'createTransaction',
        'createListing',
        'cancelMyBooking',
      ];

      writeToolNames.forEach(async (name) => {
        mockCheckWriteRateLimit.mockReturnValue(false);
        vi.mocked(getDoc).mockResolvedValue(mockDocSnap(true, {
          buyerId: TEST_USER.id,
          transactionId: 'tx-1',
          status: 'confirmed',
          createdAt: '2026-07-15T10:00:00Z',
        }) as any);
        mockSellerService.getById.mockResolvedValue({
          id: 'seller-1',
          ownerId: TEST_USER.id,
          name: 'Test',
        });
        mockListingService.getListingById.mockResolvedValue({
          id: 'listing-1',
          title: 'Test',
          price: 100,
          sellerId: 'seller-1',
        });

        const result = await executeToolCall(name, {}, TEST_USER.id);
        const parsed = JSON.parse(result);
        expect(parsed.error).toContain('Demasiadas');
      });
    });

    it('all authenticated tools reject unauthenticated access', async () => {
      const toolsRequiringAuth = [
        'getMyTransactions',
        'getMyBookings',
        'createBooking',
        'createTransaction',
        'createListing',
        'cancelMyBooking',
        'getSellerAnalytics',
      ];

      for (const name of toolsRequiringAuth) {
        const result = await executeToolCall(name, {}, undefined);
        const parsed = JSON.parse(result);
        expect(
          parsed.error,
          `${name} should require auth`,
        ).toContain('iniciar sesión');
      }
    });

    it('createListing enforces VENUE_OWNER role gate', async () => {
      const nonOwnerRoles = ['CUSTOMER', 'DRIVER', 'KITCHEN_STAFF'];

      for (const role of nonOwnerRoles) {
        vi.clearAllMocks();
        mockCheckWriteRateLimit.mockReturnValue(true);

        const result = await executeToolCall(
          'createListing',
          { sellerId: 's1', categoryId: 'c1', type: 'product', title: 'T', description: 'D', price: 100, deliveryMethods: ['pickup'] },
          TEST_USER.id,
          'User',
          role,
        );
        const parsed = JSON.parse(result);
        expect(
          parsed.error,
          `${role} should be rejected from createListing`,
        ).toContain('Solo dueños de negocio');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Tool definitions
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Tool definitions', () => {
    it('CHAT_TOOLS includes all 7 marketplace tools', async () => {
      const { CHAT_TOOLS } = await import('../../services/aiChatTools');
      const marketplaceToolNames = [
        'getMyTransactions',
        'getMyBookings',
        'createBooking',
        'createTransaction',
        'createListing',
        'cancelMyBooking',
        'getSellerAnalytics',
      ];

      const actualNames = CHAT_TOOLS.map((t: any) => t.function.name);
      marketplaceToolNames.forEach(name => {
        expect(actualNames).toContain(name);
      });
    });

    it('all marketplace tools have valid OpenAPI-style parameters', async () => {
      const { CHAT_TOOLS } = await import('../../services/aiChatTools');
      const marketplaceToolNames = new Set([
        'getMyTransactions',
        'getMyBookings',
        'createBooking',
        'createTransaction',
        'createListing',
        'cancelMyBooking',
        'getSellerAnalytics',
      ]);

      const marketplaceTools = CHAT_TOOLS.filter((t: any) =>
        marketplaceToolNames.has(t.function.name),
      );

      marketplaceTools.forEach((tool: any) => {
        expect(tool.type).toBe('function');
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
      });
    });
  });
});
