"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { log, error: logError } = require("../utils/logger");
const { withSecurityBunker } = require("../utils/errorHandler");
const { writeAuditLog } = require("../utils/audit");

// ─── Constantes de riesgo ────────────────────────────────────────────────────

const RISK = {
    MAX_ORDERS_PER_HOUR: 5,
    MAX_ORDERS_PER_DAY: 15,
    MAX_ORDER_AMOUNT_COP: 500_000,    // Ordenes > 500k COP se revisan
    NEW_ACCOUNT_HOURS: 1,             // Cuenta < 1h con orden grande
    NEW_ACCOUNT_LARGE_ORDER: 100_000, // Umbral "grande" para cuenta nueva
    MAX_DISTANCE_KM: 30,              // Entrega > 30km del venue
    SCORE_FLAG_THRESHOLD: 60,         // Score >= 60 → flag para revisión
    SCORE_BLOCK_THRESHOLD: 90,        // Score >= 90 → bloqueo automático
};

// ─── Cálculo de score de riesgo ──────────────────────────────────────────────

/**
 * Evalúa una orden recién creada y calcula su riesgo de fraude.
 * Retorna el score (0-100) y las razones.
 */
async function evaluateOrderRisk(orderId, userId, orderData) {
    const now = Date.now();
    const reasons = [];
    let score = 0;

    try {
        // ── 1. Frecuencia de órdenes (última hora / último día) ──────────────
        const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
        const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

        const [hourSnap, daySnap] = await Promise.all([
            db.collection("orders")
                .where("customerId", "==", userId)
                .where("createdAt", ">=", oneHourAgo)
                .get(),
            db.collection("orders")
                .where("customerId", "==", userId)
                .where("createdAt", ">=", oneDayAgo)
                .get(),
        ]);

        const ordersLastHour = hourSnap.size;
        const ordersLastDay  = daySnap.size;

        if (ordersLastHour >= RISK.MAX_ORDERS_PER_HOUR) {
            score += 35;
            reasons.push(`${ordersLastHour} órdenes en la última hora`);
        }
        if (ordersLastDay >= RISK.MAX_ORDERS_PER_DAY) {
            score += 20;
            reasons.push(`${ordersLastDay} órdenes en el último día`);
        }

        // ── 2. Monto elevado ─────────────────────────────────────────────────
        const amount = Number(orderData.totalAmount) || 0;
        if (amount > RISK.MAX_ORDER_AMOUNT_COP) {
            score += 20;
            reasons.push(`Monto elevado: $${amount.toLocaleString("es-CO")} COP`);
        }

        // ── 3. Cuenta nueva con monto alto ───────────────────────────────────
        const userSnap = await db.collection("users").doc(userId).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            const createdAt = userData.createdAt?.toDate?.() || null;
            if (createdAt) {
                const accountAgeHours = (now - createdAt.getTime()) / 3_600_000;
                if (accountAgeHours < RISK.NEW_ACCOUNT_HOURS && amount >= RISK.NEW_ACCOUNT_LARGE_ORDER) {
                    score += 30;
                    reasons.push(`Cuenta < 1h con orden de $${amount.toLocaleString("es-CO")} COP`);
                }
            }
        }

        // ── 4. Distancia venue → entrega ─────────────────────────────────────
        if (orderData.venueCoords && orderData.customerLat && orderData.customerLng) {
            const { calculateDistance } = require("../utils/location");
            const distKm = calculateDistance(
                orderData.venueCoords.latitude, orderData.venueCoords.longitude,
                orderData.customerLat, orderData.customerLng
            );
            if (distKm > RISK.MAX_DISTANCE_KM) {
                score += 25;
                reasons.push(`Distancia de entrega: ${distKm.toFixed(1)} km`);
            }
        }

        return { score: Math.min(score, 100), reasons, ordersLastHour, ordersLastDay };
    } catch (e) {
        logError("evaluateOrderRisk error", e);
        return { score: 0, reasons: [], ordersLastHour: 0, ordersLastDay: 0 };
    }
}

