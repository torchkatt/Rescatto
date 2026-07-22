"use strict";

/**
 * Rescatto Marketplace Cloud Functions
 * createTransaction, createBooking, cancelTransaction, seedCategories
 */

const admin = require("firebase-admin");
const functions = require("firebase-functions");
const db = admin.firestore();
const { STATUS, canTransition } = require("../orderState");
const { log: logInfo, warn: logWarn, error: logError } = require("./utils/logger");

// ─── Rate limiting ──────────────────────────────────────────────────────────
const { checkRateLimit } = require("./utils/rateLimit");
const RL_WINDOW = 10_000; // 10 seconds
const RL_MAX = 5; // max 5 calls per user per 10s

async function rateGuard(uid, action) {
    const allowed = await checkRateLimit(`${uid}:${action}`, RL_MAX, RL_WINDOW);
    if (!allowed) throw new functions.https.HttpsError(
        "resource-exhausted", "Demasiadas solicitudes. Espera unos segundos.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateTransaction(data) {
    if (!data || typeof data !== "object") return false;
    if (!data.buyerId || !data.sellerId || !data.transactionType) return false;
    if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) return false;
    if (typeof data.totalAmount !== "number" || data.totalAmount <= 0) return false;
    return true;
}

// ─── Cloud Functions ──────────────────────────────────────────────────────────

/**
 * createTransaction — Crea una transacción de marketplace.
 */
exports.createTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    await rateGuard(context.auth.uid, "createTransaction");

    if (data.buyerId !== context.auth.uid)
        throw new functions.https.HttpsError("permission-denied", "No puedes crear transacciones para otro usuario.");

    if (!validateTransaction(data))
        throw new functions.https.HttpsError("invalid-argument", "Datos de transacción inválidos.");

    try {
        const now = new Date().toISOString();
        const subtotal = data.lineItems.reduce((s, i) => s + i.price * i.quantity, 0);
        // Get seller's commission rate from their subscription
        const sellerDoc = await db.collection("sellers").doc(data.sellerId).get();
        const sellerData = sellerDoc.data();
        const commissionRate = sellerData?.commissionRate || 0.10;
        const commission = data.commission || Math.round(subtotal * commissionRate);
        const sellerEarnings = Math.max(0, (data.sellerEarnings || subtotal - commission));

        const txRef = db.collection("transactions").doc();

        // ─── Stock reservation: decrementar quantity en listings ───
        if (data.lineItems && data.lineItems.length) {
            const listingRefs = data.lineItems
                .filter(i => i.listingId)
                .map(i => ({ ref: db.collection("listings").doc(i.listingId), qty: i.quantity || 1 }));
            await Promise.all(listingRefs.map(({ ref, qty }) =>
                ref.update({ quantity: admin.firestore.FieldValue.increment(-qty) }).catch(err => {
                    logWarn(`Stock reservation failed for ${ref.id}: ${err.message}`);
                })
            ));
        }

        const transaction = {
            ...data,
            id: txRef.id,
            status: STATUS.PENDING,
            subtotal,
            commission,
            sellerEarnings,
            createdAt: now,
            updatedAt: now,
            payment: { method: data.payment?.method || "wompi", id: data.payment?.id || "", status: data.payment?.status || "pending" },
        };

        await txRef.set(transaction);

        // Update seller stats (fire-and-forget con logging)
        db.collection("sellers").doc(data.sellerId).update({
            "stats.totalTransactions": admin.firestore.FieldValue.increment(1),
            "stats.totalRevenue": admin.firestore.FieldValue.increment(subtotal),
            updatedAt: now,
        }).catch((err) => console.error("createTransaction seller stats error:", err));

        // If booking type → create booking
        if (data.transactionType === "booking" && data.pickupWindow) {
            const bkRef = db.collection("bookings").doc();
            await bkRef.set({
                id: bkRef.id,
                transactionId: txRef.id,
                sellerId: data.sellerId,
                buyerId: data.buyerId,
                listingId: data.lineItems[0]?.listingId || "",
                startTime: data.pickupWindow.start,
                endTime: data.pickupWindow.end,
                status: "confirmed",
                createdAt: now,
            });
        }

        return { success: true, transactionId: txRef.id };
    } catch (error) {
        console.error("createTransaction error:", error);
        throw new functions.https.HttpsError("internal", "Error interno al procesar la transacción. Intenta de nuevo.");
    }
});

