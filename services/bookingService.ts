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
import { Booking, BookingStatus } from '../types';
import { logger } from '../utils/logger';

/**
 * BookingService — CRUD para bookings (citas/reservas).
 *
 * Los bookings se crean vía Cloud Function al completar una transacción
 * de tipo 'booking'. El frontend puede leer y cancelar.
 */

const COLLECTION = 'bookings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToBooking(id: string, data: any): Booking {
  return {
    id,
    transactionId: data.transactionId || '',
    sellerId: data.sellerId || '',
    buyerId: data.buyerId || '',
    listingId: data.listingId || '',
    startTime: data.startTime?.toDate?.()?.toISOString() || data.startTime || '',
    endTime: data.endTime?.toDate?.()?.toISOString() || data.endTime || '',
    status: data.status || BookingStatus.CONFIRMED,
    notes: data.notes,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const bookingService = {
  /** Obtiene bookings de un comprador. */
  async getByBuyer(
    buyerId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ bookings: Booking[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const constraints: any[] = [
        where('buyerId', '==', buyerId),
        orderBy('createdAt', 'desc'),
      ];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
      return {
        bookings: snap.docs.map(d => docToBooking(d.id, d.data())),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error(`bookingService.getByBuyer(${buyerId}) error:`, e);
      return { bookings: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene bookings de un seller. */
  async getBySeller(
    sellerId: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ bookings: Booking[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const constraints: any[] = [
        where('sellerId', '==', sellerId),
        orderBy('createdAt', 'desc'),
      ];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
      return {
        bookings: snap.docs.map(d => docToBooking(d.id, d.data())),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error(`bookingService.getBySeller(${sellerId}) error:`, e);
      return { bookings: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene bookings por transacción. */
  async getByTransaction(transactionId: string): Promise<Booking[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('transactionId', '==', transactionId),
        orderBy('startTime', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => docToBooking(d.id, d.data()));
    } catch (e) {
      logger.error(`bookingService.getByTransaction(${transactionId}) error:`, e);
      return [];
    }
  },

  /** Obtiene un booking por ID. */
  async getById(bookingId: string): Promise<Booking | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION, bookingId));
      if (!snap.exists()) return null;
      return docToBooking(snap.id, snap.data());
    } catch (e) {
      logger.error(`bookingService.getById(${bookingId}) error:`, e);
      return null;
    }
  },

  /** Crea un nuevo booking (típicamente vía Cloud Function). */
  async create(data: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        status: data.status || BookingStatus.CONFIRMED,
        createdAt: Timestamp.now(),
      });
      return {
        id: docRef.id,
        ...data,
        status: data.status || BookingStatus.CONFIRMED,
        createdAt: new Date().toISOString(),
      } as Booking;
    } catch (e) {
      logger.error('bookingService.create error:', e);
      throw e;
    }
  },

  /** Cancela un booking (comprador). */
  async cancelByBuyer(bookingId: string, notes?: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION, bookingId), {
        status: BookingStatus.CANCELLED,
        ...(notes ? { notes } : {}),
      });
    } catch (e) {
      logger.error(`bookingService.cancelByBuyer(${bookingId}) error:`, e);
      throw e;
    }
  },

  /** Actualiza el estado de un booking (seller/admin). */
  async updateStatus(bookingId: string, status: BookingStatus, notes?: string): Promise<void> {
    try {
      const data: any = { status };
      if (notes) data.notes = notes;
      await updateDoc(doc(db, COLLECTION, bookingId), data);
    } catch (e) {
      logger.error(`bookingService.updateStatus(${bookingId}) error:`, e);
      throw e;
    }
  },

  /** Marca un booking como attended (seller). */
  async markAttended(bookingId: string): Promise<void> {
    return this.updateStatus(bookingId, BookingStatus.ATTENDED);
  },

  /** Marca un booking como no-show (seller). */
  async markNoShow(bookingId: string): Promise<void> {
    return this.updateStatus(bookingId, BookingStatus.NO_SHOW);
  },

  /** Elimina un booking. */
  async remove(bookingId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, bookingId));
    } catch (e) {
      logger.error(`bookingService.remove(${bookingId}) error:`, e);
      throw e;
    }
  },

  /** Obtiene bookings en un rango de fechas (para calendar view). */
  async getByDateRange(
    sellerId: string,
    startDate: string,
    endDate: string
  ): Promise<Booking[]> {
    try {
      // Firestore range queries: startTime >= startDate AND startTime <= endDate
      const q = query(
        collection(db, COLLECTION),
        where('sellerId', '==', sellerId),
        where('startTime', '>=', startDate),
        where('startTime', '<=', endDate),
        orderBy('startTime', 'asc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => docToBooking(d.id, d.data()));
    } catch (e) {
      logger.error(`bookingService.getByDateRange error:`, e);
      return [];
    }
  },
};