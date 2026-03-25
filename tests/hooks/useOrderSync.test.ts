import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as firestore from 'firebase/firestore';
import { useOrderSync } from '../../hooks/useOrderSync';
import { UserRole, OrderStatus } from '../../types';

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from '../../context/AuthContext';
const mockUseAuth = vi.mocked(useAuth);
const mockOnSnapshot = vi.mocked(firestore.onSnapshot);
const mockQuery = vi.mocked(firestore.query);
const mockCollection = vi.mocked(firestore.collection);

const makeUser = (role: UserRole, extra: Record<string, unknown> = {}) => ({
    id: 'user-1',
    role,
    venueId: 'venue-1',
    venueIds: ['venue-1'],
    ...extra,
});

const makeSnapshot = (docs: object[], fromCache = false) => ({
    docs: docs.map((data, i) => ({
        id: `order-${i}`,
        data: () => data,
    })),
    metadata: { fromCache },
});

// Helper that defers snapshot callback to next tick so waitFor can catch state updates
const deferredSnapshot = (snapshot: ReturnType<typeof makeSnapshot>, unsubscribe: ReturnType<typeof vi.fn>) =>
    (_q: any, _opts: any, successCb: any) => {
        setTimeout(() => successCb(snapshot), 0);
        return unsubscribe;
    };

describe('useOrderSync', () => {
    let unsubscribeMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        unsubscribeMock = vi.fn();
        mockCollection.mockReturnValue({} as any);
        mockQuery.mockReturnValue({} as any);
        mockOnSnapshot.mockReturnValue(unsubscribeMock);
    });

    it('returns empty orders and loading=false when user is null', async () => {
        mockUseAuth.mockReturnValue({ user: null } as any);

        const { result } = renderHook(() => useOrderSync());
        await act(async () => {});

        expect(result.current.orders).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('calls onSnapshot and populates orders for CUSTOMER role', async () => {
        mockUseAuth.mockReturnValue({ user: makeUser(UserRole.CUSTOMER) } as any);

        const orderData = { customerId: 'user-1', status: OrderStatus.PAID, createdAt: '2026-01-01T00:00:00Z', totalAmount: 10000 };
        mockOnSnapshot.mockImplementation(deferredSnapshot(makeSnapshot([orderData]), unsubscribeMock));

        const { result } = renderHook(() => useOrderSync());

        await waitFor(() => expect(result.current.orders).toHaveLength(1));
        expect(result.current.loading).toBe(false);
        expect(result.current.connected).toBe(true);
    });

    it('filters by driverId for DRIVER role', async () => {
        mockUseAuth.mockReturnValue({ user: makeUser(UserRole.DRIVER) } as any);
        mockOnSnapshot.mockImplementation(deferredSnapshot(makeSnapshot([]), unsubscribeMock));

        renderHook(() => useOrderSync());
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });

        const whereCall = vi.mocked(firestore.where).mock.calls.find(
            ([field]) => field === 'driverId'
        );
        expect(whereCall).toBeDefined();
        expect(whereCall?.[2]).toBe('user-1');
    });

    it('returns empty and does not subscribe for VENUE_OWNER without venueId', async () => {
        mockUseAuth.mockReturnValue({
            user: makeUser(UserRole.VENUE_OWNER, { venueId: undefined, venueIds: [] }),
        } as any);

        const { result } = renderHook(() => useOrderSync());
        await act(async () => {});

        expect(result.current.orders).toEqual([]);
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('calls unsubscribe on unmount (cleanup)', async () => {
        mockUseAuth.mockReturnValue({ user: makeUser(UserRole.SUPER_ADMIN) } as any);
        mockOnSnapshot.mockImplementation(deferredSnapshot(makeSnapshot([]), unsubscribeMock));

        const { unmount } = renderHook(() => useOrderSync());
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });

        unmount();
        expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('sets error state on snapshot error', async () => {
        mockUseAuth.mockReturnValue({ user: makeUser(UserRole.ADMIN) } as any);

        const testError = new Error('Firestore permission denied');
        mockOnSnapshot.mockImplementation((_q: any, _opts: any, _successCb: any, errorCb: any) => {
            setTimeout(() => errorCb(testError), 0);
            return unsubscribeMock;
        });

        const { result } = renderHook(() => useOrderSync());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe(testError);
        expect(result.current.connected).toBe(false);
    });

    it('stats are computed correctly from orders', async () => {
        mockUseAuth.mockReturnValue({ user: makeUser(UserRole.SUPER_ADMIN) } as any);

        const orders = [
            { status: OrderStatus.PAID, createdAt: '2026-01-01T00:00:00Z', totalAmount: 1 },
            { status: OrderStatus.IN_PREPARATION, createdAt: '2026-01-01T00:00:00Z', totalAmount: 2 },
            { status: OrderStatus.READY, createdAt: '2026-01-01T00:00:00Z', totalAmount: 3 },
        ];
        mockOnSnapshot.mockImplementation(deferredSnapshot(makeSnapshot(orders), unsubscribeMock));

        const { result } = renderHook(() => useOrderSync());

        await waitFor(() => expect(result.current.stats.total).toBe(3));
        expect(result.current.stats.pending).toBe(1);
        expect(result.current.stats.preparing).toBe(1);
        expect(result.current.stats.ready).toBe(1);
    });
});
