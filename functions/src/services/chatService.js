"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling } = require("../utils/errorHandler");
const { ResolveVenueChatTargetSchema } = require("../schemas");
const { isAdminRole } = require("./userService");

/**
 * Resolves the venue owner userId for a customer's order chat.
 */
const resolveVenueChatTarget = onCall(withErrorHandling("resolveVenueChatTarget", async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");

    const callerId = request.auth.uid;
    const chatParsed = ResolveVenueChatTargetSchema.safeParse(request.data || {});
    if (!chatParsed.success) throw new HttpsError("invalid-argument", "Invalid input.");
    const { orderId } = chatParsed.data;

    const allowed = await checkRateLimit(`${callerId}:resolveVenueChatTarget`, 20, 60 * 1000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Too many requests.");

    const [orderSnap, callerSnap] = await Promise.all([
        db.collection("orders").doc(orderId).get(),
        db.collection("users").doc(callerId).get(),
    ]);

    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    if (!callerSnap.exists) throw new HttpsError("permission-denied", "Caller profile not found.");

    const orderData = orderSnap.data() || {};
    const callerData = callerSnap.data() || {};
    const callerRole = callerData.role || "CUSTOMER";
    const isOrderOwner = orderData.customerId === callerId;

    if (!isOrderOwner && !isAdminRole(callerRole)) {
        throw new HttpsError("permission-denied", "Not allowed to resolve this order.");
    }

    const venueId = orderData.venueId;
    if (!venueId) throw new HttpsError("failed-precondition", "Order has no venueId.");

    const [byVenueIds, byVenueId] = await Promise.all([
        db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).get(),
        db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).get(),
    ]);

    const ownerDocs = [...byVenueIds.docs, ...byVenueId.docs];
    const uniqueUserIds = [...new Set(ownerDocs.map(doc => doc.id))];

    if (uniqueUserIds.length === 0) {
        try {
            const venueSnap = await db.collection("venues").doc(venueId).get();
            if (venueSnap.exists && venueSnap.data().ownerId) {
                const ownerRef = await db.collection("users").doc(venueSnap.data().ownerId).get();
                if (ownerRef.exists) {
                    return { userIds: [ownerRef.id], userName: ownerRef.data().fullName || "Restaurante", venueId };
                }
            }
        } catch (_) { /* Ignore error */ }
        throw new HttpsError("not-found", "Venue owner not found.");
    }

    const firstOwnerData = ownerDocs[0].data() || {};
    return { userIds: uniqueUserIds, userName: firstOwnerData.fullName || "Restaurante", venueId };
}));

module.exports = { resolveVenueChatTarget };
