import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import { OrderStatus } from '../types';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { logger } from '../utils/logger';

export interface DateRange {
    start: Date;
    end: Date;
}

export interface RevenueMetrics {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    previousPeriodRevenue: number;
    revenueGrowth: number; // percentage
}

export interface OrderStatistics {
    pending: number;
    paid: number;
    readyForPickup: number;
    completed: number;
    missed: number;
    disputed: number;
}

export interface TopProduct {
    productId: string;
    name: string;
    quantitySold: number;
    revenue: number;
}

export interface DailyRevenue {
    date: string;
    revenue: number;
    orders: number;
}

/**
 * Get revenue metrics for a venue within a date range
 */
export const getRevenueMetrics = async (
    venueId: string | string[],
    dateRange: DateRange
): Promise<RevenueMetrics> => {
    try {
        const ordersRef = collection(db, 'orders');
        let q;
        if (venueId === 'all') {
            q = query(
                ordersRef,
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else if (Array.isArray(venueId)) {
            if (venueId.length === 0) return { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, previousPeriodRevenue: 0, revenueGrowth: 0 };
            q = query(
                ordersRef,
                where('venueId', 'in', venueId.slice(0, 30)),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        }

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data() as any);

        // Calculate current period metrics
        const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Calculate previous period for comparison
        const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        const previousStart = subDays(dateRange.start, daysDiff);
        const previousEnd = subDays(dateRange.end, daysDiff);

        let prevQ;
        if (venueId === 'all') {
            prevQ = query(
                ordersRef,
                where('createdAt', '>=', startOfDay(previousStart).toISOString()),
                where('createdAt', '<=', endOfDay(previousEnd).toISOString())
            );
        } else if (Array.isArray(venueId)) {
            prevQ = query(
                ordersRef,
                where('venueId', 'in', venueId.slice(0, 30)),
                where('createdAt', '>=', startOfDay(previousStart).toISOString()),
                where('createdAt', '<=', endOfDay(previousEnd).toISOString())
            );
        } else {
            prevQ = query(
                ordersRef,
                where('venueId', '==', venueId),
                where('createdAt', '>=', startOfDay(previousStart).toISOString()),
                where('createdAt', '<=', endOfDay(previousEnd).toISOString())
            );
        }

        const prevSnapshot = await getDocs(prevQ);
        const previousPeriodRevenue = prevSnapshot.docs.reduce(
            (sum, doc) => sum + ((doc.data() as any).totalAmount || 0),
            0
        );

        const revenueGrowth = previousPeriodRevenue > 0
            ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
            : 0;

        return {
            totalRevenue,
            totalOrders,
            averageOrderValue,
            previousPeriodRevenue,
            revenueGrowth,
        };
    } catch (error) {
        logger.error('Error getting revenue metrics:', error);
        throw error;
    }
};

/**
 * Get order statistics by status
 */
export const getOrderStatistics = async (
    venueId: string | string[],
    dateRange: DateRange
): Promise<OrderStatistics> => {
    try {
        const ordersRef = collection(db, 'orders');
        let q;
        if (venueId === 'all') {
            q = query(
                ordersRef,
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else if (Array.isArray(venueId)) {
            if (venueId.length === 0) return { pending: 0, paid: 0, readyForPickup: 0, completed: 0, missed: 0, disputed: 0 };
            q = query(
                ordersRef,
                where('venueId', 'in', venueId.slice(0, 10)), // 'in' limits
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        }

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data() as any);

        const stats: OrderStatistics = {
            pending: 0,
            paid: 0,
            readyForPickup: 0,
            completed: 0,
            missed: 0,
            disputed: 0,
        };

        orders.forEach(order => {
            switch (order.status) {
                case OrderStatus.PENDING:
                    stats.pending++;
                    break;
                case OrderStatus.PAID:
                    stats.paid++;
                    break;
                case OrderStatus.READY:
                    stats.readyForPickup++;
                    break;
                case OrderStatus.COMPLETED:
                    stats.completed++;
                    break;
                case OrderStatus.MISSED:
                    stats.missed++;
                    break;
                case OrderStatus.DISPUTED:
                    stats.disputed++;
                    break;
            }
        });

        return stats;
    } catch (error) {
        logger.error('Error getting order statistics:', error);
        throw error;
    }
};

/**
 * Get top selling products
 */
export const getTopProducts = async (
    venueId: string | string[],
    dateRange: DateRange,
    limit: number = 5
): Promise<TopProduct[]> => {
    try {
        const ordersRef = collection(db, 'orders');
        let q;
        if (venueId === 'all') {
            q = query(
                ordersRef,
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else if (Array.isArray(venueId)) {
            if (venueId.length === 0) return [];
            q = query(
                ordersRef,
                where('venueId', 'in', venueId.slice(0, 10)),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString())
            );
        }

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data() as any);

        // Aggregate products across all orders
        const productMap = new Map<string, TopProduct>();

        orders.forEach(order => {
            order.products?.forEach((product: any) => {
                const existing = productMap.get(product.productId);
                if (existing) {
                    existing.quantitySold += product.quantity;
                    existing.revenue += product.price * product.quantity;
                } else {
                    productMap.set(product.productId, {
                        productId: product.productId,
                        name: product.name,
                        quantitySold: product.quantity,
                        revenue: product.price * product.quantity,
                    });
                }
            });
        });

        // Sort by revenue and limit
        return Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    } catch (error) {
        logger.error('Error getting top products:', error);
        throw error;
    }
};

/**
 * Get daily revenue trends
 */
export const getDailyRevenueTrends = async (
    venueId: string | string[],
    dateRange: DateRange
): Promise<DailyRevenue[]> => {
    try {
        const ordersRef = collection(db, 'orders');
        let q;
        if (venueId === 'all') {
            q = query(
                ordersRef,
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString()),
                limit(5000)
            );
        } else if (Array.isArray(venueId)) {
            if (venueId.length === 0) return [];
            q = query(
                ordersRef,
                where('venueId', 'in', venueId.slice(0, 10)),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString()),
                limit(5000)
            );
        } else {
            q = query(
                ordersRef,
                where('venueId', '==', venueId),
                where('createdAt', '>=', startOfDay(dateRange.start).toISOString()),
                where('createdAt', '<=', endOfDay(dateRange.end).toISOString()),
                limit(5000)
            );
        }

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data() as any);

        // Group by date
        const dailyMap = new Map<string, DailyRevenue>();

        orders.forEach(order => {
            const dateKey = format(new Date(order.createdAt), 'yyyy-MM-dd');
            const existing = dailyMap.get(dateKey);

            if (existing) {
                existing.revenue += order.totalAmount || 0;
                existing.orders++;
            } else {
                dailyMap.set(dateKey, {
                    date: dateKey,
                    revenue: order.totalAmount || 0,
                    orders: 1,
                });
            }
        });

        // Sort by date
        return Array.from(dailyMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );
    } catch (error) {
        logger.error('Error getting daily revenue trends:', error);
        throw error;
    }
};

/**
 * Get predefined date ranges
 */
export const getDateRangePresets = () => {
    const today = new Date();

    return {
        today: {
            start: startOfDay(today),
            end: endOfDay(today),
        },
        yesterday: {
            start: startOfDay(subDays(today, 1)),
            end: endOfDay(subDays(today, 1)),
        },
        last7Days: {
            start: startOfDay(subDays(today, 7)),
            end: endOfDay(today),
        },
        last30Days: {
            start: startOfDay(subDays(today, 30)),
            end: endOfDay(today),
        },
        thisMonth: {
            start: new Date(today.getFullYear(), today.getMonth(), 1),
            end: endOfDay(today),
        },
    };
};
