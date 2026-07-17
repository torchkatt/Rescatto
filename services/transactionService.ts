import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, TransactionStatus, TransactionType, DeliveryMethod } from '../types';
import { logger } from '../utils/logger';

/**
 * TransactionService — CRUD para transacciones del marketplace.
 *
 * Fase 1: opera sobre la colección `transactions`.
 * Las transacciones se crean vía Cloud Function (como orders),
 * pero el frontend puede leer y cancelar las propias.
 */

const COLLECTION = 'transactions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye una transacción desde un doc de Firestore. */
function docToTransaction(id: string, data: any): Transaction {
  return {
    id,
    buyerId: data.buyerId || '',
    sellerId: data.sellerId || '',
    transactionType: data.transactionType || TransactionType.PURCHASE,
    status: data.status || TransactionStatus.PENDING,
    lineItems: data.lineItems || [],
    subtotal: data.subtotal || 0,
    deliveryFee: data.deliveryFee,
    totalAmount: data.totalAmount || 0,
    commission: data.commission || 0,
    sellerEarnings: data.sellerEarnings || 0,
    payment: data.payment || { method: 'wompi', id: '', status: 'pending' },
    deliveryMethod: data.deliveryMethod || DeliveryMethod.PICKUP,
    shippingAddress: data.shippingAddress,
    courierId: data.courierId,
    trackingNumber: data.trackingNumber,
    pickupWindow: data.pickupWindow,
    downloadUrl: data.downloadUrl,
    buyerNotes: data.buyerNotes,
    sellerNotes: data.sellerNotes,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
    completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const transactionService = {
  /** Obtiene transacciones de un comprador. */
  async getByBuyer(
    buyerId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ transactions: Transaction[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const constraints: any[] = [
        where('buyerId', '==', buyerId),
        orderBy('createdAt', 'desc'),
      ];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
      return {
        transactions: snap.docs.map(d => docToTransaction(d.id, d.data())),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error(`transactionService.getByBuyer(${buyerId}) error:`, e);
      return { transactions: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene transacciones de un seller. */
  async getBySeller(
    sellerId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ transactions: Transaction[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const constraints: any[] = [
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc'),
      ];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
      return {
        transactions: snap.docs.map(d => docToTransaction(d.id, d.data())),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error(`transactionService.getBySeller(${sellerId}) error:`, e);
      return { transactions: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene transacciones de un courier. */
  async getByCourier(
    courierId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ transactions: Transaction[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const constraints: any[] = [
        where('courierId', '==', courierId),
        orderBy('createdAt', 'desc'),
      ];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
      return {
        transactions: snap.docs.map(d => docToTransaction(d.id, d.data())),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error(`transactionService.getByCourier(${courierId}) error:`, e);
      return { transactions: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene una transacción por ID. */
  async getById(transactionId: string): Promise<Transaction | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION, transactionId));
      if (!snap.exists()) return null;
      return docToTransaction(snap.id, snap.data());
    } catch (e) {
      logger.error(`transactionService.getById(${transactionId}) error:`, e);
      return null;
    }
  },

  /** Crea una nueva transacción (típicamente llamado por Cloud Function, no por cliente). */
  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        status: data.status || TransactionStatus.PENDING,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return {
        id: docRef.id,
        ...data,
        status: data.status || TransactionStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Transaction;
    } catch (e) {
      logger.error('transactionService.create error:', e);
      throw e;
    }
  },

  /** Cancela una transacción (solo buyer, solo si está PENDING). */
  async cancelByBuyer(transactionId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION, transactionId), {
        status: TransactionStatus.CANCELLED,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      logger.error(`transactionService.cancelByBuyer(${transactionId}) error:`, e);
      throw e;
    }
  },

  /** Actualiza el estado de una transacción (admin/seller). */
  async updateStatus(transactionId: string, status: TransactionStatus): Promise<void> {
    try {
      const updateData: any = { status, updatedAt: Timestamp.now() };
      if (status === TransactionStatus.COMPLETED) {
        updateData.completedAt = Timestamp.now();
      }
      await updateDoc(doc(db, COLLECTION, transactionId), updateData);
    } catch (e) {
      logger.error(`transactionService.updateStatus(${transactionId}) error:`, e);
      throw e;
    }
  },

  /** Actualiza campos de shipping/tracking. */
  async updateShipping(transactionId: string, data: { courierId?: string; trackingNumber?: string }): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION, transactionId), {
        ...data,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      logger.error(`transactionService.updateShipping(${transactionId}) error:`, e);
      throw e;
    }
  },

  /** Elimina una transacción (solo super admin + emergency mode). */
  async remove(transactionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, transactionId));
    } catch (e) {
      logger.error(`transactionService.remove(${transactionId}) error:`, e);
      throw e;
    }
  },
};