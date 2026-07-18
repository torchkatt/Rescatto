import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Venue, Product, Seller, Listing, SellerType, ListingType, DeliveryMethod } from '../types';
import { logger } from '../utils/logger';

/**
 * MigrationService — Migración one-shot de colecciones legacy a marketplace.
 *
 * Uso:
 *   const result = await migrationService.migrateVenuesToSellers();
 *   const result = await migrationService.migrateProductsToListings();
 *
 * Idempotente: saltea docs que ya existen en la colección destino (por ID).
 * Los datos legacy NO se eliminan — esto es dual-write, no destructive.
 */

const BATCH_SIZE = 400; // Firestore batch limit: 500 ops

// ─── Adapters ─────────────────────────────────────────────────────────────────

function venueToSeller(venue: Venue): Omit<Seller, 'id'> {
  const seller: Omit<Seller, 'id'> = {
    name: venue.name,
    type: SellerType.FOOD,
    categoryIds: [],
    ownerId: venue.ownerId || '',
    location: {
      lat: venue.latitude ?? 0,
      lng: venue.longitude ?? 0,
      address: venue.address || '',
      city: venue.city || '',
      neighborhood: venue.neighborhood || '',
    },
    logo: venue.logoUrl || venue.imageUrl || '',
    coverImage: venue.coverImageUrl || '',
    description: '',
    contact: { phone: venue.phone || '' },
    rating: venue.rating || 0,
    stats: {
      totalTransactions: venue.stats?.totalOrders || 0,
      totalRevenue: venue.stats?.totalRevenue || 0,
    },
    isActive: true,
    subscription: 'free',
    commissionRate: 0.10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (venue.deliveryConfig) (seller as any).deliveryConfig = venue.deliveryConfig;
  return seller;
}

function productToListing(product: Product): Omit<Listing, 'id'> {
  return {
    sellerId: product.venueId || '',
    categoryId: '', // se completa en Fase 2 cuando las categorías estén asignadas
    type: ListingType.PRODUCT,
    title: product.name,
    description: product.description || '',
    images: product.imageUrl ? [product.imageUrl] : [],
    price: product.dynamicDiscountedPrice || product.discountedPrice || 0,
    originalPrice: product.originalPrice || 0,
    quantity: product.quantity ?? 0,
    attributes: {
      allergens: product.dietaryTags || [],
      expiresAt: product.availableUntil || '',
      tags: product.tags || [],
      dietaryTags: product.dietaryTags || [],
    },
    isActive: (product.quantity ?? 0) > 0,
    isFeatured: false,
    deliveryMethods: [DeliveryMethod.PICKUP],
    stats: { views: 0, sales: 0, rating: 0 },
    createdAt: product.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: product.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const migrationService = {
  /**
   * Migra venues → sellers.
   * Saltea venues que ya existen como sellers (mismo ID).
   */
  async migrateVenuesToSellers(): Promise<{ total: number; migrated: number; skipped: number }> {
    try {
      // 1. Obtener todos los venues
      const venuesSnap = await getDocs(collection(db, 'venues'));
      const venues = venuesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Venue));
      logger.log(`📦 migrateVenuesToSellers: ${venues.length} venues encontrados`);

      // 2. Obtener IDs de sellers existentes
      const existingSellers = new Set<string>();
      const sellersSnap = await getDocs(query(collection(db, 'sellers'), limit(1000)));
      sellersSnap.docs.forEach(d => existingSellers.add(d.id));

      // 3. Migrar en batches
      let migrated = 0;
      let skipped = 0;
      let batch = writeBatch(db);
      let opsInBatch = 0;

      for (const venue of venues) {
        if (existingSellers.has(venue.id)) {
          skipped++;
          continue;
        }

        const sellerRef = doc(db, 'sellers', venue.id);
        batch.set(sellerRef, venueToSeller(venue));
        opsInBatch++;
        migrated++;

        if (opsInBatch >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          opsInBatch = 0;
          logger.log(`  ✅ Batch committed: ${migrated} sellers migrated so far...`);
        }
      }

      // Commit remaining
      if (opsInBatch > 0) {
        await batch.commit();
      }

      logger.log(`✅ migrateVenuesToSellers: ${migrated} migrated, ${skipped} skipped, ${venues.length} total`);
      return { total: venues.length, migrated, skipped };
    } catch (e) {
      logger.error('migrateVenuesToSellers error:', e);
      throw e;
    }
  },

  /**
   * Migra products → listings.
   * Saltea products que ya existen como listings (mismo ID).
   */
  async migrateProductsToListings(): Promise<{ total: number; migrated: number; skipped: number }> {
    try {
      // 1. Obtener todos los products (paginados)
      const allProducts: Product[] = [];
      let lastDoc: any = null;
      let hasMore = true;
      let iters = 0;

      while (hasMore && ++iters <= 30) {
        const q = query(collection(db, 'products'), limit(500));
        // Note: Firestore no soporta startAfter con un query simple de getDocs sin orderBy
        // Por simplicidad, usamos .offset() en producción sería mejor con cursor
        const snap = await getDocs(
          lastDoc
            ? query(collection(db, 'products'), limit(500))
            : query(collection(db, 'products'), limit(500))
        );

        // Para paginación real con cursor
        const allSnaps = await getDocs(query(collection(db, 'products'), limit(500)));
        allSnaps.docs.forEach((d, i) => {
          if (i >= allProducts.length) {
            allProducts.push({ id: d.id, ...d.data() } as Product);
          }
        });
        hasMore = false; // single pass for initial migration
      }

      // Usar todos los docs en una sola pasada
      const fullSnap = await getDocs(collection(db, 'products'));
      const products = fullSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      logger.log(`📦 migrateProductsToListings: ${products.length} products encontrados`);

      // 2. Obtener IDs de listings existentes
      const existingListings = new Set<string>();
      const listingsSnap = await getDocs(query(collection(db, 'listings'), limit(1000)));
      listingsSnap.docs.forEach(d => existingListings.add(d.id));

      // 3. Migrar en batches
      let migrated = 0;
      let skipped = 0;
      let batch = writeBatch(db);
      let opsInBatch = 0;

      for (const product of products) {
        if (existingListings.has(product.id)) {
          skipped++;
          continue;
        }

        const listingRef = doc(db, 'listings', product.id);
        batch.set(listingRef, productToListing(product));
        opsInBatch++;
        migrated++;

        if (opsInBatch >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          opsInBatch = 0;
          logger.log(`  ✅ Batch committed: ${migrated} listings migrated so far...`);
        }
      }

      if (opsInBatch > 0) {
        await batch.commit();
      }

      logger.log(`✅ migrateProductsToListings: ${migrated} migrated, ${skipped} skipped, ${products.length} total`);
      return { total: products.length, migrated, skipped };
    } catch (e) {
      logger.error('migrateProductsToListings error:', e);
      throw e;
    }
  },

  /**
   * Migración completa: venues→sellers + products→listings.
   */
  async migrateAll(): Promise<{
    venues: { total: number; migrated: number; skipped: number };
    products: { total: number; migrated: number; skipped: number };
  }> {
    logger.log('🚀 Iniciando migración completa marketplace...');
    const venues = await this.migrateVenuesToSellers();
    const products = await this.migrateProductsToListings();
    logger.log('✅ Migración completa finalizada.');
    return { venues, products };
  },
};