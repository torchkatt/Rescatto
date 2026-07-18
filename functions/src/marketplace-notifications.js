"use strict";

const functions = require("firebase-functions");
const { db, admin } = require("./admin");

/**
 * Firestore trigger: when a new transaction is created with status PENDING.
 * Creates a notification for the seller.
 */
exports.onTransactionCreated = functions.firestore
    .document("transactions/{txId}")
    .onCreate(async (snap, context) => {
        const tx = snap.data();
        if (!tx || tx.status !== "PENDING") return;

        const sellerId = tx.sellerId;
        if (!sellerId) return;

        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            userId: sellerId,
            title: "Nueva venta",
            message: "Has recibido una nueva orden",
            type: "transaction",
            link: "/seller-dashboard",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

/**
 * Firestore trigger: when a new booking is created.
 * Creates a notification for the seller.
 */
exports.onBookingCreated = functions.firestore
    .document("bookings/{bookingId}")
    .onCreate(async (snap, context) => {
        const booking = snap.data();
        if (!booking) return;

        const sellerId = booking.sellerId;
        if (!sellerId) return;

        const notificationRef = db.collection("notifications").doc();
        await notificationRef.set({
            userId: sellerId,
            title: "Nueva reserva",
            message: "Tienes una nueva reserva",
            type: "booking",
            link: "/seller-dashboard",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
