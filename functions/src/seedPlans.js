/**
 * seedPlans — Callable function para sembrar planes de suscripción.
 * Solo ejecutable por administradores.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

const PLANS = [
  {
    id: "free",
    name: "Gratuito",
    price: 0,
    features: [
      "10% comisión por venta",
      "Productos ilimitados",
      "Perfil de tienda público",
      "Estadísticas básicas",
    ],
    period: "monthly",
    commissionRate: 0.10,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seller_pass_monthly",
    name: "Seller Pass Mensual",
    price: 49900,
    features: [
      "5% comisión por venta",
      "Productos destacados en búsqueda",
      "Analytics avanzados",
      "Soporte prioritario 24/7",
      "Badge de verificado",
    ],
    period: "monthly",
    commissionRate: 0.05,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "seller_pass_annual",
    name: "Seller Pass Anual",
    price: 499900,
    features: [
      "5% comisión por venta",
      "Todo lo de Mensual",
      "Multi-sucursal",
      "Reportes personalizados",
      "Facturación electrónica",
    ],
    period: "annual",
    commissionRate: 0.05,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

exports.seedPlans = functions.https.onCall(async (data, context) => {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    for (const plan of PLANS) {
      const ref = db.collection("subscription_plans").doc(plan.id);
      batch.set(ref, plan, { merge: true });
    }
    await batch.commit();
    return { success: true, count: PLANS.length };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
