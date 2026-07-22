import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const USER_A = 'user-a';
const USER_B = 'user-b';
const ADMIN = 'admin-1';
const VENUE_ID = 'venue-1';
const VENUE_OWNER = 'owner-1';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rescatto-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed con Admin SDK — estado base
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('venues').doc(VENUE_ID).set({
      ownerId: VENUE_OWNER, name: 'Test Venue', isActive: true,
      address: 'Calle 123', city: 'Bogotá', businessType: 'Restaurante',
      deliveryModel: 'pickup',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    await db.collection('orders').doc('order-1').set({
      customerId: USER_A, venueId: VENUE_ID, status: 'PENDING',
      totalAmount: 50000, venueEarnings: 45000,
      paymentStatus: 'pending', deliveryMethod: 'pickup',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
  });
});

function asUser(uid: string, role = 'CUSTOMER', email?: string) {
  return testEnv.authenticatedContext(uid, { role, email: email || `${uid}@test.com` }).firestore();
}
function asAdmin() {
  return testEnv.authenticatedContext(ADMIN, { role: 'SUPER_ADMIN' }).firestore();
}

describe('users — no auto-escalación de rol', () => {
  it('usuario se puede crear como CUSTOMER', async () => {
    const db = asUser(USER_B);
    await assertSucceeds(setDoc(doc(db, 'users', USER_B), {
      fullName: 'Test', email: 'user-b@test.com', role: 'CUSTOMER', createdAt: '2026-01-01T00:00:00Z',
    }));
  });
  it('usuario NO se puede crear como ADMIN', async () => {
    const db = asUser(USER_B);
    await assertFails(setDoc(doc(db, 'users', USER_B), {
      fullName: 'Test', email: 'user-b@test.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00Z',
    }));
  });
  it('usuario no puede actualizar su propio role a ADMIN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc(USER_B).set({
        fullName: 'Test', email: 'x@x.com', role: 'CUSTOMER', createdAt: '2026-01-01T00:00:00Z',
      });
    });
    await assertFails(updateDoc(doc(asUser(USER_B), 'users', USER_B), { role: 'ADMIN' }));
  });
});

describe('transactions — solo Cloud Functions', () => {
  it('cliente no puede crear transactions directamente', async () => {
    await assertFails(setDoc(doc(asUser(USER_A), 'transactions', 'tx-fake'), {
      buyerId: USER_A, sellerId: VENUE_OWNER, status: 'PENDING', totalAmount: 10000,
    }));
  });
});

describe('orders — solo transiciones permitidas', () => {
  it('cliente puede cancelar su propio pedido PENDING', async () => {
    const db = asUser(USER_A);
    await assertSucceeds(updateDoc(doc(db, 'orders', 'order-1'), {
      status: 'CANCELLED', cancellationReason: 'CLIENT_CANCELLED',
      cancelledAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    }));
  });
  it('cliente no puede cambiar totalAmount', async () => {
    await assertFails(updateDoc(doc(asUser(USER_A), 'orders', 'order-1'), { totalAmount: 1 }));
  });
  it('otro usuario no puede leer pedido ajeno', async () => {
    await assertFails(getDoc(doc(asUser(USER_B), 'orders', 'order-1')));
  });
  it('admin puede leer cualquier pedido', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'orders', 'order-1')));
  });
});

describe('venues — dueño puede editar, no suplantar', () => {
  it('dueño puede actualizar su venue', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc(VENUE_OWNER).set({
        role: 'VENUE_OWNER', venueId: VENUE_ID, fullName: 'Owner',
      });
    });
    const db = testEnv.authenticatedContext(VENUE_OWNER, { role: 'VENUE_OWNER', v: { [VENUE_ID]: true } }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'venues', VENUE_ID), { name: 'Updated' }));
  });
  it('usuario sin permisos no puede editar venue ajeno', async () => {
    await assertFails(updateDoc(doc(asUser(USER_B), 'venues', VENUE_ID), { name: 'Hacked' }));
  });
});

describe('colecciones internas — solo backend', () => {
  it('webhook_dedup no es accesible desde el cliente', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'webhook_dedup', 'evt-1')));
    await assertFails(setDoc(doc(asAdmin(), 'webhook_dedup', 'evt-1'), { processedAt: 1 }));
  });
  it('audit_logs: admin lee, nadie escribe', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('audit_logs').doc('log-1').set({ action: 'test' });
    });
    await assertSucceeds(getDoc(doc(asAdmin(), 'audit_logs', 'log-1')));
    await assertFails(setDoc(doc(asAdmin(), 'audit_logs', 'log-2'), { action: 'x' }));
  });
});