// ─── evaluateOrderFraud (callable interna) ───────────────────────────────────

/**
 * Evalúa el riesgo de una orden recién creada y escribe en fraud_metrics.
 * Llamada desde orderService después de createOrder exitosa.
 */
/**
 * CF pública para re-evaluar una orden manualmente desde admin.
 * En creación automática se usa runFraudEvaluation (no bloqueante).
 */
const evaluateOrderFraud = onCall(
    { timeoutSeconds: 15, memory: "256MiB" },
    withSecurityBunker("evaluateOrderFraud", async (request) => {
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderSnap = await db.collection("orders").doc(orderId).get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Orden no encontrada.");
        const order = orderSnap.data();

        return runFraudEvaluation(orderId, order.customerId, order);
    })
);

// ─── getFraudMetrics (admin) ─────────────────────────────────────────────────

/**
 * Retorna métricas de fraude paginadas para el dashboard admin.
 */
const getFraudMetrics = onCall(
    { timeoutSeconds: 15, memory: "256MiB" },
    withSecurityBunker("getFraudMetrics", async (request) => {
        const { flaggedOnly = true, limit: pageLimit = 50 } = request.data || {};

        let q = db.collection("fraud_metrics").orderBy("score", "desc").limit(pageLimit);
        if (flaggedOnly) q = q.where("isFlagged", "==", true);

        const snap = await q.get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    })
);

// ─── resolveFlag (admin) ─────────────────────────────────────────────────────

/**
 * Admin marca una entrada de fraud_metrics como revisada.
 */
const resolveFraudFlag = onCall(
    { timeoutSeconds: 10, memory: "256MiB" },
    withSecurityBunker("resolveFraudFlag", async (request) => {
        const { metricId, resolution } = request.data || {};
        if (!metricId) throw new HttpsError("invalid-argument", "metricId requerido.");

        await db.collection("fraud_metrics").doc(metricId).update({
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: request.auth.uid,
            resolution: resolution || "reviewed",
        });

        await writeAuditLog({
            action: "FRAUD_FLAG_RESOLVED",
            performedBy: request.auth.uid,
            targetId: metricId,
            targetType: "fraud_metric",
            metadata: { resolution },
        });

        return { success: true };
    })
);

/**
 * Punto de entrada para evaluar fraude en una orden.
 * Llama a evaluateOrderRisk y persiste el resultado en fraud_metrics.
 * Diseñado para ser llamado de forma no bloqueante desde createOrder.
 */
async function runFraudEvaluation(orderId, userId, orderData) {
    const { score, reasons, ordersLastHour, ordersLastDay } = await evaluateOrderRisk(orderId, userId, orderData);
    const isFlagged = score >= RISK.SCORE_FLAG_THRESHOLD;
    const isBlocked = score >= RISK.SCORE_BLOCK_THRESHOLD;

    const metricsRef = db.collection("fraud_metrics").doc(`${userId}_${orderId}`);
    await metricsRef.set({
        userId,
        orderId,
        score,
        reasons,
        ordersLastHour,
        ordersLastDay,
        isFlagged,
        isBlocked,
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        orderAmount: orderData.totalAmount || 0,
        venueId: orderData.venueId,
    });

    if (isFlagged) {
        await writeAuditLog({
            action: isBlocked ? "FRAUD_ORDER_BLOCKED" : "FRAUD_ORDER_FLAGGED",
            performedBy: "system",
            targetId: orderId,
            targetType: "order",
            metadata: { userId, score, reasons },
        });
        log(`runFraudEvaluation: score=${score}`, { orderId, userId, reasons });
    }

    return { score, isFlagged, isBlocked };
}

module.exports = { evaluateOrderFraud, getFraudMetrics, resolveFraudFlag, runFraudEvaluation };
