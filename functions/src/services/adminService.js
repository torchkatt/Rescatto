"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { withErrorHandling } = require("../utils/errorHandler");
const { GetFinanceStatsSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");
const { checkRateLimit } = require("../utils/rateLimit");

/**
 * Verifies caller is SUPER_ADMIN or ADMIN. Throws HttpsError if not.
 */
async function verifyAdminAccess(uid) {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) throw new HttpsError("permission-denied", "User not found.");
    const role = userDoc.data().role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
        throw new HttpsError("permission-denied", "Admin access required.");
    }
    return { role, userData: userDoc.data() };
}

/**
 * Global and per-venue stats aggregation on COMPLETED orders.
 */
const aggregateAdminStats = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();

    if (previousValue.status === "COMPLETED" || newValue.status !== "COMPLETED") return;

    const totalAmount = newValue.totalAmount || 0;
    const venueId = newValue.venueId;
    const co2Saved = Number(newValue.estimatedCo2 || newValue.co2Saved || 0.5);

    const batch = db.batch();
    const globalRef = db.collection("stats").doc("global");
    batch.set(globalRef, {
        totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
        totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
        totalCO2Saved: admin.firestore.FieldValue.increment(co2Saved),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (venueId) {
        const venueRef = db.collection("stats_venues").doc(venueId);
        batch.set(venueRef, {
            totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
            totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
            totalCO2Saved: admin.firestore.FieldValue.increment(co2Saved),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    try {
        await batch.commit();
        log(`Stats aggregated for order ${event.params.orderId}`);
    } catch (e) { logError(`Stats aggregation error (${event.params.orderId})`, e); }
});

/**
 * Returns platform financial stats (Super Admin only).
 */
const getFinanceStats = onCall(withErrorHandling("getFinanceStats", async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    await verifyAdminAccess(request.auth.uid);

    const finParsed = GetFinanceStatsSchema.safeParse(request.data || {});
    if (!finParsed.success) throw new HttpsError("invalid-argument", "Invalid dates.");
    const { startDate, endDate } = finParsed.data;

    const startTs = startDate ? admin.firestore.Timestamp.fromDate(new Date(startDate)) : null;
    const endTs = endDate ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return admin.firestore.Timestamp.fromDate(d); })() : null;

    const buildQuery = (status) => {
        let q = db.collection("orders").where("status", "==", status);
        if (startTs) q = q.where("createdAt", ">=", startTs);
        if (endTs) q = q.where("createdAt", "<=", endTs);
        return q.get();
    };

    const [completedSnap, paidSnap] = await Promise.all([buildQuery("COMPLETED"), buildQuery("PAID")]);
    const allDocs = [...completedSnap.docs, ...paidSnap.docs];
    const snapshot = { forEach: (fn) => allDocs.forEach(fn) };
    let totalRevenue = 0, totalPlatformFee = 0, totalVenueEarnings = 0, totalOrders = 0;
    const venueBreakdown = {};

    snapshot.forEach(doc => {
        const order = doc.data();
        const subtotal = Number(order.subtotal) || 0;
        const platformFee = Number(order.platformFee) || subtotal * 0.10;
        const venueEarnings = Number(order.venueEarnings) || subtotal * 0.85; // Fallback

        totalRevenue += subtotal;
        totalPlatformFee += platformFee;
        totalVenueEarnings += venueEarnings;
        totalOrders++;

        const vId = order.venueId || "unknown";
        if (!venueBreakdown[vId]) venueBreakdown[vId] = { venueId: vId, revenue: 0, orders: 0, platformFee: 0 };
        venueBreakdown[vId].revenue += subtotal;
        venueBreakdown[vId].orders++;
        venueBreakdown[vId].platformFee += platformFee;
    });

    return {
        totalRevenue, totalPlatformFee, totalVenueEarnings, totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topVenues: Object.values(venueBreakdown).sort((a,b) => b.revenue - a.revenue).slice(0, 10),
        periodStart: startDate || null, periodEnd: endDate || null,
    };
}));

/**
 * Admin utility: migrate venueId to venueIds array.
 */
const migrateVenueIdToVenueIds = onCall(withErrorHandling("migrateVenueIdToVenueIds", async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    await verifyAdminAccess(request.auth.uid);

    const allowed = await checkRateLimit(`migrate:${request.auth.uid}`, 1, 86400000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Esta migración solo puede ejecutarse una vez por día.");

    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let migrated = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.venueId && (!data.venueIds || !data.venueIds.includes(data.venueId))) {
            batch.update(doc.ref, { venueIds: admin.firestore.FieldValue.arrayUnion(data.venueId) });
            migrated++;
        }
    });

    if (migrated > 0) await batch.commit();

    await db.collection("audit_logs").add({
        action: "MIGRATE_VENUE_ID_TO_VENUE_IDS",
        performedBy: request.auth.uid,
        details: { migrated },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    log(`migrateVenueIdToVenueIds: ${migrated} users migrated by ${request.auth.uid}`);
    return { migrated };
}));

/**
 * Admin: registra un pago manual de comisión o liquidación a un negocio. Solo SUPER_ADMIN.
 * - type "DEBT_PAYMENT": el negocio paga su deuda a Rescatto → balance sube (deuda disminuye)
 * - type "PAYOUT": Rescatto le paga al negocio sus ganancias → balance baja
 */
const recordManualSettlement = onCall(withErrorHandling("recordManualSettlement", async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    await verifyAdminAccess(request.auth.uid);

    const { venueId, amount, type, description } = request.data || {};
    if (!venueId || !amount || !type || !description) {
        throw new HttpsError("invalid-argument", "Faltan campos requeridos: venueId, amount, type, description.");
    }
    if (!["DEBT_PAYMENT", "PAYOUT"].includes(type)) {
        throw new HttpsError("invalid-argument", "type debe ser DEBT_PAYMENT o PAYOUT.");
    }
    if (typeof amount !== "number" || amount <= 0) {
        throw new HttpsError("invalid-argument", "amount debe ser un número positivo.");
    }

    await db.runTransaction(async (tx) => {
        const walletRef = db.collection("wallets").doc(venueId);
        const walletDoc = await tx.get(walletRef);
        const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;

        // DEBT_PAYMENT: negocio paga → sube balance (menos negativo / más crédito)
        // PAYOUT: Rescatto paga → baja balance
        const adjustment = type === "DEBT_PAYMENT" ? amount : -amount;
        const newBalance = currentBalance + adjustment;

        tx.set(walletRef, {
            venueId,
            balance: newBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        const txRef = db.collection("wallet_transactions").doc();
        tx.set(txRef, {
            venueId,
            type: type === "DEBT_PAYMENT" ? "CREDIT" : "DEBIT",
            amount,
            description,
            referenceType: type,
            createdAt: new Date().toISOString(),
            recordedBy: request.auth.uid,
        });
    });

    log(`Settlement recorded for venue ${venueId}: type=${type}, amount=${amount}`);
    return { success: true };
}));

module.exports = { aggregateAdminStats, getFinanceStats, migrateVenueIdToVenueIds, recordManualSettlement };
