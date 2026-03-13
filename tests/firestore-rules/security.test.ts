import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'rescatto-test-rules',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // ─── Venues & Products ────────────────────────────────────────────────────
  describe('Venues & Products (Public)', () => {
    it('should allow anyone to read venues', async () => {
      const alice = testEnv.unauthenticatedContext();
      await assertSucceeds(getDoc(doc(alice.firestore(), 'venues/v1')));
    });

    it('should allow anyone to read products', async () => {
      const alice = testEnv.unauthenticatedContext();
      await assertSucceeds(getDoc(doc(alice.firestore(), 'products/p1')));
    });

    it('should block guests from creating products', async () => {
      const alice = testEnv.unauthenticatedContext();
      await assertFails(addDoc(collection(alice.firestore(), 'products'), { name: 'Fake' }));
    });
  });

  // ─── Users ────────────────────────────────────────────────────────────────
  describe('Users', () => {
    it('should allow a user to read their own profile', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(getDoc(doc(alice.firestore(), 'users/alice')));
    });

    it('should block a user from reading another profile', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(getDoc(doc(alice.firestore(), 'users/bob')));
    });

    it('should block a regular user from deleting their profile', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(deleteDoc(doc(alice.firestore(), 'users/alice')));
    });
  });

  // ─── Carts ────────────────────────────────────────────────────────────────
  describe('Carts', () => {
    it('should allow a user to read/write their own cart', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const cartRef = doc(alice.firestore(), 'carts/alice');
      await assertSucceeds(setDoc(cartRef, { items: [] }));
      await assertSucceeds(getDoc(cartRef));
    });

    it('should block a user from reading another cart', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(getDoc(doc(alice.firestore(), 'carts/bob')));
    });
  });

  // ─── Orders (CF Only) ─────────────────────────────────────────────────────
  describe('Orders', () => {
    it('should block ALL users from creating orders directly', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(addDoc(collection(alice.firestore(), 'orders'), { status: 'PAID' }));
    });
  });

  // ─── Audit Logs ──────────────────────────────────────────────────────────
  describe('Audit Logs', () => {
    it('should allow any user to create a log for their own action', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(addDoc(collection(alice.firestore(), 'audit_logs'), {
        performedBy: 'alice',
        action: 'test_action',
        timestamp: new Date().toISOString()
      }));
    });

    it('should block a user from spoofing another user in logs', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(addDoc(collection(alice.firestore(), 'audit_logs'), {
        performedBy: 'bob',
        action: 'test_action',
        timestamp: new Date().toISOString()
      }));
    });
  });
});
