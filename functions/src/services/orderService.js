"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db, messaging } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling, withSecurityBunker } = require("../utils/errorHandler");
const { CreateOrderSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");
const { CONFIG } = require("../utils/config");
const { writeAuditLog } = require("../utils/audit");
const { publishMessage } = require("../utils/pubsub");
const { calculateDistance } = require("../utils/location");

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Envía FCM a un usuario por su userId.
 * Retorna silenciosamente si no tiene token.
 */
async function sendFcmToUser(userId, title, body, data = {}) {
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) return;
        const token = userDoc.data().fcmToken;
        if (!token) return;
        await messaging.send({ notification: { title, body }, token, data });
    } catch (e) {
        logError(`sendFcmToUser(${userId}) error`, e);
    }
}

/**
 * Envía FCM a todo el personal de un venue (VENUE_OWNER + KITCHEN_STAFF).
 * Retorna los tokens encontrados para usos posteriores.
 */
async function sendFcmToVenueStaff(venueId, title, body, data = {}) {
    try {
        const [ownersByArr, ownersByStr, staffByArr, staffByStr] = await Promise.all([
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).get(),
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).get(),
            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueIds", "array-contains", venueId).get(),
            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueId", "==", venueId).get(),
        ]);
        const userMap = new Map();
        [...ownersByArr.docs, ...ownersByStr.docs, ...staffByArr.docs, ...staffByStr.docs]
            .forEach(doc => userMap.set(doc.id, doc.data()));

        const tokens = [];
        userMap.forEach(userData => { if (userData.fcmToken) tokens.push(userData.fcmToken); });
        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data });
        }
        return { userMap, tokens };
    } catch (e) {
        logError(`sendFcmToVenueStaff(${venueId}) error`, e);
        return { userMap: new Map(), tokens: [] };
    }
}

/**
 * Envía FCM solo al VENUE_OWNER de un venue.
 */
async function sendFcmToVenueOwner(venueId, title, body, data = {}) {
    try {
        const [ownersByArr, ownersByStr] = await Promise.all([
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).get(),
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).get(),
        ]);
        const ownerMap = new Map();
        [...ownersByArr.docs, ...ownersByStr.docs].forEach(doc => ownerMap.set(doc.id, doc.data()));
        const tokens = [];
        ownerMap.forEach(ud => { if (ud.fcmToken) tokens.push(ud.fcmToken); });
        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data });
        }
    } catch (e) {
        logError(`sendFcmToVenueOwner(${venueId}) error`, e);
    }
}

/**
 * Envía FCM a todos los drivers de una ciudad con una orden disponible.
 * Ahora prioriza a los drivers que están cerca (si tienen ubicación reciente).
 */
async function notifyDriversInCity(city, orderId, venueName, venueNeighborhood, deliveryAddress, venueCoords = null) {
    try {
        let query = db.collection("users")
            .where("role", "==", "DRIVER")
            .where("city", "==", city)
            .where("isActive", "==", true);

        // Si tenemos coordenadas del local, filtramos por proximidad "Box" (aprox 11km)
        if (venueCoords && venueCoords.latitude && venueCoords.longitude) {
            const lat = venueCoords.latitude;
            const lng = venueCoords.longitude;
            const delta = 0.1; 
            query = query
                .where("lastLocation", ">=", new admin.firestore.GeoPoint(lat - delta, lng - delta))
                .where("lastLocation", "<=", new admin.firestore.GeoPoint(lat + delta, lng + delta));
        }

        const driversSnap = await query.get();
        if (driversSnap.empty) {
            // Fallback: si no hay nadie cerca, notificar a toda la ciudad (recursivo sin coords)
            if (venueCoords) {
                return notifyDriversInCity(city, orderId, venueName, venueNeighborhood, deliveryAddress, null);
            }
            return;
        }

        const tokens = [];
        driversSnap.forEach(doc => { if (doc.data().fcmToken) tokens.push(doc.data().fcmToken); });
        if (tokens.length === 0) return;

        const title = "¡Nuevo domicilio disponible! 🏍️";
        const body = `${venueName} (${venueNeighborhood || "centro"}) → ${deliveryAddress}`;
        await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: { orderId, type: "NEW_DELIVERY_AVAILABLE", city }
        });
    } catch (e) {
        logError("notifyDriversInCity error", e);
    }
}

// ─── createOrder ─────────────────────────────────────────────────────────────

/**
 * Crea un pedido de forma segura en el backend.
 */
