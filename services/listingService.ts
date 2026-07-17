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
import { Listing, Product, ListingType, DeliveryMethod } from '../types';
import { logger } from '../utils/logger';
import { isProductExpired } from '../utils/productAvailability';

/**
 * ListingService — Capa de abstracción sobre listings (nuevo) + products (legacy).
 *
 * Estrategia dual-write Fase 0:
 * - Lee de `listings` primero; si no encuentra, cae a `products`.
 * - Escribe solo en `listings`.
 * - Convierte Product → Listing vía adapter cuando sea necesario.
 *
 * Los métodos legacy (getProductsByVenue, etc.) siguen existiendo en ProductService.
 * Este servicio es la capa NUEVA que el UI generalizado debe empezar a usar.
 */

const NEW_COLLECTION = 'listings';
const LEGACY_COLLECTION = 'products';

/**
 * Convierte un Product (legacy) a Listing (nuevo).
 * Lossy: algunos campos legacy no tienen equivalente en el nuevo modelo.
 */
function productToListing(product: Product): Listing {
  return {
    id: product.id,
    sellerId: product.venueId,
    categoryId: '', // sin equivalente — se setea en migración
    type: ListingType.PRODUCT,
    title: product.name,
    description: product.description || '',
    images: product.imageUrl ? [product.imageUrl] : [],
    price: product.dynamicDiscountedPrice || product.discountedPrice,
    originalPrice: product.originalPrice,
    quantity: product.quantity,
    attributes: {
      allergens: product.dietaryTags || [],
      expiresAt: product.availableUntil,
    },
    isActive: true,
    isFeatured: false,
    deliveryMethods: [DeliveryMethod.PICKUP],
    stats: { views: 0, sales: 0, rating: 0 },
    createdAt: product.createdAt?.toDate?.()?.toISOString() || product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt?.toDate?.()?.toISOString() || product.updatedAt || new Date().toISOString(),
  };
}

// ─── Helper: genera keywords para búsqueda prefix-based ──────────────────────

