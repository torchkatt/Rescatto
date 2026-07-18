"use strict";

/**
 * Rescatto Marketplace Functions — Firebase v2 (Gen 2)
 * createTransaction, createBooking, cancelTransaction, seedCategories
 */
const admin = require("firebase-admin");
const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();
const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateTransaction(data) {
    if (!data || typeof data !== "object") return false;
    if (!data.buyerId || !data.sellerId || !data.transactionType) return false;
    if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) return false;
    if (typeof data.totalAmount !== "number" || data.totalAmount <= 0) return false;
    return true;
}

// ─── createTransaction ─────────────────────────────────────────────────────────

exports.createTransaction = onCall(async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    if (request.data.buyerId !== request.auth.uid)
        throw new HttpsError("permission-denied", "No puedes crear transacciones para otro usuario.");
    if (!validateTransaction(request.data))
        throw new HttpsError("invalid-argument", "Datos de transacción inválidos.");

    try {
        const now = new Date().toISOString();
        const data = request.data;
        const subtotal = data.lineItems.reduce((s, i) => s + i.price * i.quantity, 0);
        // Get seller's commission rate from their subscription
        const sellerDoc = await db.collection("sellers").doc(data.sellerId).get();
        const sellerData = sellerDoc.data();
        const commissionRate = sellerData?.commissionRate || 0.10;
        const commission = data.commission || Math.round(subtotal * commissionRate);
        const sellerEarnings = Math.max(0, (data.sellerEarnings || subtotal - commission));

        const txRef = db.collection("transactions").doc();
        await txRef.set({
            ...data, id: txRef.id, status: "PENDING",
            subtotal, commission, sellerEarnings,
            createdAt: now, updatedAt: now,
            payment: { method: data.payment?.method || "wompi", id: data.payment?.id || "", status: data.payment?.status || "pending" },
        });

        db.collection("sellers").doc(data.sellerId).update({
            "stats.totalTransactions": admin.firestore.FieldValue.increment(1),
            "stats.totalRevenue": admin.firestore.FieldValue.increment(subtotal),
            updatedAt: now,
        }).catch(() => {});

        if (data.transactionType === "booking" && data.pickupWindow) {
            const bkRef = db.collection("bookings").doc();
            await bkRef.set({
                id: bkRef.id, transactionId: txRef.id,
                sellerId: data.sellerId, buyerId: data.buyerId,
                listingId: data.lineItems[0]?.listingId || "",
                startTime: data.pickupWindow.start, endTime: data.pickupWindow.end,
                status: "confirmed", createdAt: now,
            });
        }

        return { success: true, transactionId: txRef.id };
    } catch (error) {
        console.error("createTransaction error:", error);
        throw new HttpsError("internal", error.message || "Error al crear la transacción.");
    }
});

// ─── createBooking ─────────────────────────────────────────────────────────────

exports.createBooking = onCall(async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const { sellerId, listingId, startTime, endTime, notes } = request.data;
    if (!sellerId || !listingId || !startTime || !endTime)
        throw new HttpsError("invalid-argument", "Faltan campos requeridos.");

    try {
        const now = new Date().toISOString();
        const bkRef = db.collection("bookings").doc();
        await bkRef.set({
            id: bkRef.id, transactionId: "", sellerId,
            buyerId: request.auth.uid, listingId, startTime, endTime,
            status: "confirmed", notes: notes || "", createdAt: now,
        });
        return { success: true, bookingId: bkRef.id };
    } catch (error) {
        console.error("createBooking error:", error);
        throw new HttpsError("internal", error.message);
    }
});

// ─── cancelTransaction ─────────────────────────────────────────────────────────

