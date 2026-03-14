"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { withErrorHandling } = require("../utils/errorHandler");
const { GetFinanceStatsSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");

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

    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "SUPER_ADMIN") {
        throw new HttpsError("permission-denied", "Access denied.");
    }

    const finParsed = GetFinanceStatsSchema.safeParse(request.data || {});
    if (!finParsed.success) throw new HttpsError("invalid-argument", "Invalid dates.");
    const { startDate, endDate } = finParsed.data;

    let ordersQuery = db.collection("orders").where("status", "in", ["COMPLETED", "PAID"]);
    if (startDate) {
        ordersQuery = ordersQuery.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(new Date(startDate)));
    }
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        ordersQuery = ordersQuery.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endOfDay));
    }

    const snapshot = await ordersQuery.get();
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
const migrateVenueIdToVenueIds = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") throw new HttpsError("permission-denied", "Admin ONLY.");

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
    return { migrated };
});

module.exports = { aggregateAdminStats, getFinanceStats, migrateVenueIdToVenueIds };
