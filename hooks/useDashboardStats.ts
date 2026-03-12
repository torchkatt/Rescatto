import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
  activeCustomers: number;
}

export const useDashboardStats = (venueId?: string) => {
  return useQuery({
    queryKey: ['dashboardStats', venueId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!venueId) throw new Error('venueId is required');

      // 30 days lookback for stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, 'orders'),
        where('venueId', '==', venueId),
        where('createdAt', '>=', thirtyDaysAgo.toISOString())
      );

      const snapshot = await getDocs(q);
      
      let totalRevenue = 0;
      const ordersByStatus: Record<string, number> = {};
      const uniqueCustomers = new Set<string>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Sum revenue only for paid/completed orders
        if (['PAID', 'DELIVERED', 'COMPLETED', 'READY'].includes(data.status)) {
          totalRevenue += (data.total || 0);
        }

        // Count status
        const status = data.status || 'UNKNOWN';
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;

        // Unique customers
        if (data.customerId) {
          uniqueCustomers.add(data.customerId);
        }
      });

      return {
        totalOrders: snapshot.size,
        totalRevenue,
        ordersByStatus,
        activeCustomers: uniqueCustomers.size
      };
    },
    enabled: !!venueId, // Only run if venueId is present
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
};