exports.cancelTransaction = onCall(async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const { transactionId } = request.data;
    if (!transactionId)
        throw new HttpsError("invalid-argument", "transactionId requerido.");

    try {
        const txRef = db.collection("transactions").doc(transactionId);
        const tx = await txRef.get();
        if (!tx.exists) throw new HttpsError("not-found", "Transacción no encontrada.");
        const txData = tx.data();

        const userDoc = await db.collection("users").doc(request.auth.uid).get();
        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userDoc.data()?.role);
        if (txData.buyerId !== request.auth.uid && !isAdmin)
            throw new HttpsError("permission-denied", "No puedes cancelar esta transacción.");
        if (txData.status !== "PENDING")
            throw new HttpsError("failed-precondition", "Solo cancelaciones pendientes.");

        await txRef.update({ status: "CANCELLED", updatedAt: new Date().toISOString() });
        const bkSnap = await db.collection("bookings").where("transactionId", "==", transactionId).limit(1).get();
        bkSnap.forEach(d => d.ref.update({ status: "cancelled" }));
        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

// ─── seedCategories ────────────────────────────────────────────────────────────

exports.seedCategories = onCall(async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    const role = userDoc.data()?.role;
    if (!["SUPER_ADMIN", "ADMIN"].includes(role))
        throw new HttpsError("permission-denied", "Solo administradores.");

    const cats = [
        { n: "Comida", s: "comida", i: "🍽️", l: 0, o: 1 },
        { n: "Packs Sorpresa", s: "packs-sorpresa", i: "🎁", l: 1, o: 1, a: [{ n: "pickupWindow", t: "text", r: true, l: "Ventana de recogida" }, { n: "expiresAt", t: "text", r: true, l: "Expiración" }] },
        { n: "Platos Específicos", s: "platos-especificos", i: "🍝", l: 1, o: 2 },
        { n: "Bebidas", s: "bebidas", i: "🥤", l: 1, o: 3 },
        { n: "Tecnología", s: "tecnologia", i: "💻", l: 0, o: 2 },
        { n: "Electrónica", s: "electronica", i: "📱", l: 1, o: 1, a: [{ n: "brand", t: "text", r: true, l: "Marca" }, { n: "model", t: "text", r: true, l: "Modelo" }, { n: "condition", t: "select", r: true, l: "Condición", o: ["new", "used", "refurbished"] }] },
        { n: "Reparaciones", s: "reparaciones", i: "🔧", l: 1, o: 2, a: [{ n: "duration", t: "text", r: true, l: "Duración" }, { n: "location", t: "select", r: true, l: "Ubicación", o: ["presencial", "domicilio"] }] },
        { n: "Accesorios", s: "accesorios", i: "🎧", l: 1, o: 3 },
        { n: "Servicios", s: "servicios", i: "🛠️", l: 0, o: 3 },
        { n: "Belleza", s: "belleza", i: "💇", l: 1, o: 1, a: [{ n: "duration", t: "text", r: true, l: "Duración" }, { n: "availableSlots", t: "text", r: false, l: "Horarios" }] },
        { n: "Educación", s: "educacion", i: "📚", l: 1, o: 2, a: [{ n: "modality", t: "select", r: true, l: "Modalidad", o: ["online", "presencial"] }] },
        { n: "Hogar", s: "hogar", i: "🏠", l: 1, o: 3 },
        { n: "Transporte", s: "transporte", i: "🚗", l: 1, o: 4 },
        { n: "Digital", s: "digital", i: "📦", l: 0, o: 4 },
        { n: "Ebooks", s: "ebooks", i: "📖", l: 1, o: 1, a: [{ n: "format", t: "select", r: true, l: "Formato", o: ["PDF", "EPUB", "MOBI"] }, { n: "author", t: "text", r: true, l: "Autor" }] },
        { n: "Software", s: "software", i: "⚙️", l: 1, o: 2, a: [{ n: "platform", t: "select", r: true, l: "Plataforma", o: ["Windows", "Mac", "Linux", "Web", "Multi"] }, { n: "license", t: "select", r: true, l: "Licencia", o: ["personal", "commercial", "open-source"] }] },
        { n: "Plantillas", s: "plantillas", i: "📋", l: 1, o: 3 },
    ];

    const now = new Date().toISOString();
    const existingSnap = await db.collection("categories").limit(1).get();
    if (!existingSnap.empty) return { created: 0, skipped: true };

    const batch = db.batch();
    const rootIds = {};
    let created = 0;

    for (const c of cats.filter(c => c.l === 0)) {
        const ref = db.collection("categories").doc();
        rootIds[c.s] = ref.id;
        batch.set(ref, { name: c.n, slug: c.s, icon: c.i, parentId: null, listingAttributes: c.a || [], level: c.l, order: c.o, isActive: true, stats: { listingCount: 0, transactionCount: 0 }, createdAt: now, updatedAt: now });
        created++;
    }

    const pm = { "packs-sorpresa": "comida", "platos-especificos": "comida", "bebidas": "comida", "electronica": "tecnologia", "reparaciones": "tecnologia", "accesorios": "tecnologia", "belleza": "servicios", "educacion": "servicios", "hogar": "servicios", "transporte": "servicios", "ebooks": "digital", "software": "digital", "plantillas": "digital" };
    for (const c of cats.filter(c => c.l === 1)) {
        const ref = db.collection("categories").doc();
        batch.set(ref, { name: c.n, slug: c.s, icon: c.i, parentId: rootIds[pm[c.s]] || null, listingAttributes: c.a || [], level: c.l, order: c.o, isActive: true, stats: { listingCount: 0, transactionCount: 0 }, createdAt: now, updatedAt: now });
        created++;
    }

    await batch.commit();
    return { created, skipped: false };
});