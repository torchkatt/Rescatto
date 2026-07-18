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
import { Seller, Venue, SellerType } from '../types';
import { cacheService } from './cacheService';
import { logger } from '../utils/logger';

/**
 * SellerService — CRUD para sellers (marketplace generalizado).
 *
 * Estrategia dual-read Fase 1:
 * - Lee de `sellers` (nuevo); si no encuentra, cae a `venues` (legacy).
 * - Escribe solo en `sellers`.
 * - Convierte Venue → Seller vía adapter.
 */

const NEW_COLLECTION = 'sellers';
const LEGACY_COLLECTION = 'venues';

// ─── Cache keys ───────────────────────────────────────────────────────────────

const CACHE_KEYS = {
  ALL: (city?: string) => `rescatto_sellers_all_${city || 'global'}`,
  BY_ID: (id: string) => `rescatto_seller_${id}`,
  BY_OWNER: (ownerId: string) => `rescatto_sellers_owner_${ownerId}`,
  BY_CATEGORY: (catId: string) => `rescatto_sellers_cat_${catId}`,
};

const TTL = { ALL: 15, DETAIL: 15, OWNER: 5, CATEGORY: 10 };

// ─── Adapter: Venue → Seller ──────────────────────────────────────────────────

function venueToSeller(venue: Venue): Seller {
  return {
    id: venue.id,
    name: venue.name,
    type: SellerType.FOOD,
    categoryIds: [],
    ownerId: venue.ownerId || '',
    location: {
      lat: venue.latitude,
      lng: venue.longitude,
      address: venue.address,
      city: venue.city || '',
      neighborhood: venue.neighborhood,
    },
    logo: venue.logoUrl || venue.imageUrl,
    coverImage: venue.coverImageUrl,
    description: '',
    contact: { phone: venue.phone },
    rating: venue.rating || 0,
    stats: {
      totalTransactions: venue.stats?.totalOrders || 0,
      totalRevenue: venue.stats?.totalRevenue || 0,
    },
    deliveryConfig: venue.deliveryConfig,
    isActive: true,
    subscription: 'free',
    commissionRate: 0.10,
    createdAt: new Date().toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const sellerService = {
  /** Obtiene todos los sellers activos (nuevo + legacy). */
  async getAll(city?: string): Promise<Seller[]> {
    const cacheKey = CACHE_KEYS.ALL(city);
    const cached = cacheService.get<Seller[]>(cacheKey);
    if (cached) return cached;

    try {
      // 1. Nuevos sellers
      const sellersRef = collection(db, NEW_COLLECTION);
      const sellers: Seller[] = [];
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      let hasMore = true;
      let iters = 0;

      while (hasMore && ++iters <= 20) {
        const constraints: any[] = [orderBy('name')];
        if (city) constraints.unshift(where('location.city', '==', city));
        if (lastDoc) constraints.push(startAfter(lastDoc));
        constraints.push(limit(50));
        const q = query(sellersRef, ...constraints);
        const snap = await getDocs(q);
        sellers.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
        lastDoc = snap.docs[snap.docs.length - 1] || null;
        hasMore = snap.docs.length === 50;
      }

      // 2. Legacy venues como fallback
      const sellerIds = new Set(sellers.map(s => s.id));
      try {
        const venuesRef = collection(db, LEGACY_COLLECTION);
        const vSnap = await getDocs(query(venuesRef, orderBy('name'), limit(100)));
        for (const d of vSnap.docs) {
          if (!sellerIds.has(d.id)) {
            sellers.push(venueToSeller({ id: d.id, ...d.data() } as Venue));
          }
        }
      } catch { /* legacy fallback silencioso */ }

      cacheService.set(cacheKey, sellers, TTL.ALL);
      return sellers;
    } catch (e) {
      logger.error('sellerService.getAll error:', e);
      return [];
    }
  },

  /** Obtiene sellers con paginación. */
  async getPage(
    city?: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize = 20
  ): Promise<{ sellers: Seller[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const sellersRef = collection(db, NEW_COLLECTION);
      const constraints: any[] = [orderBy('name')];
      if (city) constraints.unshift(where('location.city', '==', city));
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));
      const snap = await getDocs(query(sellersRef, ...constraints));
      return {
        sellers: snap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)),
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (e) {
      logger.error('sellerService.getPage error:', e);
      return { sellers: [], lastDoc: null, hasMore: false };
    }
  },

  /** Obtiene un seller por ID (nuevo + legacy). */
  async getById(id: string): Promise<Seller | null> {
    const cacheKey = CACHE_KEYS.BY_ID(id);
    const cached = cacheService.get<Seller>(cacheKey);
    if (cached) return cached;

    try {
      // 1. Nuevo
      const newSnap = await getDoc(doc(db, NEW_COLLECTION, id));
      if (newSnap.exists()) {
        const seller = { id: newSnap.id, ...newSnap.data() } as Seller;
        cacheService.set(cacheKey, seller, TTL.DETAIL);
        return seller;
      }
      // 2. Legacy
      const legSnap = await getDoc(doc(db, LEGACY_COLLECTION, id));
      if (legSnap.exists()) {
        const seller = venueToSeller({ id: legSnap.id, ...legSnap.data() } as Venue);
        cacheService.set(cacheKey, seller, TTL.DETAIL);
        return seller;
      }
      return null;
    } catch (e) {
      logger.error(`sellerService.getById(${id}) error:`, e);
      return null;
    }
  },

  /** Obtiene sellers por owner (dueño). */
  async getByOwner(ownerId: string): Promise<Seller[]> {
    try {
      const q = query(collection(db, NEW_COLLECTION), where('ownerId', '==', ownerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Seller));
    } catch (e) {
      logger.error(`sellerService.getByOwner(${ownerId}) error:`, e);
      return [];
    }
  },

  /** Obtiene sellers por categoría. */
  async getByCategory(categoryId: string): Promise<Seller[]> {
    const cacheKey = CACHE_KEYS.BY_CATEGORY(categoryId);
    const cached = cacheService.get<Seller[]>(cacheKey);
    if (cached) return cached;

    try {
      const q = query(
        collection(db, NEW_COLLECTION),
        where('categoryIds', 'array-contains', categoryId),
        where('isActive', '==', true),
        limit(50)
      );
      const snap = await getDocs(q);
      const sellers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Seller));
      cacheService.set(cacheKey, sellers, TTL.CATEGORY);
      return sellers;
    } catch (e) {
      logger.error(`sellerService.getByCategory(${categoryId}) error:`, e);
      return [];
    }
  },

  /** Crea un nuevo seller. */
  async create(data: Omit<Seller, 'id' | 'createdAt'>): Promise<Seller> {
    try {
      const docRef = await addDoc(collection(db, NEW_COLLECTION), {
        ...data,
        stats: data.stats || { totalTransactions: 0, totalRevenue: 0 },
        rating: data.rating || 0,
        isActive: data.isActive ?? true,
        subscription: data.subscription || 'free',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      cacheService.clearByPrefix('rescatto_sellers_all_');
      return { id: docRef.id, ...data, createdAt: new Date().toISOString() } as Seller;
    } catch (e) {
      logger.error('sellerService.create error:', e);
      throw e;
    }
  },

  /** Actualiza un seller existente. */
  async update(id: string, data: Partial<Omit<Seller, 'id'>>): Promise<void> {
    try {
      await updateDoc(doc(db, NEW_COLLECTION, id), { ...data, updatedAt: Timestamp.now() } as any);
      cacheService.remove(CACHE_KEYS.BY_ID(id));
      cacheService.clearByPrefix('rescatto_sellers_all_');
      cacheService.clearByPrefix('rescatto_sellers_cat_');
    } catch (e) {
      logger.error(`sellerService.update(${id}) error:`, e);
      throw e;
    }
  },

  /** Elimina un seller. */
  async remove(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, NEW_COLLECTION, id));
      cacheService.remove(CACHE_KEYS.BY_ID(id));
      cacheService.clearByPrefix('rescatto_sellers_all_');
    } catch (e) {
      logger.error(`sellerService.remove(${id}) error:`, e);
      throw e;
    }
  },

  /** Busca sellers por nombre parcial (cliente-side filter). */
  async search(term: string): Promise<Seller[]> {
    try {
      const snap = await getDocs(query(collection(db, NEW_COLLECTION), orderBy('name'), limit(100)));
      const t = term.toLowerCase();
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Seller))
        .filter(s => s.name.toLowerCase().includes(t) || s.location.city.toLowerCase().includes(t));
    } catch (e) {
      logger.error('sellerService.search error:', e);
      return [];
    }
  },

  clearCache: () => {
    cacheService.clearByPrefix('rescatto_sellers_');
  },
};