const createOrder = onCall(
    {
        secrets: ["WOMPI_INTEGRITY_SECRET", "WOMPI_PUBLIC_KEY"],
        timeoutSeconds: 30,
        memory: "256MiB"
    },
    withSecurityBunker("createOrder", async (request) => {
        const userId = request.auth.uid;
        // La validación de rate limit y payload ya la hace withSecurityBunker

        const orderParsed = CreateOrderSchema.safeParse(request.data || {});
        if (!orderParsed.success) {
            throw new HttpsError("invalid-argument", orderParsed.error.issues[0]?.message || "Invalid order data.");
        }

        const {
            venueId, products, paymentMethod: normalizedPaymentMethod,
            deliveryMethod: normalizedDeliveryMethod, address, phone,
            transactionId, isDonation, donationCenterId, donationCenterName,
            estimatedCo2, deliveryFee: clientDeliveryFee, redemptionId, city,
        } = orderParsed.data;

        const userEmail = request.auth.token.email || "";
        const userName = request.auth.token.name || "Usuario";

        log("createOrder: Iniciando creación", { userId, venueId, paymentMethod: normalizedPaymentMethod });

        if (normalizedDeliveryMethod === "delivery" && !address) {
            throw new HttpsError("invalid-argument", "Address is required for delivery.");
        }
        if (normalizedPaymentMethod === "card" && !transactionId) {
            throw new HttpsError("invalid-argument", "Valid transactionId is required for card payments.");
        }

        let venueOwnerIdForMeta = null;
        let venueNameForMeta = null;
        let venueNeighborhoodForMeta = null;
        let venueDeliveryModel = "none";
        try {
            const venueSnap = await db.collection("venues").doc(venueId).get();
            if (venueSnap.exists) {
                const vd = venueSnap.data();
                venueNameForMeta = vd.name || null;
                venueNeighborhoodForMeta = vd.neighborhood || null;
                venueDeliveryModel = vd.deliveryModel || "none";

                // --- VALIDACIÓN DE ZONIFICACIÓN (Logística Fase 3) ---
                if (normalizedDeliveryMethod === "delivery" && vd.deliveryConfig && vd.deliveryConfig.isEnabled) {
                    const maxKm = vd.deliveryConfig.maxDistance || 10;
                    // Si el cliente envió coordenadas, validamos distancia real
                    if (request.data.customerLat && request.data.customerLng && vd.latitude && vd.longitude) {
                        const dist = calculateDistance(
                            vd.latitude, vd.longitude,
                            request.data.customerLat, request.data.customerLng
                        );
                        if (dist > maxKm) {
                            throw new HttpsError("failed-precondition", `El domicilio está fuera del radio de cobertura (${dist}km > ${maxKm}km).`);
                        }
                    }
                }
            }
            const [byVenueIds, byVenueId] = await Promise.all([
                db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).limit(1).get(),
                db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).limit(1).get(),
            ]);
            const ownerDocPre = byVenueIds.docs[0] || byVenueId.docs[0];
            if (ownerDocPre) venueOwnerIdForMeta = ownerDocPre.id;
            else {
                const vs = await db.collection("venues").doc(venueId).get();
                if (vs.exists && vs.data().ownerId) venueOwnerIdForMeta = vs.data().ownerId;
            }
        } catch (_) { /* Ignorar error */ }

        const settingsSnap = await db.collection("settings").doc("platform").get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
        const commissionPct = Number(settingsData.commissionPct);
        const commissionRate = Number.isFinite(commissionPct) && commissionPct >= 0 ? commissionPct / 100 : CONFIG.platformCommissionRate;

        const result = await db.runTransaction(async (transaction) => {
            let cardApprovedBeforeOrder = false;
            if (normalizedPaymentMethod === "card") {
                const approvedRef = db.collection("webhook_dedup").doc(`${transactionId}-APPROVED`);
                const declinedRef = db.collection("webhook_dedup").doc(`${transactionId}-DECLINED`);
                const errorRef = db.collection("webhook_dedup").doc(`${transactionId}-ERROR`);
                const [approvedSnap, declinedSnap, errorSnap] = await Promise.all([
                    transaction.get(approvedRef), transaction.get(declinedRef), transaction.get(errorRef),
                ]);
                if (declinedSnap.exists || errorSnap.exists) {
                    throw new HttpsError("failed-precondition", "La transacción reporta estado fallido.");
                }
                cardApprovedBeforeOrder = approvedSnap.exists;

                // Verificar unicidad de transactionId dentro de la transacción (previene doble cobro)
                if (transactionId) {
                    const existingOrderSnap = await db.collection("orders")
                        .where("transactionId", "==", transactionId).limit(1).get();
                    if (!existingOrderSnap.empty) {
                        throw new HttpsError("already-exists", "Esta transacción ya fue procesada.");
                    }
                }
            }

            const venueDoc = await transaction.get(db.collection("venues").doc(venueId));
            if (!venueDoc.exists) throw new HttpsError("not-found", "Venue not found.");

            let subtotal = 0;
            let totalOriginalPrice = 0;
            const productUpdates = [];
            const orderProducts = [];
            const unavailableProducts = [];
            const nowMs = Date.now();

            for (const item of products) {
                const productDoc = await transaction.get(db.collection("products").doc(item.productId));
                if (!productDoc.exists) throw new HttpsError("not-found", `Product ${item.productId} not found.`);
                const productData = productDoc.data() || {};
                const stockQuantity = Number(productData.quantity) || 0;
                const availableUntilMs = productData.availableUntil ? Date.parse(productData.availableUntil) : NaN;
                const isExpired = Number.isFinite(availableUntilMs) && availableUntilMs <= nowMs;

                if (stockQuantity < item.quantity || isExpired) {
                    unavailableProducts.push({
                        productId: item.productId, name: productData.name || "Producto",
                        availableQuantity: stockQuantity, requestedQuantity: item.quantity,
                        reason: isExpired ? "expired" : "insufficient_stock",
                    });
                    continue;
                }

                const price = (productData.discountedPrice !== undefined && productData.discountedPrice !== null)
                    ? Number(productData.discountedPrice) : Number(productData.originalPrice);
                const originalPrice = Number(productData.originalPrice) || price;
                subtotal += price * item.quantity;
                totalOriginalPrice += originalPrice * item.quantity;

                orderProducts.push({
                    productId: item.productId, name: productData.name, quantity: item.quantity,
                    price, originalPrice, imageUrl: productData.imageUrl || "",
                });
                productUpdates.push({ ref: productDoc.ref, newQuantity: stockQuantity - item.quantity });
            }

            if (unavailableProducts.length > 0) {
                throw new HttpsError("failed-precondition", "Productos no disponibles.", { code: "PRODUCT_UNAVAILABLE", products: unavailableProducts });
            }

            const walletRef = db.collection("wallets").doc(venueId);
            await transaction.get(walletRef);

            const effectiveDeliveryFee = normalizedDeliveryMethod === "delivery" ? (clientDeliveryFee !== null ? clientDeliveryFee : CONFIG.deliveryFee) : 0;
            const platformFee = Math.round((subtotal * commissionRate) * 100) / 100;
            const venueEarnings = Math.round((subtotal - platformFee) * 100) / 100;

            let effectiveDiscount = 0;
            let validatedRedemptionId = null;
            let redemptionDocRef = null;
            if (redemptionId) {
                redemptionDocRef = db.collection("redemptions").doc(redemptionId);
                const redemptionDoc = await transaction.get(redemptionDocRef);
                if (!redemptionDoc.exists) throw new HttpsError("failed-precondition", "El canje no existe.");
                const rd = redemptionDoc.data() || {};
                if (rd.userId !== userId) throw new HttpsError("permission-denied", "Canje no pertenece al usuario.");
                if (rd.status !== "PENDING" || rd.usedAt) throw new HttpsError("failed-precondition", "Canje ya utilizado.");
                const expiresAtMs = Date.parse(rd.expiresAt || "");
                if (expiresAtMs <= Date.now()) throw new HttpsError("failed-precondition", "Canje expirado.");

                const discountAmount = Math.max(0, Math.min(Number(rd.discountAmount) || 0, 15000));
                effectiveDiscount = Math.min(discountAmount, subtotal + effectiveDeliveryFee);
                validatedRedemptionId = redemptionId;
            }

            const totalAmount = Math.max(0, subtotal + effectiveDeliveryFee - effectiveDiscount);
            const nowIso = new Date().toISOString();
            const acceptanceDeadline = new Date(nowMs + 5 * 60000).toISOString(); // 5 minutos para aceptar

            const orderRef = db.collection("orders").doc();
            transaction.set(orderRef, {
                customerId: userId,
                customerName: userName,
                customerEmail: userEmail,
                venueId,
                products: orderProducts,
                totalAmount,
                subtotal,
                platformFee,
                deliveryFee: effectiveDeliveryFee,
                venueEarnings,
                status: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? "PAID" : "PENDING",
                paymentMethod: normalizedPaymentMethod,
                paymentStatus: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? "paid" : "pending",
                transactionId: normalizedPaymentMethod === "card" ? transactionId : null,
                paidAt: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? nowIso : null,
                totalOriginalPrice,
                moneySaved: totalOriginalPrice - subtotal,
                commissionRate,
                deliveryMethod: normalizedDeliveryMethod,
                deliveryAddress: isDonation ? `DONACIÓN: ${donationCenterName}` : (normalizedDeliveryMethod === "delivery" ? address : "RECOGER EN TIENDA"),
                city: city || "Bogotá",
                phone: phone || "",
                isDonation: Boolean(isDonation),
                donationCenterId,
                donationCenterName,
                estimatedCo2: estimatedCo2 || 0,
                redemptionId: validatedRedemptionId,
                discountApplied: effectiveDiscount,
                createdAt: nowIso,
                pickupDeadline: new Date(nowMs + 20 * 60000).toISOString(), // 20 min para recoger
                // Campos de aceptación
                acceptanceDeadline,
                lastKitchenNotifiedAt: nowIso,
                // Campos denormalizados para drivers
                venueName: venueNameForMeta || venueDoc.data().name || "",
                venueNeighborhood: venueNeighborhoodForMeta || "",
                deliveryModel: venueDeliveryModel,
                metadata: { venueOwnerId: venueOwnerIdForMeta, venueName: venueNameForMeta || venueDoc.data().name },
            });

            for (const update of productUpdates) transaction.update(update.ref, { quantity: update.newQuantity });
            if (validatedRedemptionId && redemptionDocRef) {
                const usedAt = nowIso;
                const userRef2 = db.collection("users").doc(userId);
                const userDoc2 = await transaction.get(userRef2);
                if (userDoc2.exists) {
                    const currentRedemptions = Array.isArray(userDoc2.data().redemptions) ? userDoc2.data().redemptions : [];
                    const updatedRedemptions = currentRedemptions.map(r => r && r.id === validatedRedemptionId ? { ...r, usedAt } : r);
                    transaction.update(userRef2, { redemptions: updatedRedemptions });
                }
                transaction.update(redemptionDocRef, { status: "USED", usedAt, orderId: orderRef.id });
            }

            return { success: true, orderId: orderRef.id };
        });

        await writeAuditLog({
            action: "order_created", performedBy: userId, targetId: venueId, targetType: "venue",
            metadata: { paymentMethod: normalizedPaymentMethod, deliveryMethod: normalizedDeliveryMethod, productsCount: products.length },
        });

        return result;
    })
);

