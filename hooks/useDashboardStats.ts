import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  venueEarnings: number; // New: Revenue after commission
  ordersByStatus: Record<string, number>;
  activeCustomers: number;
  topProducts: Array<{ name: string; count: number }>; // New: Top 5 products
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
      const productCounts: Record<string, number> = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Sum revenue only for paid/completed orders
        if (['PAID', 'DELIVERED', 'COMPLETED', 'READY'].includes(data.status)) {
          totalRevenue += (data.totalAmount || data.total || 0);
        }

        // Count products
        if (data.products && Array.isArray(data.products)) {
          data.products.forEach((p: any) => {
            const name = p.name || 'Pack Sorpresa';
            productCounts[name] = (productCounts[name] || 0) + (p.quantity || 1);
          });
        }

        // Count status
        const status = data.status || 'UNKNOWN';
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;

        // Unique customers
        if (data.customerId) {
          uniqueCustomers.add(data.customerId);
        }
      });

      // Sort and slice top products
      const topProducts = Object.entries(productCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Commission calculation (10%)
      const venueEarnings = totalRevenue * 0.9;

      return {
        totalOrders: snapshot.size,
        totalRevenue,
        venueEarnings,
        ordersByStatus,
        activeCustomers: uniqueCustomers.size,
        topProducts
      };
    },
    enabled: !!venueId, // Only run if venueId is present
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
};
