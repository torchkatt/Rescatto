/**
 * Data Integrity Verification Script ("Data Doctor")
 * This script scans Firestore collections and validates them against Zod schemas.
 * Usage: npx ts-node scripts/verifyDataIntegrity.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as schemas from '../schemas';
import { logger } from '../utils/logger';

// NOTE: This script requires a service account key. 
// In a real environment, you would use GOOGLE_APPLICATION_CREDENTIALS.
// For this environment, we assume the environment is already authorized if running via firebase-admin.

const app = initializeApp();
const db = getFirestore();

async function verifyCollection(collectionName: string, schemaName: string) {
  logger.log(`--- Verifying Collection: ${collectionName} ---`);
  const snapshot = await db.collection(collectionName).get();
  let invalidCount = 0;
  
  const schema = (schemas as any)[schemaName];
  if (!schema) {
    logger.error(`Schema ${schemaName} not found in schemas/index.ts`);
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    const result = schema.safeParse(data);
    if (!result.success) {
      invalidCount++;
      logger.error(`[INVALID] ${collectionName}/${doc.id}:`, result.error.format());
    }
  });

  logger.log(`Verification complete. Found ${invalidCount} invalid documents in ${collectionName}.`);
}

async function run() {
  try {
    // Add collections you want to verify here
    await verifyCollection('users', 'UserSchema'); // Assuming UserSchema exists
    await verifyCollection('venues', 'VenueSchema');
    await verifyCollection('products', 'ProductSchema');
    await verifyCollection('orders', 'OrderSchema');
    
    logger.log('Data Integrity scan finished.');
  } catch (err) {
    logger.error('Data Integrity scan failed:', err);
  }
}

run();
