import { useInfiniteQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs, limit as queryLimit, startAfter, QueryConstraint, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, OrderStatus } from '../types';

export const usePaginatedOrders = (
  venueId?: string | string[],
  filters?: { status?: 'all' | OrderStatus; search?: string },
  limitPerPage = 20 // Cost-optimized page size
) => {
  return useInfiniteQuery({
    queryKey: ['ordersPaginated', venueId, filters?.status, filters?.search],
    queryFn: async ({ pageParam }: { pageParam: DocumentSnapshot | null }) => {
      if (!venueId) return { data: [], lastVisible: null };

      const ordersRef = collection(db, 'orders');
      let constraints: QueryConstraint[] = [];

      // 1. Venue Matching (Support string or array of strings)
      if (Array.isArray(venueId)) {
        if (venueId.length > 0) {
          constraints.push(where('venueId', 'in', venueId.slice(0, 30)));
        } // else empty array, will handle below
      } else if (venueId !== 'all') {
        constraints.push(where('venueId', '==', venueId));
      }

      // Always order by newest first. 
      // Note: We DO NOT use where('status', '==', ...) because it would require the venue owner
      // to manually create a new Composite Index in Firestore. We instead filter in memory.
      constraints.push(orderBy('createdAt', 'desc'));

      // 3. Cursor Pagination
      if (pageParam) {
        constraints.push(startAfter(pageParam));
      }

      constraints.push(queryLimit(limitPerPage));

      let snapshot;
      try {
        const q = query(ordersRef, ...constraints);
        snapshot = await getDocs(q);
      } catch (err) {
        // Fallback for missing indexes
        console.error("Firestore pagination error:", err);
        return { data: [], lastVisible: null };
      }

      let mappedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString()
        } as Order;
      });

      // 4. In-Memory Filters (Status and Search)
      if (filters?.status && filters.status !== 'all') {
        mappedOrders = mappedOrders.filter(o => o.status === filters.status);
      }

      if (filters?.search) {
        const sTerm = filters.search.toLowerCase();
        mappedOrders = mappedOrders.filter(o =>
          (o.customerName?.toLowerCase() || '').includes(sTerm) ||
          (o.id?.toLowerCase() || '').includes(sTerm) ||
          (o.products?.some(p => p.name.toLowerCase().includes(sTerm)))
        );
      }

      const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      const hasMoreData = snapshot.docs.length === limitPerPage; // If we didn't hit limit, we are at the end

      return {
        data: mappedOrders,
        lastVisible: hasMoreData ? lastVisible : null
      };
    },
    getNextPageParam: (lastPage) => lastPage.lastVisible,
    initialPageParam: null as DocumentSnapshot | null,
    enabled: !!venueId,
    staleTime: 60 * 1000 // 1 min cache
  });
};