/**
 * createBooking — Crea un booking independiente para servicios.
 */
exports.createBooking = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    await rateGuard(context.auth.uid, "createBooking");

    const { sellerId, listingId, startTime, endTime, notes } = data;
    if (!sellerId || !listingId || !startTime || !endTime)
        throw new functions.https.HttpsError("invalid-argument", "Faltan campos requeridos.");

    try {
        const now = new Date().toISOString();
        const bkRef = db.collection("bookings").doc();
        await bkRef.set({
            id: bkRef.id,
            transactionId: "",
            sellerId,
            buyerId: context.auth.uid,
            listingId,
            startTime,
            endTime,
            status: "confirmed",
            notes: notes || "",
            createdAt: now,
        });
        return { success: true, bookingId: bkRef.id };
    } catch (error) {
        console.error("createBooking error:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * cancelTransaction — Cancela una transacción (buyer o admin).
 */
exports.cancelTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    await rateGuard(context.auth.uid, "cancelTransaction");

    const { transactionId } = data;
    if (!transactionId)
        throw new functions.https.HttpsError("invalid-argument", "transactionId requerido.");

    try {
        const txRef = db.collection("transactions").doc(transactionId);
        const tx = await txRef.get();
        if (!tx.exists)
            throw new functions.https.HttpsError("not-found", "Transacción no encontrada.");

        const txData = tx.data();
        const userDoc = await db.collection("users").doc(context.auth.uid).get();
        const userRole = userDoc.data()?.role;
        const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

        if (txData.buyerId !== context.auth.uid && !isAdmin)
            throw new functions.https.HttpsError("permission-denied", "No puedes cancelar esta transacción.");

        if (txData.status !== STATUS.PENDING && txData.status !== STATUS.PAID)
            throw new functions.https.HttpsError("failed-precondition", "Solo se pueden cancelar transacciones pendientes.");

        // ─── Stock restitution: restaurar quantity en listings ───
        if (txData.lineItems && txData.lineItems.length) {
            const listingRefs = txData.lineItems
                .filter(i => i.listingId)
                .map(i => ({ ref: db.collection("listings").doc(i.listingId), qty: i.quantity || 1 }));
            await Promise.all(listingRefs.map(({ ref, qty }) =>
                ref.update({ quantity: admin.firestore.FieldValue.increment(qty) }).catch(err => {
                    console.warn("Stock restitution failed for", ref.id, err.message);
                })
            ));
        }

        await txRef.update({ status: STATUS.CANCELLED, updatedAt: new Date().toISOString() });

        // Cancel associated booking
        const bkSnap = await db.collection("bookings").where("transactionId", "==", transactionId).limit(1).get();
        bkSnap.forEach(d => d.ref.update({ status: "cancelled" }));

        return { success: true };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error("cancelTransaction error:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * seedCategories — Seed de categorías marketplace (idempotente). Solo SUPER_ADMIN.
 */
exports.seedCategories = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");

    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = userDoc.data()?.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN")
        throw new functions.https.HttpsError("permission-denied", "Solo administradores.");

    const categories = [
        { name: "Comida", slug: "comida", icon: "🍽️", parentId: null, level: 0, order: 1, listingAttributes: [] },
        { name: "Packs Sorpresa", slug: "packs-sorpresa", icon: "🎁", parentId: null, level: 1, order: 1, listingAttributes: [{ name: "pickupWindow", type: "text", required: true, label: "Ventana de recogida" }, { name: "expiresAt", type: "text", required: true, label: "Fecha de expiración" }] },
        { name: "Platos Específicos", slug: "platos-especificos", icon: "🍝", parentId: null, level: 1, order: 2, listingAttributes: [] },
        { name: "Bebidas", slug: "bebidas", icon: "🥤", parentId: null, level: 1, order: 3, listingAttributes: [] },
        { name: "Tecnología", slug: "tecnologia", icon: "💻", parentId: null, level: 0, order: 2, listingAttributes: [] },
        { name: "Electrónica", slug: "electronica", icon: "📱", parentId: null, level: 1, order: 1, listingAttributes: [{ name: "brand", type: "text", required: true, label: "Marca" }, { name: "model", type: "text", required: true, label: "Modelo" }, { name: "condition", type: "select", required: true, label: "Condición", options: ["new", "used", "refurbished"] }] },
        { name: "Reparaciones", slug: "reparaciones", icon: "🔧", parentId: null, level: 1, order: 2, listingAttributes: [{ name: "duration", type: "text", required: true, label: "Duración" }, { name: "location", type: "select", required: true, label: "Ubicación", options: ["presencial", "domicilio"] }] },
        { name: "Accesorios", slug: "accesorios", icon: "🎧", parentId: null, level: 1, order: 3, listingAttributes: [] },
        { name: "Servicios", slug: "servicios", icon: "🛠️", parentId: null, level: 0, order: 3, listingAttributes: [] },
        { name: "Belleza", slug: "belleza", icon: "💇", parentId: null, level: 1, order: 1, listingAttributes: [{ name: "duration", type: "text", required: true, label: "Duración" }, { name: "availableSlots", type: "text", required: false, label: "Horarios" }] },
        { name: "Educación", slug: "educacion", icon: "📚", parentId: null, level: 1, order: 2, listingAttributes: [{ name: "modality", type: "select", required: true, label: "Modalidad", options: ["online", "presencial"] }] },
        { name: "Hogar", slug: "hogar", icon: "🏠", parentId: null, level: 1, order: 3, listingAttributes: [] },
        { name: "Transporte", slug: "transporte", icon: "🚗", parentId: null, level: 1, order: 4, listingAttributes: [] },
        { name: "Digital", slug: "digital", icon: "📦", parentId: null, level: 0, order: 4, listingAttributes: [] },
        { name: "Ebooks", slug: "ebooks", icon: "📖", parentId: null, level: 1, order: 1, listingAttributes: [{ name: "format", type: "select", required: true, label: "Formato", options: ["PDF", "EPUB", "MOBI"] }, { name: "author", type: "text", required: true, label: "Autor" }] },
        { name: "Software", slug: "software", icon: "⚙️", parentId: null, level: 1, order: 2, listingAttributes: [{ name: "platform", type: "select", required: true, label: "Plataforma", options: ["Windows", "Mac", "Linux", "Web", "Multi"] }, { name: "license", type: "select", required: true, label: "Licencia", options: ["personal", "commercial", "open-source"] }] },
        { name: "Plantillas", slug: "plantillas", icon: "📋", parentId: null, level: 1, order: 3, listingAttributes: [] },
    ];

    const now = new Date().toISOString();
    const existingSnap = await db.collection("categories").limit(1).get();
    if (!existingSnap.empty) return { created: 0, skipped: true, message: "Ya existen categorías." };

    const batch = db.batch();
    const rootIds = {};
    let created = 0;

    for (const cat of categories.filter(c => c.level === 0)) {
        const ref = db.collection("categories").doc();
        rootIds[cat.slug] = ref.id;
        batch.set(ref, { ...cat, stats: { listingCount: 0, transactionCount: 0 }, isActive: true, createdAt: now, updatedAt: now });
        created++;
    }

    const parentMap = {
        "packs-sorpresa": rootIds["comida"], "platos-especificos": rootIds["comida"], "bebidas": rootIds["comida"],
        "electronica": rootIds["tecnologia"], "reparaciones": rootIds["tecnologia"], "accesorios": rootIds["tecnologia"],
        "belleza": rootIds["servicios"], "educacion": rootIds["servicios"], "hogar": rootIds["servicios"], "transporte": rootIds["servicios"],
        "ebooks": rootIds["digital"], "software": rootIds["digital"], "plantillas": rootIds["digital"],
    };

    for (const cat of categories.filter(c => c.level === 1)) {
        const ref = db.collection("categories").doc();
        batch.set(ref, { ...cat, parentId: parentMap[cat.slug] || null, stats: { listingCount: 0, transactionCount: 0 }, isActive: true, createdAt: now, updatedAt: now });
        created++;
    }

    await batch.commit();
    return { created, skipped: false };
});