function generateKeywords(str: string): string[] {
  if (!str) return [];
  const words = str.toLowerCase().trim().split(/\s+/);
  const keywords = new Set<string>();
  words.forEach(word => {
    let prefix = '';
    for (let i = 0; i < word.length; i++) {
      prefix += word[i];
      keywords.add(prefix);
    }
  });
  words.forEach(w => keywords.add(w));
  return Array.from(keywords);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ListingService {
  private newCollection = NEW_COLLECTION;
  private legacyCollection = LEGACY_COLLECTION;

  /**
   * Obtiene listings de un seller (nuevo + legacy combinados).
   * Fase 0: solo lee de `listings`; en Fase 1 se agrega el fallback a `products`.
   */
  async getListingsBySeller(sellerId: string): Promise<Listing[]> {
    try {
      // 1. Leer de la nueva colección
      const listingsRef = collection(db, this.newCollection);
      const q = query(
        listingsRef,
        where('sellerId', '==', sellerId),
        where('isActive', '==', true),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const listings = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Listing[];

      // 2. También leer de la colección legacy (products) como fallback
      // Usando venueId = sellerId para compatibilidad
      try {
        const legacyRef = collection(db, this.legacyCollection);
        const legacyQ = query(
          legacyRef,
          where('venueId', '==', sellerId),
          limit(20)
        );
        const legacySnapshot = await getDocs(legacyQ);
        const now = Date.now();
        const legacyListings = legacySnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Product))
          .filter(p => (p.quantity ?? 0) > 0 && !isProductExpired(p.availableUntil, now))
          .map(productToListing);

        // Merge: listings nuevos primero, luego legacy (evitar duplicados por ID)
        const newIds = new Set(listings.map(l => l.id));
        const merged = [...listings, ...legacyListings.filter(l => !newIds.has(l.id))];

        return merged;
      } catch {
        // Si falla legacy, devolver solo los nuevos
        return listings;
      }
    } catch (error) {
      logger.error(`ListingService.getListingsBySeller(${sellerId}) error:`, error);
      return [];
    }
  }

  /**
   * Obtiene listings por categoría.
   */
  async getListingsByCategory(categoryId: string, pageSize: number = 20): Promise<Listing[]> {
    try {
      const q = query(
        collection(db, this.newCollection),
        where('categoryId', '==', categoryId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Listing));
    } catch (error) {
      logger.error(`ListingService.getListingsByCategory(${categoryId}) error:`, error);
      return [];
    }
  }

  /**
   * Obtiene un listing por ID (busca en nuevo + legacy).
   */
  async getListingById(listingId: string): Promise<Listing | null> {
    try {
      // 1. Buscar en nueva colección
      const newDocRef = doc(db, this.newCollection, listingId);
      const newSnapshot = await getDoc(newDocRef);
      if (newSnapshot.exists()) {
        return { id: newSnapshot.id, ...newSnapshot.data() } as Listing;
      }

      // 2. Fallback a legacy
      const legacyDocRef = doc(db, this.legacyCollection, listingId);
      const legacySnapshot = await getDoc(legacyDocRef);
      if (legacySnapshot.exists()) {
        return productToListing({ id: legacySnapshot.id, ...legacySnapshot.data() } as Product);
      }

      return null;
    } catch (error) {
      logger.error(`ListingService.getListingById(${listingId}) error:`, error);
      return null;
    }
  }

  /**
   * Crea un nuevo listing en la colección nueva.
   */
  async createListing(data: Omit<Listing, 'id' | 'createdAt' | 'updatedAt'>): Promise<Listing> {
    try {
      const keywords = [
        ...generateKeywords(data.title),
        ...generateKeywords(data.description),
        // también indexar atributos dinámicos como texto
        ...Object.values(data.attributes || {})
          .filter(v => typeof v === 'string')
          .flatMap(v => generateKeywords(v as string)),
      ];

      const docRef = await addDoc(collection(db, this.newCollection), {
        ...data,
        searchKeywords: Array.from(new Set(keywords)),
        stats: data.stats || { views: 0, sales: 0, rating: 0 },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return {
        id: docRef.id,
        ...data,
        stats: data.stats || { views: 0, sales: 0, rating: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Listing;
    } catch (error) {
      logger.error('ListingService.createListing error:', error);
      throw error;
    }
  }

  /**
   * Actualiza un listing existente.
   */
  async updateListing(listingId: string, data: Partial<Omit<Listing, 'id'>>): Promise<void> {
    try {
      const docRef = doc(db, this.newCollection, listingId);

      let updateData: any = { ...data, updatedAt: Timestamp.now() };

      // Regenerar keywords si cambian título o descripción
      if (data.title || data.description) {
        const currentSnap = await getDoc(docRef);
        if (currentSnap.exists()) {
          const current = currentSnap.data() as Listing;
          const title = data.title || current.title;
          const desc = data.description || current.description;
          const keywords = [
            ...generateKeywords(title),
            ...generateKeywords(desc),
          ];
          updateData.searchKeywords = Array.from(new Set(keywords));
        }
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      logger.error(`ListingService.updateListing(${listingId}) error:`, error);
      throw error;
    }
  }

  /**
   * Elimina un listing.
   */
  async deleteListing(listingId: string): Promise<void> {
    try {
      const docRef = doc(db, this.newCollection, listingId);
      await deleteDoc(docRef);
    } catch (error) {
      logger.error(`ListingService.deleteListing(${listingId}) error:`, error);
      throw error;
    }
  }

  /**
   * Búsqueda global de listings por keyword + categoría.
   */
  async searchListings(
    searchTerm: string,
    options: { categoryId?: string; city?: string; type?: ListingType } = {}
  ): Promise<Listing[]> {
    try {
      const listingsRef = collection(db, this.newCollection);
      const constraints: any[] = [
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(50),
      ];

      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        constraints.unshift(where('searchKeywords', 'array-contains', term));
      }
      if (options.categoryId) {
        constraints.unshift(where('categoryId', '==', options.categoryId));
      }
      if (options.type) {
        constraints.unshift(where('type', '==', options.type));
      }

      const q = query(listingsRef, ...constraints);
      const snapshot = await getDocs(q);
      const listings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Listing));

      // Filtrar por ciudad en cliente (no podemos combinar range + equality fácilmente)
      if (options.city) {
        return listings.filter(l => {
          // El city no está en Listing directamente — necesitaríamos un join con seller
          return true; // TODO Fase 1: join con sellers para filtrar por ciudad
        });
      }

      return listings;
    } catch (error) {
      logger.error('ListingService.searchListings error:', error);
      return [];
    }
  }

  /**
   * Obtiene listings con paginación.
   */
  async getListingsPage(
    categoryId?: string,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
    pageSize: number = 20
  ): Promise<{ listings: Listing[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
    try {
      const listingsRef = collection(db, this.newCollection);
      const constraints: any[] = [
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
      ];
      if (categoryId) {
        constraints.unshift(where('categoryId', '==', categoryId));
      }
      if (lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(pageSize));

      const q = query(listingsRef, ...constraints);
      const snapshot = await getDocs(q);
      const listings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Listing));

      return {
        listings,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === pageSize,
      };
    } catch (error) {
      logger.error('ListingService.getListingsPage error:', error);
      return { listings: [], lastDoc: null, hasMore: false };
    }
  }

  /**
   * Obtiene listings destacados (isFeatured === true).
   */
  async getFeaturedListings(limitCount: number = 10): Promise<Listing[]> {
    try {
      const q = query(
        collection(db, this.newCollection),
        where('isActive', '==', true),
        where('isFeatured', '==', true),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Listing));
    } catch (error) {
      logger.error('ListingService.getFeaturedListings error:', error);
      return [];
    }
  }
}

export const listingService = new ListingService();