import { doc, updateDoc, getDoc, collection, query, where, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { OrderStatus, UserRole } from '../types';
import { getOrCreateChat, sendSystemMessage } from './chatService';
import { logger } from '../utils/logger';

/**
 * Assign an order to a driver and create chat
 */
export const acceptDelivery = async (orderId: string, driverId: string): Promise<void> => {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            throw new Error('Order not found');
        }

        const orderData = orderDoc.data();

        // Update order status
        await updateDoc(orderRef, {
            driverId,
            status: OrderStatus.DRIVER_ACCEPTED,
            acceptedAt: new Date().toISOString(),
        });

        // Get driver and customer details
        const driverDoc = await getDoc(doc(db, 'users', driverId));
        const customerDoc = await getDoc(doc(db, 'users', orderData.customerId));

        if (driverDoc.exists() && customerDoc.exists()) {
            const driverData = driverDoc.data();
            const customerData = customerDoc.data();

            // Auto-create chat between customer and driver
            const chat = await getOrCreateChat(
                driverId,
                driverData.fullName,
                UserRole.DRIVER,
                orderData.customerId,
                customerData.fullName,
                UserRole.CUSTOMER,
                'customer-driver',
                orderId
            );

            // Send system message
            await sendSystemMessage(
                chat.id,
                `🚗 ${driverData.fullName} ha aceptado tu pedido. ¡Estará contigo pronto!`
            );
        }
    } catch (error) {
        logger.error('Error accepting delivery:', error);
        throw error;
    }
};

/**
 * Mark a delivery as completed
 */
export const completeDelivery = async (
    orderId: string,
    deliveryNotes?: string
): Promise<void> => {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            throw new Error('Order not found');
        }

        const orderData = orderDoc.data();

        await updateDoc(orderRef, {
            status: OrderStatus.COMPLETED,
            deliveredAt: new Date().toISOString(),
            deliveryNotes: deliveryNotes || '',
        });

        // Find and update the chat
        if (orderData.customerId && orderData.driverId) {
            const chatsRef = collection(db, 'chats');
            const q = query(
                chatsRef,
                where('orderId', '==', orderId),
                where('type', '==', 'customer-driver')
            );

            const chatsSnapshot = await getDocs(q);

            if (!chatsSnapshot.empty) {
                const chatId = chatsSnapshot.docs[0].id;
                await sendSystemMessage(
                    chatId,
                    `🎉 ¡Entrega completada! Disfruta tu comida. ${deliveryNotes ? `Nota: ${deliveryNotes}` : ''}`
                );
            }
        }
    } catch (error) {
        logger.error('Error completing delivery:', error);
        throw error;
    }
};

/**
 * Get driver's active deliveries
 */
export const getDriverDeliveries = async (driverId: string) => {
    try {
        const ordersRef = collection(db, 'orders');
        const deliveries: any[] = [];
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let hasMore = true;
        while (hasMore) {
            const constraints: any[] = [
                where('driverId', '==', driverId),
                where('status', '==', OrderStatus.IN_TRANSIT),
            ];
            if (lastDoc) constraints.push(startAfter(lastDoc));
            constraints.push(limit(50));
            const q = query(ordersRef, ...constraints);
            const snapshot = await getDocs(q);
            deliveries.push(...snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })));
            lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            hasMore = snapshot.docs.length === 50;
        }
        return deliveries;
    } catch (error) {
        logger.error('Error getting driver deliveries:', error);
        throw error;
    }
};

/**
 * Get driver statistics
 */
export const getDriverStats = async (driverId: string) => {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('driverId', '==', driverId)
        );

        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data());

        const stats = {
            totalDeliveries: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
            activeDeliveries: orders.filter(o => o.status === OrderStatus.IN_TRANSIT).length,
            totalEarnings: orders
                .filter(o => o.status === OrderStatus.COMPLETED)
                .reduce((sum, o) => sum + (o.totalAmount || 0) * 0.1, 0), // 10% commission
        };

        return stats;
    } catch (error) {
        logger.error('Error getting driver stats:', error);
        throw error;
    }
};
