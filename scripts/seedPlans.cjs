/**
 * Seed subscription_plans using Firebase Admin SDK.
 * Uses application default credentials (from firebase login).
 */
const admin = require('firebase-admin');

try {
  admin.initializeApp({
    projectId: 'rescatto-c8d2b',
  });
} catch (e) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'rescatto-c8d2b',
  });
}

const db = admin.firestore();

const plans = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    features: [
      '10% comisión por venta',
      'Productos ilimitados',
      'Perfil de tienda público',
      'Estadísticas básicas',
    ],
    period: 'monthly',
    commissionRate: 0.10,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seller_pass_monthly',
    name: 'Seller Pass Mensual',
    price: 49900,
    features: [
      '5% comisión por venta',
      'Productos destacados en búsqueda',
      'Analytics avanzados',
      'Soporte prioritario 24/7',
      'Badge de verificado',
    ],
    period: 'monthly',
    commissionRate: 0.05,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seller_pass_annual',
    name: 'Seller Pass Anual',
    price: 499900,
    features: [
      '5% comisión por venta',
      'Todo lo de Mensual',
      'Multi-sucursal',
      'Reportes personalizados',
      'Facturación electrónica',
    ],
    period: 'annual',
    commissionRate: 0.05,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

(async () => {
  try {
    const batch = db.batch();
    for (const p of plans) {
      const ref = db.collection('subscription_plans').doc(p.id);
      batch.set(ref, p, { merge: true });
    }
    await batch.commit();
    console.log(`✅ ${plans.length} planes sembrados en subscription_plans:`);
    plans.forEach(p => console.log(`   • ${p.id}: ${p.name} — $${p.price} — ${p.commissionRate * 100}% comisión`));
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
