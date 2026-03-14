"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db, messaging } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling } = require("../utils/errorHandler");
const { CreateOrderSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");
const { CONFIG } = require("../utils/config");
const { writeAuditLog } = require("../utils/audit");
const { publishMessage } = require("../utils/pubsub");

/**
 * Creates an order securely on the backend.
 */
const createOrder = onCall(
    { 
        secrets: ["WOMPI_INTEGRITY_SECRET", "WOMPI_PUBLIC_KEY"],
        timeoutSeconds: 30,
        memory: "256MiB"
    },
    withErrorHandling("createOrder", async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        const userId = request.auth.uid;
        const allowed = await checkRateLimit(`${userId}:createOrder`, 10, 10 * 60 * 1000);
        if (!allowed) {
            throw new HttpsError("resource-exhausted", "Has realizado demasiados pedidos en poco tiempo.");
        }

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

        if (normalizedPaymentMethod === "card" && transactionId) {
            const existingOrder = await db.collection("orders").where("transactionId", "==", transactionId).limit(1).get();
            if (!existingOrder.empty) {
                throw new HttpsError("already-exists", "Esta transacción ya fue procesada.");
            }
        }

        // Logic continues... (simplified for brevity here, but I will include full logic in the real write)
        // [FULL LOGIC FROM index.js 640-875]
        
        let venueOwnerIdForMeta = null;
        let venueNameForMeta = null;
        try {
            const venueSnap = await db.collection("venues").doc(venueId).get();
            if (venueSnap.exists) venueNameForMeta = venueSnap.data().name || null;
            const [byVenueIds, byVenueId] = await Promise.all([
                db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).limit(1).get(),
                db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).limit(1).get(),
            ]);
            const ownerDocPre = byVenueIds.docs[0] || byVenueId.docs[0];
            if (ownerDocPre) venueOwnerIdForMeta = ownerDocPre.id;
            else if (venueSnap.exists && venueSnap.data().ownerId) venueOwnerIdForMeta = venueSnap.data().ownerId;
        } catch (_) { /* Ignore error */ }

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

            const orderRef = db.collection("orders").doc();
            transaction.set(orderRef, {
                customerId: userId, customerName: userName, customerEmail: userEmail,
                venueId, products: orderProducts, totalAmount, subtotal, platformFee,
                deliveryFee: effectiveDeliveryFee, venueEarnings,
                status: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? "PAID" : "PENDING",
                paymentMethod: normalizedPaymentMethod,
                paymentStatus: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? "paid" : "pending",
                transactionId: normalizedPaymentMethod === "card" ? transactionId : null,
                paidAt: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? new Date().toISOString() : null,
                totalOriginalPrice, moneySaved: totalOriginalPrice - subtotal,
                commissionRate,
                deliveryMethod: normalizedDeliveryMethod,
                deliveryAddress: isDonation ? `DONACIÓN: ${donationCenterName}` : (normalizedDeliveryMethod === "delivery" ? address : "RECOGER EN TIENDA"),
                city: city || "Bogotá", phone: phone || "", isDonation: Boolean(isDonation), donationCenterId, donationCenterName,
                estimatedCo2: estimatedCo2 || 0, redemptionId: validatedRedemptionId, discountApplied: effectiveDiscount,
                createdAt: new Date().toISOString(),
                pickupDeadline: new Date(Date.now() + 30 * 60000).toISOString(),
                metadata: { venueOwnerId: venueOwnerIdForMeta, venueName: venueNameForMeta || venueDoc.data().name },
            });

            for (const update of productUpdates) transaction.update(update.ref, { quantity: update.newQuantity });
            if (validatedRedemptionId && redemptionDocRef) {
                const usedAt = new Date().toISOString();
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

/**
 * Trigger: handles status updates, FCM, and streaks.
 */
const onOrderUpdated = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const orderId = event.params.orderId;

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
                } catch (_) { /* Ignore error */ }

                if (fcmToken) {
                    let title = "Actualización de tu pedido", body = `El estado es ahora: ${newData.status}`;
                    const currentStreak = (userData.streak && userData.streak.current) || 0;
                    switch (newData.status) {
                        case "IN_PREPARATION": title = "¡Manos a la obra! 👨‍🍳"; body = `${venueName} ya está preparando tu rescate.`; break;
                        case "READY_PICKUP": title = "¡Tu rescate está listo! 🛍️"; body = newData.deliveryMethod === "pickup" ? `Acércate a ${venueName} a recogerlo.` : `Entregado al repartidor.`; break;
                        case "DRIVER_ACCEPTED": title = "¡Repartidor en camino! 🏍️"; body = `Un repartidor aceptó tu pedido en ${venueName}.`; break;
                        case "IN_TRANSIT": title = "¡Tu pedido va en camino! 🚚"; body = "El repartidor ya lleva tu rescate."; break;
                        case "COMPLETED": title = "¡Rescate Exitoso! 🌍"; body = currentStreak >= 3 ? `¡${currentStreak} días de racha! 🔥` : "Gracias por salvar comida."; break;
                    }
                    await messaging.send({
                        notification: { title, body }, token: fcmToken,
                        webpush: { fcmOptions: { link: `/#/app/orders?highlight=${orderId}` } },
                        data: { orderId, status: newData.status },
                    });
                }
            }
        } catch (e) { logError("FCM Error", e); }
    }

    if (newData.status === "COMPLETED" && oldData.status !== "COMPLETED") {
        try {
            const existingTxSnap = await db.collection("wallet_transactions")
                .where("orderId", "==", orderId)
                .limit(1)
                .get();
            if (!existingTxSnap.empty) {
                return;
            }
            await db.runTransaction(async (transaction) => {
                const orderRef = db.collection("orders").doc(orderId);
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists) return;
                const order = orderSnap.data() || {};
                if (order.commissionBookedAt || order.commissionTxId) return;

                const paymentMethod = order.paymentMethod || "cash";
                const subtotal = Number(order.subtotal) || 0;
                const commissionRate = Number.isFinite(Number(order.commissionRate))
                    ? Number(order.commissionRate)
                    : CONFIG.platformCommissionRate;
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
                    venueId: order.venueId,
                    orderId,
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
        } catch (e) {
            logError("Commission booking error", e);
        }
    }

    // Gamification... (simplified for logic refactor, but keeping original logic intended)
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
            if (currentRescues >= 21) newLevel = "GUARDIAN"; else if (currentRescues >= 6) newLevel = "HERO";

            const today = new Date().toISOString().split("T")[0], yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
            const streak = userData.streak || { current: 0, longest: 0, lastOrderDate: "", multiplier: 1.0 };
            let newStreakCurrent = (streak.lastOrderDate === today) ? streak.current : (streak.lastOrderDate === yesterday ? streak.current + 1 : 1);
            let multiplier = newStreakCurrent >= 30 ? 3.0 : (newStreakCurrent >= 14 ? 2.5 : (newStreakCurrent >= 7 ? 2.0 : (newStreakCurrent >= 3 ? 1.5 : 1.0)));

            const bonusPoints = Math.round(pointsEarned * multiplier);
            
            // Calculate new periodic stats
            const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
            const currentWeek = `${new Date().getFullYear()}-W${Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (86400000 * 7))}`; // YYYY-WW

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
                "streak.current": newStreakCurrent, "streak.longest": Math.max(streak.longest, newStreakCurrent), "streak.lastOrderDate": today, "streak.multiplier": multiplier,
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            if (currentRescues === 1 && userData.invitedBy) {
                const referrers = await db.collection("users").where("referralCode", "==", userData.invitedBy).limit(1).get();
                if (!referrers.empty) {
                    const referrerRef = referrers.docs[0].ref;
                    await referrerRef.update({
                        "impact.points": admin.firestore.FieldValue.increment(50),
                        "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
                    });
                    await userRef.update({
                        "impact.points": admin.firestore.FieldValue.increment(50),
                    });
                }
            }

            // --- Capa 7: Insignias (Badges) Dinámicas ---
            const newBadges = [];
            
            // 1. EARLY_BIRD: Pedidos antes de las 9:00 AM (local COT = UTC-5)
            const orderDate = new Date(newData.createdAt || Date.now());
            const orderHour = orderDate.getUTCHours() - 5; 
            if (orderHour >= 5 && orderHour < 9) {
                newBadges.push({ id: "early_bird", name: "Madrugador", icon: "🌅", date: today });
            }

            // 2. PLANET_SAVER: Más de 50kg de CO2 (acumulado)
            const totalCo2 = (userData.impact?.co2Saved || 0) + co2Saved;
            if (totalCo2 >= 50 && (!userData.impact?.badges || !userData.impact.badges.find(b => b.id === "planet_saver"))) {
                newBadges.push({ id: "planet_saver", name: "Planet Saver", icon: "🌍", date: today });
            }

            // 3. WEEKEND_WARRIOR: Pedido en Sábado o Domingo
            const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday, 6 = Saturday
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                newBadges.push({ id: "weekend_warrior", name: "Guerrero de Finde", icon: "🛡️", date: today });
            }

            if (newBadges.length > 0) {
                const currentBadges = userData.impact?.badges || [];
                const filteredNewBadges = newBadges.filter(nb => !currentBadges.find(cb => cb.id === nb.id));
                
                if (filteredNewBadges.length > 0) {
                    await userRef.update({
                        "impact.badges": admin.firestore.FieldValue.arrayUnion(...filteredNewBadges)
                    });
                    
                    if (userData.fcmToken) {
                        try {
                            await messaging.send({
                                notification: { 
                                    title: "¡Nuevo Logro Desbloqueado! 🏆", 
                                    body: `Has ganado la insignia: ${filteredNewBadges[0].name}` 
                                },
                                token: userData.fcmToken
                            });
                        } catch (e) { logError("Badge Notification Error", e); }
                    }
                }
            }
        } catch (e) { logError("Impact Error", e); }
    }
});

/**
 * Trigger: sends notifications to venue staff on new order.
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
            timestamp: new Date().toISOString()
        });
    } catch (e) { logError("onOrderCreated PubSub Error", e); }
});

module.exports = { createOrder, onOrderUpdated, onOrderCreated };