// ─── acceptOrder ─────────────────────────────────────────────────────────────

/**
 * El negocio acepta un pedido PENDING → ACCEPTED.
 * Solo VENUE_OWNER o KITCHEN_STAFF del venue pueden llamar esto.
 */
const acceptOrder = onCall(
    withSecurityBunker("acceptOrder", async (request) => {
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.status !== "PENDING") {
            throw new HttpsError("failed-precondition", `No se puede aceptar un pedido en estado ${order.status}.`);
        }

        // Verificar que el caller pertenece al venue
        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
        const callerData = callerSnap.data();
        const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
        const hasAccess = ["VENUE_OWNER", "KITCHEN_STAFF"].includes(callerData.role) &&
            callerVenueIds.includes(order.venueId);
        if (!hasAccess && !["ADMIN", "SUPER_ADMIN"].includes(callerData.role)) {
            throw new HttpsError("permission-denied", "No tienes permiso para aceptar este pedido.");
        }

        await orderRef.update({
            status: "ACCEPTED",
            acceptedAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const venueName = order.venueName || order.metadata?.venueName || "el restaurante";
        await sendFcmToUser(
            order.customerId,
            "¡Pedido aceptado! 🎉",
            `${venueName} aceptó tu pedido y lo está alistando.`,
            { orderId, status: "ACCEPTED" }
        );

        // Auditoría
        await writeAuditLog({
            action: "ORDER_ACCEPTED",
            performedBy: request.auth.uid,
            targetId: orderId,
            targetType: "order",
            metadata: { venueId: order.venueId }
        });

        log("acceptOrder: Pedido aceptado", { orderId, by: request.auth.uid });
        return { success: true };
    })
);

/**
 * El negocio marca un pedido como LISTO (READY).
 * ACCEPTED -> READY.
 */
const markOrderReady = onCall(
    withSecurityBunker("markOrderReady", async (request) => {
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.status !== "ACCEPTED" && order.status !== "IN_PREPARATION") {
            throw new HttpsError("failed-precondition", `El pedido debe estar ACCEPTED o IN_PREPARATION para marcarlo como READY.`);
        }

        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        const callerData = callerSnap.data();
        const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
        if (!callerVenueIds.includes(order.venueId) && !["ADMIN", "SUPER_ADMIN"].includes(callerData.role)) {
            throw new HttpsError("permission-denied", "No tienes permiso para gestionar este pedido.");
        }

        const now = new Date();
        await orderRef.update({
            status: "READY",
            readyAt: now.toISOString(),
            // El cliente tiene 20 min para recoger desde que está READY (si es pickup)
            pickupDeadline: new Date(now.getTime() + 20 * 60000).toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        log("markOrderReady: Pedido listo", { orderId });
        return { success: true };
    })
);

// ─── rejectOrder ─────────────────────────────────────────────────────────────

/**
 * El staff de cocina rechaza un pedido PENDING → CANCELLED.
 * Notifica al dueño del negocio con los detalles del pedido.
 */
const rejectOrder = onCall(
    withSecurityBunker("rejectOrder", async (request) => {
        const { orderId, reason } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.status !== "PENDING") {
            throw new HttpsError("failed-precondition", `No se puede rechazar un pedido en estado ${order.status}.`);
        }

        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
        const callerData = callerSnap.data();
        const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
        const hasAccess = ["VENUE_OWNER", "KITCHEN_STAFF"].includes(callerData.role) &&
            callerVenueIds.includes(order.venueId);
        if (!hasAccess && !["ADMIN", "SUPER_ADMIN"].includes(callerData.role)) {
            throw new HttpsError("permission-denied", "No tienes permiso para rechazar este pedido.");
        }

        await orderRef.update({
            status: "CANCELLED",
            cancellationReason: "REJECTED_BY_STAFF",
            rejectedBy: request.auth.uid,
            cancelledAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notificar al cliente
        await sendFcmToUser(
            order.customerId,
            "Pedido rechazado 😔",
            `Lo sentimos, el negocio no pudo atender tu pedido en este momento.${reason ? ` Motivo: ${reason}` : ""}`,
            { orderId, status: "CANCELLED" }
        );

        // Notificar al dueño con detalles del pedido
        const productsList = (order.products || []).map(p => `${p.name} x${p.quantity}`).join(", ");
        const amount = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(order.totalAmount || 0);
        await sendFcmToVenueOwner(
            order.venueId,
            "⚠️ Pedido rechazado por tu equipo",
            `${callerData.fullName || "Un colaborador"} rechazó un pedido de ${order.customerName}: ${productsList} — ${amount}${reason ? `. Motivo: ${reason}` : ""}`,
            { orderId, type: "ORDER_REJECTED_BY_STAFF" }
        );

        log("rejectOrder: Pedido rechazado", { orderId, by: request.auth.uid });
        return { success: true };
    })
);

// ─── cancelOrderByClient ──────────────────────────────────────────────────────

/**
 * El cliente cancela su propio pedido.
 * Solo permitido mientras el pedido está en estado PENDING.
 */
const cancelOrderByClient = onCall(
    withErrorHandling("cancelOrderByClient", async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.customerId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Solo puedes cancelar tus propios pedidos.");
        }
        if (order.status !== "PENDING") {
            throw new HttpsError("failed-precondition", "Solo puedes cancelar un pedido antes de que sea aceptado por el negocio.");
        }

        await orderRef.update({
            status: "CANCELLED",
            cancellationReason: "CLIENT_CANCELLED",
            cancelledAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notificar al negocio
        const venueName = order.venueName || order.metadata?.venueName || "el restaurante";
        await sendFcmToVenueStaff(
            order.venueId,
            "Pedido cancelado por el cliente",
            `${order.customerName || "Un cliente"} canceló su pedido en ${venueName}.`,
            { orderId, type: "ORDER_CANCELLED_BY_CLIENT" }
        );

        log("cancelOrderByClient", { orderId, customerId: request.auth.uid });
        return { success: true };
    })
);

// ─── releaseToDriverPool ──────────────────────────────────────────────────────

/**
 * El negocio libera un pedido READY al pool de domiciliarios de la app.
 * READY → AWAITING_DRIVER. Notifica a todos los drivers de la ciudad.
 */
const releaseToDriverPool = onCall(
    withErrorHandling("releaseToDriverPool", async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.status !== "READY") {
            throw new HttpsError("failed-precondition", `El pedido debe estar en estado READY para liberarlo. Estado actual: ${order.status}`);
        }
        if (order.deliveryMethod !== "delivery") {
            throw new HttpsError("failed-precondition", "Solo pedidos de delivery pueden ser asignados a drivers.");
        }

        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
        const callerData = callerSnap.data();
        const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
        const hasAccess = ["VENUE_OWNER", "KITCHEN_STAFF"].includes(callerData.role) && callerVenueIds.includes(order.venueId);
        if (!hasAccess && !["ADMIN", "SUPER_ADMIN"].includes(callerData.role)) {
            throw new HttpsError("permission-denied", "No tienes permiso para liberar este pedido.");
        }

        await orderRef.update({
            status: "AWAITING_DRIVER",
            releasedAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notificar al cliente
        await sendFcmToUser(
            order.customerId,
            "Buscando repartidor 🔍",
            "Tu pedido está listo. Estamos buscando un repartidor para ti.",
            { orderId, status: "AWAITING_DRIVER" }
        );

        // Notificar a todos los drivers de la ciudad
        await notifyDriversInCity(
            order.city || "Bogotá",
            orderId,
            order.venueName || order.metadata?.venueName || "Restaurante",
            order.venueNeighborhood || "",
            order.deliveryAddress || ""
        );

        // Notificar a drivers cercanos (Lógica de proximidad mejorada)
        const venueSnap = await db.collection("venues").doc(order.venueId).get();
        const venueData = venueSnap.data() || {};
        const venueCoords = (venueData.latitude && venueData.longitude) 
            ? { latitude: venueData.latitude, longitude: venueData.longitude } 
            : null;

        await notifyDriversInCity(
            order.city || "Bogotá",
            orderId,
            venueData.name || "Negocio",
            venueData.neighborhood || "",
            order.address || "",
            venueCoords
        );

        log("releaseToDriverPool", { orderId });
        return { success: true };
    })
);

// ─── assignDriver ─────────────────────────────────────────────────────────────

/**
 * El negocio/admin asigna un driver específico a un pedido READY.
 * READY → DRIVER_ASSIGNED.
 */
const assignDriver = onCall(
    withSecurityBunker("assignDriver", async (request) => {
        const { orderId, driverId } = request.data || {};
        if (!orderId || !driverId) throw new HttpsError("invalid-argument", "orderId y driverId requeridos.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.status !== "READY" && order.status !== "AWAITING_DRIVER") {
            throw new HttpsError("failed-precondition", `El pedido debe estar en READY o AWAITING_DRIVER. Estado actual: ${order.status}`);
        }

        // Validar que el driver existe y tiene rol DRIVER
        const driverSnap = await db.collection("users").doc(driverId).get();
        if (!driverSnap.exists || driverSnap.data().role !== "DRIVER") {
            throw new HttpsError("not-found", "Driver no encontrado o sin rol DRIVER.");
        }
        const driverData = driverSnap.data();

        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
        const callerData = callerSnap.data();
        const callerVenueIds = callerData.venueIds || (callerData.venueId ? [callerData.venueId] : []);
        const hasAccess = ["VENUE_OWNER"].includes(callerData.role) && callerVenueIds.includes(order.venueId);
        if (!hasAccess && !["ADMIN", "SUPER_ADMIN"].includes(callerData.role)) {
            throw new HttpsError("permission-denied", "No tienes permiso para asignar drivers.");
        }

        await orderRef.update({
            status: "DRIVER_ASSIGNED",
            driverId,
            driverName: driverData.fullName || "Driver",
            acceptedAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const venueName = order.venueName || order.metadata?.venueName || "el restaurante";

        // Notificar al driver asignado
        await sendFcmToUser(
            driverId,
            "¡Te asignaron un domicilio! 📦",
            `Tienes un nuevo domicilio en ${venueName}. Recógelo y entrega en ${order.deliveryAddress}.`,
            { orderId, status: "DRIVER_ASSIGNED" }
        );

        // Notificar al cliente
        await sendFcmToUser(
            order.customerId,
            "¡Repartidor asignado! 🏍️",
            `Un repartidor está en camino a ${venueName} para recoger tu pedido.`,
            { orderId, status: "DRIVER_ASSIGNED" }
        );

        log("assignDriver", { orderId, driverId });
        return { success: true };
    })
);

// ─── takeDelivery ─────────────────────────────────────────────────────────────

/**
 * Un driver toma un pedido del pool AWAITING_DRIVER.
 * Usa transacción atómica para evitar que dos drivers tomen el mismo pedido.
 */
const takeDelivery = onCall(
    withErrorHandling("takeDelivery", async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        // Verificar que el caller es un DRIVER
        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        if (!callerSnap.exists) throw new HttpsError("not-found", "Usuario no encontrado.");
        const callerData = callerSnap.data();
        if (callerData.role !== "DRIVER") {
            throw new HttpsError("permission-denied", "Solo los domiciliarios pueden tomar pedidos.");
        }

        const orderRef = db.collection("orders").doc(orderId);

        // Transacción atómica: solo el primero en llegar lo toma
        await db.runTransaction(async (transaction) => {
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
            const order = orderSnap.data();

            if (order.status !== "AWAITING_DRIVER" || order.driverId) {
                throw new HttpsError("failed-precondition", "Este pedido ya fue tomado por otro repartidor.");
            }

            // Validar que el pedido es de la ciudad del driver
            if (order.city && callerData.city && order.city !== callerData.city) {
                throw new HttpsError("failed-precondition", "Este pedido no corresponde a tu ciudad.");
            }

            transaction.update(orderRef, {
                status: "DRIVER_ASSIGNED",
                driverId: request.auth.uid,
                driverName: callerData.fullName || "Driver",
                acceptedAt: new Date().toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        // Obtener datos actualizados para notificaciones
        const updatedSnap = await orderRef.get();
        const order = updatedSnap.data();
        const venueName = order.venueName || order.metadata?.venueName || "el restaurante";

        // Notificar al cliente
        await sendFcmToUser(
            order.customerId,
            "¡Repartidor en camino! 🏍️",
            `${callerData.fullName || "Un repartidor"} tomó tu pedido y está yendo a ${venueName}.`,
            { orderId, status: "DRIVER_ASSIGNED" }
        );

        log("takeDelivery", { orderId, driverId: request.auth.uid });
        return { success: true };
    })
);

/**
 * El driver marca el pedido como RECOGIDO (IN_TRANSIT).
 * DRIVER_ASSIGNED -> IN_TRANSIT.
 */
const markOrderInTransit = onCall(
    withErrorHandling("markOrderInTransit", async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.driverId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Este pedido no te fue asignado.");
        }
        if (order.status !== "DRIVER_ASSIGNED") {
            throw new HttpsError("failed-precondition", "El pedido debe estar en DRIVER_ASSIGNED para marcarlo como IN_TRANSIT.");
        }

        await orderRef.update({
            status: "IN_TRANSIT",
            pickedUpAt: new Date().toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        log("markOrderInTransit: Pedido en camino", { orderId });
        return { success: true };
    })
);

// ─── markDeliveredByDriver ────────────────────────────────────────────────────

/**
 * El driver marca el pedido como entregado.
 * No cambia el status — activa awaitingClientConfirmation.
 * El cliente tiene 15 min para confirmar o disputar; si no responde, el cron completa automáticamente.
 */
const markDeliveredByDriver = onCall(
    withErrorHandling("markDeliveredByDriver", async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.driverId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Este pedido no te fue asignado.");
        }
        if (order.status !== "IN_TRANSIT") {
            throw new HttpsError("failed-precondition", `El pedido debe estar IN_TRANSIT para marcarlo como entregado. Estado: ${order.status}`);
        }

        const nowIso = new Date().toISOString();
        await orderRef.update({
            awaitingClientConfirmation: true,
            driverMarkedCompletedAt: nowIso,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notificar al cliente con opción de disputar
        await sendFcmToUser(
            order.customerId,
            "Pedido marcado como entregado 📦",
            "El repartidor marcó tu pedido como entregado. ¿No lo recibiste? Tienes 15 minutos para reportarlo.",
            { orderId, type: "DELIVERY_CONFIRMATION_NEEDED", status: "IN_TRANSIT" }
        );

        log("markDeliveredByDriver", { orderId, driverId: request.auth.uid });
        return { success: true };
    })
);

// ─── confirmDelivery ──────────────────────────────────────────────────────────

/**
 * El cliente confirma que recibió el pedido → COMPLETED.
 * También usado por el cron de auto-confirmación tras 15 minutos.
 */
const confirmDelivery = onCall(
    withSecurityBunker("confirmDelivery", async (request) => {
        const { orderId } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        // Puede ser llamado por el cliente o por el cron (como admin SDK)
        const isCustomer = order.customerId === request.auth.uid;
        const callerSnap = await db.collection("users").doc(request.auth.uid).get();
        const isAdminCaller = callerSnap.exists && ["ADMIN", "SUPER_ADMIN"].includes(callerSnap.data().role);

        if (!isCustomer && !isAdminCaller) {
            throw new HttpsError("permission-denied", "No tienes permiso para confirmar esta entrega.");
        }
        if (!order.awaitingClientConfirmation && order.status !== "IN_TRANSIT") {
            throw new HttpsError("failed-precondition", "Este pedido no está esperando confirmación de entrega.");
        }

        const nowIso = new Date().toISOString();
        await orderRef.update({
            status: "COMPLETED",
            awaitingClientConfirmation: false,
            deliveredAt: nowIso,
            receivedAt: nowIso,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        log("confirmDelivery", { orderId, confirmedBy: request.auth.uid });
        return { success: true };
    })
);

// ─── disputeDelivery ──────────────────────────────────────────────────────────

/**
 * El cliente disputa una entrega marcada por el driver.
 * IN_TRANSIT (awaitingClientConfirmation=true) → DISPUTED.
 */
const disputeDelivery = onCall(
    withSecurityBunker("disputeDelivery", async (request) => {
        const { orderId, reason } = request.data || {};
        if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido.");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new HttpsError("not-found", "Pedido no encontrado.");
        const order = orderSnap.data();

        if (order.customerId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Solo el cliente del pedido puede abrir una disputa.");
        }
        if (!order.awaitingClientConfirmation) {
            throw new HttpsError("failed-precondition", "Solo puedes disputar un pedido que el repartidor marcó como entregado.");
        }

        const nowIso = new Date().toISOString();
        await orderRef.update({
            status: "DISPUTED",
            awaitingClientConfirmation: false,
            disputedAt: nowIso,
            disputeReason: reason || "El cliente reporta que no recibió el pedido.",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notificar a admins
        try {
            const adminsSnap = await db.collection("users")
                .where("role", "in", ["ADMIN", "SUPER_ADMIN"])
                .where("fcmToken", "!=", null)
                .limit(10)
                .get();
            const tokens = adminsSnap.docs.map(d => d.data().fcmToken).filter(Boolean);
            if (tokens.length > 0) {
                await messaging.sendEachForMulticast({
                    tokens,
                    notification: {
                        title: "⚠️ Disputa abierta",
                        body: `Pedido ${orderId} — ${order.customerName} reporta no haber recibido su pedido.`,
                    },
                    data: { orderId, type: "ORDER_DISPUTED" },
                });
            }
        } catch (e) { logError("disputeDelivery admin notify error", e); }

        log("disputeDelivery", { orderId, customerId: request.auth.uid });
        return { success: true };
    })
);

// ─── onOrderUpdated ───────────────────────────────────────────────────────────

/**
 * Trigger: maneja cambios de estado, FCM al cliente, wallet settlement y gamificación.
 */
const onOrderUpdated = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const orderId = event.params.orderId;

    // ─── FCM al cliente cuando cambia el estado ───────────────────────────────
    if (newData.status !== oldData.status && newData.customerId) {
        try {
            const userDoc = await db.collection("users").doc(newData.customerId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const fcmToken = userData.fcmToken;
                let venueName = "el restaurante";
                try {
                    if (newData.venueId) {
                        const venueDoc = await db.collection("venues").doc(newData.venueId).get();
                        if (venueDoc.exists) venueName = venueDoc.data().name || venueName;
                    }
                } catch (_) { /* Ignorar */ }

                if (fcmToken) {
                    let title = "Actualización de tu pedido";
                    let body = `El estado es ahora: ${newData.status}`;
                    const currentStreak = (userData.streak && userData.streak.current) || 0;

                    switch (newData.status) {
                        case "ACCEPTED":
                            title = "¡Pedido aceptado! 🎉";
                            body = `${venueName} aceptó tu pedido y lo está alistando.`;
                            break;
                        case "IN_PREPARATION":
                            title = "¡Manos a la obra! 👨‍🍳";
                            body = `${venueName} está preparando tu pedido.`;
                            break;
                        case "READY":
                            title = "¡Tu pedido está listo! 🛍️";
                            body = newData.deliveryMethod === "pickup"
                                ? `Acércate a ${venueName} a recogerlo. Tienes 20 minutos.`
                                : `El pedido está listo para despachar.`;
                            break;
                        case "AWAITING_DRIVER":
                            title = "Buscando repartidor 🔍";
                            body = "Tu pedido está listo. Estamos buscando un repartidor para ti.";
                            break;
                        case "DRIVER_ASSIGNED":
                            title = "¡Repartidor asignado! 🏍️";
                            body = `Un repartidor está en camino a ${venueName} a recoger tu pedido.`;
                            break;
                        case "IN_TRANSIT":
                            title = "¡Tu pedido va en camino! 🚚";
                            body = "El repartidor ya lleva tu rescate.";
                            break;
                        case "COMPLETED":
                            title = "¡Rescate Exitoso! 🌍";
                            body = currentStreak >= 3
                                ? `¡${currentStreak} días de racha! 🔥 Gracias por salvar comida.`
                                : "Gracias por salvar comida. 🌱";
                            break;
                        case "CANCELLED":
                            title = "Pedido cancelado";
                            body = newData.cancellationReason === "ACCEPTANCE_TIMEOUT"
                                ? "El negocio no respondió a tiempo. Tu pedido fue cancelado."
                                : "Tu pedido fue cancelado.";
                            break;
                        case "MISSED":
                            title = "Pedido no recogido ⏰";
                            body = "El tiempo límite de recogida pasó. Tu pedido fue marcado como no recogido.";
                            break;
                    }

                    await messaging.send({
                        notification: { title, body },
                        token: fcmToken,
                        webpush: { fcmOptions: { link: `/#/app/orders?highlight=${orderId}` } },
                        data: { orderId, status: newData.status },
                    });
                }
            }
        } catch (e) { logError("FCM Error onOrderUpdated", e); }
    }

    // ─── Notificar al NEGOCIO sobre cambios importantes ──────────────────────
    if (newData.status !== oldData.status && newData.venueId) {
        try {
            let title = "";
            let body = "";
            const orderIdForBody = newData.metadata?.orderNumber || orderId.slice(-6).toUpperCase();

            if (newData.status === "COMPLETED") {
                title = "¡Pedido completado! ✅";
                body = `El pedido #${orderIdForBody} de ${newData.customerName} ha sido entregado exitosamente.`;
            } else if (newData.status === "DISPUTED") {
                title = "⚠️ Pedido en disputa";
                body = `El cliente ${newData.customerName} reporta que no recibió el pedido #${orderIdForBody}.`;
            } else if (newData.status === "DRIVER_ASSIGNED") {
                title = "Repartidor asignado 🏍️";
                body = `${newData.driverName || "Un repartidor"} ha tomado el pedido #${orderIdForBody} y va en camino a tu local.`;
            }

            if (title) {
                await sendFcmToVenueStaff(newData.venueId, title, body, { orderId, status: newData.status, type: "ORDER_STATUS_UPDATE" });
            }
        } catch (e) { logError("Business FCM notify error", e); }
    }

    // ─── Notificar a drivers cuando el pedido pasa a AWAITING_DRIVER ─────────
    if (newData.status === "AWAITING_DRIVER" && oldData.status !== "AWAITING_DRIVER") {
        try {
            await notifyDriversInCity(
                newData.city || "Bogotá",
                orderId,
                newData.venueName || newData.metadata?.venueName || "Restaurante",
                newData.venueNeighborhood || "",
                newData.deliveryAddress || ""
            );
        } catch (e) { logError("AWAITING_DRIVER notify drivers error", e); }
    }

    // ─── Wallet settlement al COMPLETAR ──────────────────────────────────────
    if (newData.status === "COMPLETED" && oldData.status !== "COMPLETED") {
        try {
            const existingTxSnap = await db.collection("wallet_transactions")
                .where("orderId", "==", orderId).limit(1).get();
            if (!existingTxSnap.empty) return;

            await db.runTransaction(async (transaction) => {
                const orderRef = db.collection("orders").doc(orderId);
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists) return;
                const order = orderSnap.data() || {};
                if (order.commissionBookedAt || order.commissionTxId) return;

                const paymentMethod = order.paymentMethod || "cash";
                const subtotal = Number(order.subtotal) || 0;
                const commissionRate = Number.isFinite(Number(order.commissionRate))
                    ? Number(order.commissionRate) : CONFIG.platformCommissionRate;
                const platformFee = Number(order.platformFee) || Math.round((subtotal * commissionRate) * 100) / 100;
                const venueEarnings = Number(order.venueEarnings) || Math.round((subtotal - platformFee) * 100) / 100;
                const walletAdjustment = paymentMethod === "cash" ? -platformFee : venueEarnings;

                const walletRef = db.collection("wallets").doc(order.venueId);
                const walletDoc = await transaction.get(walletRef);
                const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
                transaction.set(walletRef, {
                    venueId: order.venueId,
                    balance: currentBalance + walletAdjustment,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                const txId = paymentMethod === "cash"
                    ? `order_${orderId}_cash_debit`
                    : `order_${orderId}_online_credit`;
                const walletTxRef = db.collection("wallet_transactions").doc(txId);
                transaction.set(walletTxRef, {
                    venueId: order.venueId, orderId,
                    type: paymentMethod === "cash" ? "DEBIT" : "CREDIT",
                    amount: Math.abs(walletAdjustment),
                    description: paymentMethod === "cash" ? "Comisión pedido efectivo (confirmado)" : "Ganancia pedido online (confirmado)",
                    referenceType: paymentMethod === "cash" ? "ORDER_CASH" : "ORDER_ONLINE",
                    source: "onOrderUpdated",
                    createdAt: new Date().toISOString(),
                }, { merge: true });

                transaction.update(orderRef, {
                    commissionBookedAt: new Date().toISOString(),
                    commissionTxId: txId,
                });
            });
        } catch (e) { logError("Commission booking error", e); }
    }

    // ─── Gamificación al COMPLETAR ────────────────────────────────────────────
    if (newData.status === "COMPLETED" && oldData.status !== "COMPLETED") {
        const userId = newData.customerId;
        const moneySaved = newData.moneySaved || 0;
        const co2Saved = newData.estimatedCo2 || 0.5;
        const pointsEarned = Math.floor(moneySaved / 1000) + Math.floor(co2Saved * 10);
        const userRef = db.collection("users").doc(userId);

        try {
            const userSnap = await userRef.get();
            const userData = userSnap.data() || {};
            const currentRescues = (userData.impact?.totalRescues || 0) + 1;
            let newLevel = "NOVICE";
            if (currentRescues >= 21) newLevel = "GUARDIAN";
            else if (currentRescues >= 6) newLevel = "HERO";

            const today = new Date().toISOString().split("T")[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
            const streak = userData.streak || { current: 0, longest: 0, lastOrderDate: "", multiplier: 1.0 };
            let newStreakCurrent = (streak.lastOrderDate === today) ? streak.current : (streak.lastOrderDate === yesterday ? streak.current + 1 : 1);
            let multiplier = newStreakCurrent >= 30 ? 3.0 : (newStreakCurrent >= 14 ? 2.5 : (newStreakCurrent >= 7 ? 2.0 : (newStreakCurrent >= 3 ? 1.5 : 1.0)));
            const bonusPoints = Math.round(pointsEarned * multiplier);

            const currentMonth = new Date().toISOString().substring(0, 7);
            const currentWeek = `${new Date().getFullYear()}-W${Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (86400000 * 7))}`;
            const monthlyRescues = (userData.impact?.monthlyRescues?.[currentMonth] || 0) + 1;
            const weeklyRescues = (userData.impact?.weeklyRescues?.[currentWeek] || 0) + 1;

            await userRef.update({
                "impact.totalRescues": admin.firestore.FieldValue.increment(1),
                "impact.co2Saved": admin.firestore.FieldValue.increment(Math.min(co2Saved, 10)),
                "impact.moneySaved": admin.firestore.FieldValue.increment(moneySaved),
                "impact.points": admin.firestore.FieldValue.increment(bonusPoints),
                "impact.level": newLevel,
                [`impact.monthlyRescues.${currentMonth}`]: monthlyRescues,
                [`impact.weeklyRescues.${currentWeek}`]: weeklyRescues,
                "streak.current": newStreakCurrent,
                "streak.longest": Math.max(streak.longest, newStreakCurrent),
                "streak.lastOrderDate": today,
                "streak.multiplier": multiplier,
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            // Referidos (primer pedido)
            if (currentRescues === 1 && userData.invitedBy) {
                const referrers = await db.collection("users").where("referralCode", "==", userData.invitedBy).limit(1).get();
                if (!referrers.empty) {
                    await referrers.docs[0].ref.update({ "impact.points": admin.firestore.FieldValue.increment(50), "updatedAt": admin.firestore.FieldValue.serverTimestamp() });
                    await userRef.update({ "impact.points": admin.firestore.FieldValue.increment(50) });
                }
            }

            // Insignias
            const newBadges = [];
            const orderDate = new Date(newData.createdAt || Date.now());
            const orderHour = orderDate.getUTCHours() - 5;
            if (orderHour >= 5 && orderHour < 9) newBadges.push({ id: "early_bird", name: "Madrugador", icon: "🌅", date: today });
            const totalCo2 = (userData.impact?.co2Saved || 0) + co2Saved;
            if (totalCo2 >= 50 && (!userData.impact?.badges || !userData.impact.badges.find(b => b.id === "planet_saver"))) {
                newBadges.push({ id: "planet_saver", name: "Planet Saver", icon: "🌍", date: today });
            }
            const dayOfWeek = new Date().getUTCDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) newBadges.push({ id: "weekend_warrior", name: "Guerrero de Finde", icon: "🛡️", date: today });

            if (newBadges.length > 0) {
                const currentBadges = userData.impact?.badges || [];
                const filteredNewBadges = newBadges.filter(nb => !currentBadges.find(cb => cb.id === nb.id));
                if (filteredNewBadges.length > 0) {
                    await userRef.update({ "impact.badges": admin.firestore.FieldValue.arrayUnion(...filteredNewBadges) });
                    if (userData.fcmToken) {
                        await messaging.send({
                            notification: { title: "¡Nuevo Logro Desbloqueado! 🏆", body: `Has ganado la insignia: ${filteredNewBadges[0].name}` },
                            token: userData.fcmToken,
                        }).catch(e => logError("Badge notification error", e));
                    }
                }
            }
        } catch (e) { logError("Impact/Gamification Error", e); }
    }
});


/**
 * (Admin) Resuelve una disputa de pedido.
 * 
 * Acciones posibles (resolution):
 * - REFUND_CUSTOMER: Cancela el pedido (reembolso lógico).
 * - PAY_DRIVER_AND_VENUE: Completa el pedido (pago a los proveedores).
 * - CANCEL_ALL: Cancela sin efectos secundarios.
 */
const resolveDispute = onCall(
    withSecurityBunker("resolveDispute", async (request) => {
        const { orderId, resolution, adminComment } = request.data;
        if (!orderId || !resolution) {
            throw new HttpsError("invalid-argument", "orderId y resolution son requeridos.");
        }

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            throw new HttpsError("not-found", "Pedido no encontrado.");
        }

        const orderData = orderSnap.data();
        if (orderData.status !== "DISPUTED") {
            throw new HttpsError("failed-precondition", "Solo se pueden resolver pedidos en disputa.");
        }

        let newStatus = "COMPLETED";
        if (resolution === "REFUND_CUSTOMER" || resolution === "CANCEL_ALL") {
            newStatus = "CANCELLED";
        }

        const updateData = {
            status: newStatus,
            disputeResolution: resolution,
            disputeResolvedAt: new Date().toISOString(),
            disputeResolvedBy: request.auth.uid,
            disputeAdminComment: adminComment || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await orderRef.update(updateData);

        await writeAuditLog({
            action: "order_dispute_resolved",
            performedBy: request.auth.uid,
            targetId: orderId,
            targetType: "order",
            metadata: { resolution, previousStatus: orderData.status, adminComment },
        });

        // Notificar al cliente
        await sendFcmToUser(
            orderData.userId, 
            "Disputa Resuelta ⚖️", 
            `La disputa del pedido #${orderId.slice(-6)} ha sido resuelta como: ${resolution}.`
        );

        log(`[resolveDispute] Resolved ${orderId} as ${resolution}`, { adminId: request.auth.uid });
        return { success: true, newStatus };
    }, { requiredRoles: ["ADMIN", "SUPER_ADMIN"] })
);

// ─── onOrderCreated ───────────────────────────────────────────────────────────

/**
 * Trigger: publica el evento ORDER_CREATED en pubsub para notificar al staff del venue.
 */
const onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
    const orderData = event.data.data();
    const orderId = event.params.orderId;
    if (!orderData || !orderData.venueId) return;

    try {
        await publishMessage("order-events", {
            type: "ORDER_CREATED",
            orderId,
            venueId: orderData.venueId,
            customerName: orderData.customerName || "Un cliente",
            totalAmount: orderData.totalAmount || 0,
            timestamp: new Date().toISOString(),
        });
    } catch (e) { logError("onOrderCreated PubSub Error", e); }
});

module.exports = {
    createOrder,
    onOrderUpdated,
    onOrderCreated,
    acceptOrder,
    markOrderReady,
    rejectOrder,
    cancelOrderByClient,
    releaseToDriverPool,
    assignDriver,
    takeDelivery,
    markOrderInTransit,
    markDeliveredByDriver,
    confirmDelivery,
    disputeDelivery,
    resolveDispute,
};
