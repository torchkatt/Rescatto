"use strict";

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const crypto = require("crypto-js");
const cryptoNode = require("crypto");
const sgMail = require("@sendgrid/mail");

// Initialize Firebase Admin
admin.initializeApp();

// ─── CORS: restrict origins in production ────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === "production";
const ALLOWED_ORIGINS = IS_PROD
    ? [
        "https://rescatto.com",
        "https://app.rescatto.com",
        "https://rescatto-c8d2b.web.app",
        "https://rescatto-c8d2b.firebaseapp.com",
    ]
    : true;

// ─── Configuration (non-secret values only at module level) ──────────────────
// Secrets (WOMPI_INTEGRITY_SECRET, WOMPI_PUBLIC_KEY, SENDGRID_KEY) are injected
// by Firebase Secret Manager into process.env. Each function that needs them
// must declare them in its options: secrets: ['SECRET_NAME'].
const CONFIG = {
    platformCommissionRate: 0.10, // 10%
    deliveryFee: 5000, // COP flat fallback
    sendgrid: {
        from: process.env.SENDGRID_FROM || "noreply@rescatto.com",
    },
};

// ─── Rate Limiter (Firestore sliding-window) ──────────────────────────────────
/**
 * @param {string} key     - Unique key (e.g. `${uid}:createOrder`)
 * @param {number} maxReqs - Max allowed requests in the window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {Promise<boolean>} true = allowed, false = rate-limit exceeded
 */
async function checkRateLimit(key, maxReqs, windowMs) {
    const db = admin.firestore();
    const docId = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
    const rateLimitRef = db.collection("rate_limits").doc(docId);
    const now = Date.now();
    const windowStart = now - windowMs;

    return db.runTransaction(async (t) => {
        const snap = await t.get(rateLimitRef);
        const existing = snap.exists ? (snap.data().requests || []) : [];
        const recent = existing.filter(ts => ts > windowStart);
        if (recent.length >= maxReqs) return false;
        recent.push(now);
        t.set(rateLimitRef, { requests: recent, lastUpdated: now });
        return true;
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateEmail = (email) =>
    String(email).toLowerCase().match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );

const normalizeVenueIds = (userData) => {
    const values = [];
    if (userData && Array.isArray(userData.venueIds)) {
        values.push(...userData.venueIds.filter(v => typeof v === "string" && v.length > 0));
    }
    if (userData && typeof userData.venueId === "string" && userData.venueId.length > 0) {
        values.push(userData.venueId);
    }
    return [...new Set(values)];
};

const isAdminRole = (role) => role === "SUPER_ADMIN" || role === "ADMIN";

const REFERRAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateReferralCode() {
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += REFERRAL_CHARS.charAt(Math.floor(Math.random() * REFERRAL_CHARS.length));
    }
    return code;
}

async function createUniqueReferralCode(db, maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = generateReferralCode();
        const snap = await db.collection("users")
            .where("referralCode", "==", candidate)
            .limit(1)
            .get();
        if (snap.empty) return candidate;
    }
    throw new HttpsError("resource-exhausted", "No se pudo generar un código único.");
}

async function hasOrderRelationship(db, callerId, callerRole, callerData, recipientUserId) {
    if (callerRole === "DRIVER") {
        const snap = await db.collection("orders")
            .where("driverId", "==", callerId)
            .limit(200)
            .get();
        return snap.docs.some(d => d.data().customerId === recipientUserId);
    }

    if (callerRole === "VENUE_OWNER" || callerRole === "KITCHEN_STAFF") {
        const venueIds = normalizeVenueIds(callerData);
        if (venueIds.length === 0) return false;
        const chunks = [];
        for (let i = 0; i < venueIds.length; i += 30) chunks.push(venueIds.slice(i, i + 30));
        for (const chunk of chunks) {
            const snap = await db.collection("orders")
                .where("venueId", "in", chunk)
                .limit(200)
                .get();
            if (snap.docs.some(d => d.data().customerId === recipientUserId)) return true;
        }
        return false;
    }

    if (callerRole === "CUSTOMER") {
        const snap = await db.collection("orders")
            .where("customerId", "==", callerId)
            .limit(200)
            .get();
        return snap.docs.some(d => d.data().driverId === recipientUserId);
    }

    return false;
}

async function hasChatRelationship(db, link, callerId, recipientUserId) {
    if (!link || typeof link !== "string") return false;
    const match = /^\/chat\?id=([A-Za-z0-9_-]{6,})$/.exec(link);
    if (!match) return false;
    const chatDoc = await db.collection("chats").doc(match[1]).get();
    if (!chatDoc.exists) return false;
    const participants = Array.isArray((chatDoc.data() || {}).participants) ? chatDoc.data().participants : [];
    return participants.includes(callerId) && participants.includes(recipientUserId);
}

// ─────────────────────────────────────────────────────────────────────────────
// createNotification
// Creates an in-app notification with backend authorization checks.
// ─────────────────────────────────────────────────────────────────────────────
exports.createNotification = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerId = request.auth.uid;
    const data = request.data || {};
    const userId = typeof data.userId === "string" ? data.userId.trim() : "";
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";
    const type = typeof data.type === "string" ? data.type : "info";
    const link = typeof data.link === "string" && data.link.trim().length > 0 ? data.link.trim() : null;

    if (!userId || !title || !message) {
        throw new HttpsError("invalid-argument", "userId, title and message are required.");
    }
    if (title.length > 120 || message.length > 500) {
        throw new HttpsError("invalid-argument", "Notification content is too long.");
    }
    if (link && (!link.startsWith("/") || link.length > 300)) {
        throw new HttpsError("invalid-argument", "Invalid link.");
    }

    const allowedTypes = ["info", "success", "warning", "error"];
    const safeType = allowedTypes.includes(type) ? type : "info";

    const allowed = await checkRateLimit(`${callerId}:createNotification`, 40, 60 * 1000);
    if (!allowed) {
        throw new HttpsError("resource-exhausted", "Too many notifications. Try again later.");
    }

    const db = admin.firestore();
    const [callerDoc, recipientDoc] = await Promise.all([
        db.collection("users").doc(callerId).get(),
        db.collection("users").doc(userId).get(),
    ]);

    if (!callerDoc.exists) throw new HttpsError("permission-denied", "Caller profile not found.");
    if (!recipientDoc.exists) throw new HttpsError("not-found", "Recipient user not found.");

    const callerData = callerDoc.data() || {};
    const callerRole = callerData.role || "CUSTOMER";

    if (!isAdminRole(callerRole) && userId !== callerId) {
        const [orderRelation, chatRelation] = await Promise.all([
            hasOrderRelationship(db, callerId, callerRole, callerData, userId),
            hasChatRelationship(db, link, callerId, userId),
        ]);
        if (!orderRelation && !chatRelation) {
            throw new HttpsError("permission-denied", "Not allowed to notify this user.");
        }
    }

    const notificationRef = await db.collection("notifications").add({
        userId,
        title,
        message,
        type: safeType,
        read: false,
        link: link || null,
        senderId: callerId,
        senderRole: callerRole,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, notificationId: notificationRef.id };
});

// ─────────────────────────────────────────────────────────────────────────────
// ensureReferralCode
// Ensures the authenticated user has a referral code.
// ─────────────────────────────────────────────────────────────────────────────
exports.ensureReferralCode = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const allowed = await checkRateLimit(`${userId}:ensureReferralCode`, 8, 60 * 1000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Too many requests.");

    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");

    const userData = userSnap.data() || {};
    if (typeof userData.referralCode === "string" && userData.referralCode.trim().length >= 6) {
        return { referralCode: userData.referralCode.trim(), created: false };
    }

    const referralCode = await createUniqueReferralCode(db);
    await userRef.set({
        referralCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { referralCode, created: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveVenueChatTarget
// Resolves the venue owner userId for a customer's order chat.
// ─────────────────────────────────────────────────────────────────────────────
exports.resolveVenueChatTarget = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerId = request.auth.uid;
    const data = request.data || {};
    const orderId = typeof data.orderId === "string" ? data.orderId.trim() : "";
    if (!orderId) throw new HttpsError("invalid-argument", "orderId is required.");

    const allowed = await checkRateLimit(`${callerId}:resolveVenueChatTarget`, 20, 60 * 1000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Too many requests.");

    const db = admin.firestore();
    const [orderSnap, callerSnap] = await Promise.all([
        db.collection("orders").doc(orderId).get(),
        db.collection("users").doc(callerId).get(),
    ]);

    if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found.");
    if (!callerSnap.exists) throw new HttpsError("permission-denied", "Caller profile not found.");

    const orderData = orderSnap.data() || {};
    const callerRole = (callerSnap.data() || {}).role || "CUSTOMER";
    const isOrderOwner = orderData.customerId === callerId;
    if (!isOrderOwner && !isAdminRole(callerRole)) {
        throw new HttpsError("permission-denied", "Not allowed to resolve this order.");
    }

    const venueId = orderData.venueId;
    if (!venueId || typeof venueId !== "string") {
        throw new HttpsError("failed-precondition", "Order has no venueId.");
    }

    // Buscar en paralelo: venueIds (array post-migración) y venueId (string legacy)
    const [byVenueIds, byVenueId] = await Promise.all([
        db.collection("users")
            .where("role", "==", "VENUE_OWNER")
            .where("venueIds", "array-contains", venueId)
            .limit(1)
            .get(),
        db.collection("users")
            .where("role", "==", "VENUE_OWNER")
            .where("venueId", "==", venueId)
            .limit(1)
            .get(),
    ]);

    const ownerDoc = byVenueIds.docs[0] || byVenueId.docs[0];

    if (!ownerDoc) throw new HttpsError("not-found", "Venue owner not found for this order.");

    const ownerData = ownerDoc.data() || {};
    return { userId: ownerDoc.id, userName: ownerData.fullName || "Restaurante", venueId };
});

// ─────────────────────────────────────────────────────────────────────────────
// generateWompiSignature
// Generates the SHA-256 integrity signature required by Wompi.
// ─────────────────────────────────────────────────────────────────────────────
exports.generateWompiSignature = onRequest(
    {
        cors: ALLOWED_ORIGINS,
        secrets: ["WOMPI_INTEGRITY_SECRET", "WOMPI_PUBLIC_KEY"],
    },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Method Not Allowed" });
        }

        try {
            const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
            const ipAllowed = await checkRateLimit(`ip:wompiSig:${ip}`, 20, 60 * 1000);
            if (!ipAllowed) {
                return res.status(429).send({ error: "Too many requests. Please try again later." });
            }

            const { reference, amount, currency = "COP" } = req.body;
            if (!reference || typeof reference !== "string") {
                return res.status(400).send({ error: "Invalid or missing reference" });
            }
            if (!amount || isNaN(amount) || amount <= 0) {
                return res.status(400).send({ error: "Invalid or missing amount" });
            }

            const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || (IS_PROD ? null : "test_integrity_secret_PLACEHOLDER");
            const publicKey = process.env.WOMPI_PUBLIC_KEY || (IS_PROD ? null : "test_public_key_PLACEHOLDER");

            if (!integritySecret) {
                console.error("FATAL: WOMPI_INTEGRITY_SECRET not set in production.");
                return res.status(500).send({ error: "Payment configuration error." });
            }

            const amountInCents = Math.round(amount * 100);
            const signatureString = `${reference}${amountInCents}${currency}${integritySecret}`;
            const signature = crypto.SHA256(signatureString).toString(crypto.enc.Hex).toUpperCase();

            return res.status(200).send({ signature, reference, amountInCents, currency, publicKey });

        } catch (error) {
            console.error("Error generating signature:", error);
            return res.status(500).send({ error: "Internal Server Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// wompiWebhook
// Receives Wompi payment events and validates HMAC-SHA256 integrity signature.
// ─────────────────────────────────────────────────────────────────────────────
exports.wompiWebhook = onRequest(
    {
        cors: ALLOWED_ORIGINS,
        secrets: ["WOMPI_INTEGRITY_SECRET"],
    },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Method Not Allowed" });
        }

        try {
            const wompiSignature = req.headers["x-wompi-signature"];
            const wompiTimestamp = req.headers["x-wompi-timestamp"];

            if (!wompiSignature || !wompiTimestamp) {
                console.warn("Wompi webhook: missing signature headers");
                return res.status(400).send({ error: "Missing signature headers" });
            }

            const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || (IS_PROD ? null : "test_integrity_secret_PLACEHOLDER");
            if (!integritySecret) {
                console.error("FATAL: WOMPI_INTEGRITY_SECRET not set.");
                return res.status(500).send({ error: "Configuration error." });
            }

            // Constant-time HMAC-SHA256 validation
            const rawBody = JSON.stringify(req.body);
            const expectedSignature = cryptoNode
                .createHmac("sha256", integritySecret)
                .update(`${wompiTimestamp}.${rawBody}`)
                .digest("hex");

            let signaturesMatch = false;
            try {
                const sigBuffer = Buffer.from(wompiSignature, "hex");
                const expectedBuffer = Buffer.from(expectedSignature, "hex");
                signaturesMatch = sigBuffer.length === expectedBuffer.length &&
                    cryptoNode.timingSafeEqual(sigBuffer, expectedBuffer);
            } catch (_) {
                signaturesMatch = false;
            }

            if (!signaturesMatch) {
                console.warn("Wompi webhook: INVALID signature — rejecting event");
                return res.status(401).send({ error: "Invalid signature" });
            }

            const event = req.body;
            const eventType = event.event;
            const transactionData = event.data && event.data.transaction;
            if (!transactionData) return res.status(200).send({ received: true });

            console.log(`Wompi webhook OK: ${eventType} | tx=${transactionData.id} | status=${transactionData.status}`);

            const db = admin.firestore();

            // Idempotency guard — atomic check-and-set BEFORE any processing
            const idempotencyKey = `${transactionData.id}-${transactionData.status}`;
            const dedupRef = db.collection("webhook_dedup").doc(idempotencyKey);
            const isNew = await db.runTransaction(async (t) => {
                const snap = await t.get(dedupRef);
                if (snap.exists) return false;
                t.set(dedupRef, {
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    eventType,
                    transactionStatus: transactionData.status,
                });
                return true;
            });

            if (!isNew) {
                console.log(`Webhook already processed for key ${idempotencyKey}, skipping.`);
                return res.status(200).send({ received: true, duplicate: true });
            }

            // Handle APPROVED: mark order as PAID and credit venue wallet
            if (eventType === "transaction.updated" && transactionData.status === "APPROVED") {
                const q = await db.collection("orders")
                    .where("transactionId", "==", transactionData.id)
                    .limit(1)
                    .get();

                if (!q.empty) {
                    const orderDoc = q.docs[0];
                    const txResult = await db.runTransaction(async (t) => {
                        const freshOrderSnap = await t.get(orderDoc.ref);
                        if (!freshOrderSnap.exists) return { updated: false, reason: "missing_order" };

                        const orderData = freshOrderSnap.data() || {};
                        if (orderData.paymentStatus === "paid") return { updated: false, reason: "already_paid" };

                        t.update(orderDoc.ref, {
                            paymentStatus: "paid",
                            status: "PAID",
                            paidAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });

                        const venueId = orderData.venueId || null;
                        const venueEarnings = Math.max(0, Number(orderData.venueEarnings) || 0);
                        if (venueId && venueEarnings > 0) {
                            const walletRef = db.collection("wallets").doc(venueId);
                            const walletTxRef = db.collection("wallet_transactions").doc(`order_${orderDoc.id}_online_credit`);
                            const walletTxSnap = await t.get(walletTxRef);

                            if (!walletTxSnap.exists) {
                                const walletSnap = await t.get(walletRef);
                                const currentBalance = walletSnap.exists ? (Number(walletSnap.data().balance) || 0) : 0;

                                t.set(walletRef, {
                                    venueId,
                                    balance: currentBalance + venueEarnings,
                                    updatedAt: new Date().toISOString(),
                                }, { merge: true });

                                t.set(walletTxRef, {
                                    venueId,
                                    orderId: orderDoc.id,
                                    type: "CREDIT",
                                    amount: venueEarnings,
                                    description: `Ganancia pedido online (${orderData.deliveryMethod === "pickup" ? "Recogida" : "Domicilio"})`,
                                    referenceType: "ORDER_ONLINE",
                                    source: "wompiWebhook",
                                    createdAt: new Date().toISOString(),
                                });
                            }
                        }

                        return { updated: true, reason: "ok" };
                    });

                    console.log(`Order ${orderDoc.id} APPROVED webhook → ${txResult.updated ? "PAID" : "skipped (" + txResult.reason + ")"}`);
                } else {
                    console.error(`Wompi webhook: order not found for transaction ${transactionData.id}`);
                    await db.collection("webhook_errors").doc().set({
                        service: "wompi", eventType, transactionId: transactionData.id,
                        reason: "order not found",
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }

            // Handle DECLINED / ERROR: mark payment as failed
            if (eventType === "transaction.updated" &&
                (transactionData.status === "DECLINED" || transactionData.status === "ERROR")) {
                const q = await db.collection("orders")
                    .where("transactionId", "==", transactionData.id)
                    .limit(1)
                    .get();

                if (!q.empty) {
                    const txResult = await db.runTransaction(async (t) => {
                        const orderSnap = await t.get(q.docs[0].ref);
                        if (!orderSnap.exists) return { updated: false, reason: "missing_order" };
                        const orderData = orderSnap.data() || {};
                        if (orderData.paymentStatus === "paid") return { updated: false, reason: "already_paid" };
                        t.update(q.docs[0].ref, {
                            paymentStatus: "failed",
                            status: "CANCELLED",
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        return { updated: true, reason: "ok" };
                    });

                    console.log(`Order ${q.docs[0].id} FAILED webhook → ${txResult.updated ? "CANCELLED" : "skipped (" + txResult.reason + ")"}`);
                }
            }

            return res.status(200).send({ received: true });

        } catch (error) {
            console.error("Wompi webhook error:", error);
            return res.status(500).send({ error: "Internal Server Error" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// createOrder
// Creates an order securely on the backend, validating prices and stock.
// Performs atomic updates on Inventory and Wallet.
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrder = onCall(
    { secrets: ["WOMPI_INTEGRITY_SECRET", "WOMPI_PUBLIC_KEY"] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be logged in.");
        }

        const userId = request.auth.uid;

        // Rate limit: max 10 orders per user per 10 minutes
        const allowed = await checkRateLimit(`${userId}:createOrder`, 10, 10 * 60 * 1000);
        if (!allowed) {
            throw new HttpsError(
                "resource-exhausted",
                "Has realizado demasiados pedidos en poco tiempo. Espera unos minutos."
            );
        }

        const data = request.data || {};
        const {
            venueId,
            products,
            paymentMethod,
            deliveryMethod,
            address,
            phone,
            transactionId,
            isDonation,
            donationCenterId,
            donationCenterName,
        } = data;

        const normalizedPaymentMethod = paymentMethod === "card" || paymentMethod === "cash" ? paymentMethod : null;
        const normalizedDeliveryMethod =
            deliveryMethod === "delivery" || deliveryMethod === "pickup" || deliveryMethod === "donation"
                ? deliveryMethod
                : null;

        // Cap estimatedCo2 at 10kg max, must be non-negative
        const estimatedCo2 = Math.max(0, Math.min(Number(data.estimatedCo2) || 0, 10));

        // Accept client's distance-based delivery fee but clamp to [0, 25000] COP
        const rawClientFee = Number(data.deliveryFee);
        const clientDeliveryFee = (!isNaN(rawClientFee) && rawClientFee >= 0 && rawClientFee <= 25000)
            ? Math.round(rawClientFee)
            : null;

        // redemptionId validated exclusively on backend
        const redemptionId = typeof data.redemptionId === "string" && data.redemptionId.trim().length > 0
            ? data.redemptionId.trim()
            : null;

        const userEmail = request.auth.token.email || "";
        const userName = request.auth.token.name || "Usuario";

        // Strict input validation
        if (!venueId || typeof venueId !== "string") throw new HttpsError("invalid-argument", "Invalid venueId.");
        if (!normalizedPaymentMethod) throw new HttpsError("invalid-argument", "Invalid payment method.");
        if (!normalizedDeliveryMethod) throw new HttpsError("invalid-argument", "Invalid delivery method.");
        if (!products || !Array.isArray(products) || products.length === 0) {
            throw new HttpsError("invalid-argument", "Products must be a non-empty array.");
        }

        products.forEach((p, index) => {
            if (!p.productId || typeof p.productId !== "string") {
                throw new HttpsError("invalid-argument", `Product at index ${index} missing productId.`);
            }
            if (!p.quantity || typeof p.quantity !== "number" || p.quantity <= 0) {
                throw new HttpsError("invalid-argument", `Product at index ${index} has invalid quantity.`);
            }
        });

        if (normalizedDeliveryMethod === "delivery" && (!address || typeof address !== "string")) {
            throw new HttpsError("invalid-argument", "Address is required for delivery.");
        }
        if (normalizedDeliveryMethod === "donation" && !donationCenterId) {
            throw new HttpsError("invalid-argument", "Donation center is required for donation delivery.");
        }
        if (normalizedPaymentMethod === "card" && (!transactionId || typeof transactionId !== "string")) {
            throw new HttpsError("invalid-argument", "Valid transactionId is required for card payments.");
        }

        const db = admin.firestore();

        // Validate transactionId uniqueness to prevent double-billing
        if (normalizedPaymentMethod === "card" && transactionId) {
            const existingOrder = await db.collection("orders")
                .where("transactionId", "==", transactionId)
                .limit(1)
                .get();
            if (!existingOrder.empty) {
                throw new HttpsError(
                    "already-exists",
                    "Esta transacción ya fue procesada. Contacta soporte si crees que es un error."
                );
            }
        }

        try {
            return await db.runTransaction(async (transaction) => {
                let cardApprovedBeforeOrder = false;
                if (normalizedPaymentMethod === "card") {
                    const approvedRef = db.collection("webhook_dedup").doc(`${transactionId}-APPROVED`);
                    const declinedRef = db.collection("webhook_dedup").doc(`${transactionId}-DECLINED`);
                    const errorRef = db.collection("webhook_dedup").doc(`${transactionId}-ERROR`);

                    const [approvedSnap, declinedSnap, errorSnap] = await Promise.all([
                        transaction.get(approvedRef),
                        transaction.get(declinedRef),
                        transaction.get(errorRef),
                    ]);

                    if (declinedSnap.exists || errorSnap.exists) {
                        throw new HttpsError(
                            "failed-precondition",
                            "La transacción reporta estado fallido y no puede crear una orden."
                        );
                    }

                    cardApprovedBeforeOrder = approvedSnap.exists;
                }

                // Fetch Venue
                const venueDoc = await transaction.get(db.collection("venues").doc(venueId));
                if (!venueDoc.exists) throw new HttpsError("not-found", "Venue not found.");

                let subtotal = 0;
                let totalOriginalPrice = 0;
                const productUpdates = [];
                const orderProducts = [];
                const unavailableProducts = [];
                const nowMs = Date.now();

                // Validate products and calculate totals using SERVER prices
                for (const item of products) {
                    const productDoc = await transaction.get(db.collection("products").doc(item.productId));
                    if (!productDoc.exists) {
                        throw new HttpsError("not-found", `Product ${item.productId} not found.`);
                    }

                    const productData = productDoc.data() || {};
                    const stockQuantity = Number(productData.quantity) || 0;
                    const availableUntilMs = productData.availableUntil ? Date.parse(productData.availableUntil) : NaN;
                    const isExpired = Number.isFinite(availableUntilMs) && availableUntilMs <= nowMs;

                    if (stockQuantity < item.quantity || isExpired) {
                        unavailableProducts.push({
                            productId: item.productId,
                            name: productData.name || "Producto",
                            availableQuantity: stockQuantity,
                            requestedQuantity: item.quantity,
                            reason: isExpired ? "expired" : "insufficient_stock",
                        });
                        continue;
                    }

                    // Use SERVER price — client price is ignored
                    const price = (productData.discountedPrice !== undefined && productData.discountedPrice !== null)
                        ? Number(productData.discountedPrice)
                        : Number(productData.originalPrice);
                    const originalPrice = Number(productData.originalPrice) || price;

                    subtotal += price * item.quantity;
                    totalOriginalPrice += originalPrice * item.quantity;

                    orderProducts.push({
                        productId: item.productId,
                        name: productData.name,
                        quantity: item.quantity,
                        price,
                        originalPrice,
                        imageUrl: productData.imageUrl || "",
                    });

                    productUpdates.push({ ref: productDoc.ref, newQuantity: stockQuantity - item.quantity });
                }

                if (unavailableProducts.length > 0) {
                    throw new HttpsError(
                        "failed-precondition",
                        "Algunos productos ya no están disponibles. Actualiza tu carrito.",
                        { code: "PRODUCT_UNAVAILABLE", products: unavailableProducts }
                    );
                }

                // Pre-fetch Wallet (MUST be before any writes)
                const walletRef = db.collection("wallets").doc(venueId);
                const walletDoc = await transaction.get(walletRef);

                const effectiveDeliveryFee = normalizedDeliveryMethod === "delivery"
                    ? (clientDeliveryFee !== null ? clientDeliveryFee : CONFIG.deliveryFee)
                    : 0;
                const platformFee = Math.round((subtotal * CONFIG.platformCommissionRate) * 100) / 100;
                const venueEarnings = Math.round((subtotal - platformFee) * 100) / 100;

                // Validate redemption coupon
                let effectiveDiscount = 0;
                let validatedRedemptionId = null;
                let redemptionDocRef = null;
                if (redemptionId) {
                    redemptionDocRef = db.collection("redemptions").doc(redemptionId);
                    const redemptionDoc = await transaction.get(redemptionDocRef);
                    if (!redemptionDoc.exists) throw new HttpsError("failed-precondition", "El canje seleccionado no existe.");

                    const rd = redemptionDoc.data() || {};
                    if (rd.userId !== userId) throw new HttpsError("permission-denied", "Este canje no pertenece al usuario autenticado.");
                    if (rd.status !== "PENDING" || rd.usedAt) throw new HttpsError("failed-precondition", "Este canje ya fue utilizado.");

                    const expiresAtMs = Date.parse(rd.expiresAt || "");
                    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
                        throw new HttpsError("failed-precondition", "El canje seleccionado ha expirado.");
                    }

                    const discountAmount = Math.max(0, Math.min(Number(rd.discountAmount) || 0, 15000));
                    effectiveDiscount = Math.min(discountAmount, subtotal + effectiveDeliveryFee);
                    validatedRedemptionId = redemptionId;
                }

                const totalAmount = Math.max(0, subtotal + effectiveDeliveryFee - effectiveDiscount);

                const orderData = {
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
                    paidAt: (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder) ? new Date().toISOString() : null,
                    totalOriginalPrice,
                    moneySaved: totalOriginalPrice - subtotal,
                    deliveryMethod: normalizedDeliveryMethod,
                    deliveryAddress: isDonation
                        ? `DONACIÓN: ${donationCenterName || "Centro por definir"}`
                        : (normalizedDeliveryMethod === "delivery" ? address : "RECOGER EN TIENDA"),
                    phone: phone || "",
                    isDonation: Boolean(isDonation),
                    donationCenterId: donationCenterId || null,
                    donationCenterName: donationCenterName || null,
                    estimatedCo2: estimatedCo2 || 0,
                    redemptionId: validatedRedemptionId || null,
                    discountApplied: effectiveDiscount,
                    createdAt: new Date().toISOString(),
                    pickupDeadline: new Date(Date.now() + 30 * 60000).toISOString(),
                };

                // Writes — all reads must be done by now
                const orderRef = db.collection("orders").doc();
                transaction.set(orderRef, orderData);

                for (const update of productUpdates) {
                    transaction.update(update.ref, { quantity: update.newQuantity });
                }

                // Mark redemption as USED
                if (validatedRedemptionId && redemptionDocRef) {
                    const usedAt = new Date().toISOString();
                    const userRef2 = db.collection("users").doc(userId);
                    const userDoc2 = await transaction.get(userRef2);
                    if (userDoc2.exists) {
                        const currentRedemptions = Array.isArray(userDoc2.data().redemptions) ? userDoc2.data().redemptions : [];
                        const updatedRedemptions = currentRedemptions.map(r =>
                            r && r.id === validatedRedemptionId ? { ...r, usedAt } : r
                        );
                        transaction.update(userRef2, { redemptions: updatedRedemptions });
                    }
                    transaction.update(redemptionDocRef, { status: "USED", usedAt, orderId: orderRef.id });
                }

                // Wallet logic
                if (normalizedPaymentMethod === "cash" || (normalizedPaymentMethod === "card" && cardApprovedBeforeOrder)) {
                    const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
                    const walletAdjustment = normalizedPaymentMethod === "cash" ? -platformFee : venueEarnings;

                    transaction.set(walletRef, {
                        venueId,
                        balance: currentBalance + walletAdjustment,
                        updatedAt: new Date().toISOString(),
                    }, { merge: true });

                    const walletTxRef = normalizedPaymentMethod === "cash"
                        ? db.collection("wallet_transactions").doc()
                        : db.collection("wallet_transactions").doc(`order_${orderRef.id}_online_credit`);

                    transaction.set(walletTxRef, {
                        venueId,
                        orderId: orderRef.id,
                        type: normalizedPaymentMethod === "cash" ? "DEBIT" : "CREDIT",
                        amount: Math.abs(walletAdjustment),
                        description: normalizedPaymentMethod === "cash"
                            ? `Comisión pedido efectivo (${normalizedDeliveryMethod === "pickup" ? "Recogida" : "Domicilio"})`
                            : `Ganancia pedido online (${normalizedDeliveryMethod === "pickup" ? "Recogida" : "Domicilio"})`,
                        referenceType: normalizedPaymentMethod === "cash" ? "ORDER_CASH" : "ORDER_ONLINE",
                        source: normalizedPaymentMethod === "cash" ? "createOrder" : "createOrder_preApprovedWebhook",
                        createdAt: new Date().toISOString(),
                    });
                }

                return { success: true, orderId: orderRef.id };
            });

        } catch (error) {
            console.error("Create Order Error:", error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError("internal", error.message);
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// onOrderUpdated
// Firestore trigger: handles push notifications, gamification, and streaks
// when an order's status changes.
// ─────────────────────────────────────────────────────────────────────────────
exports.onOrderUpdated = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const orderId = event.params.orderId;
    const db = admin.firestore();

    // ── Push Notifications ────────────────────────────────────────────────────
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
                } catch (_) { /* non-critical */ }

                if (fcmToken) {
                    let title = "Actualización de tu pedido";
                    let body = `El estado de tu pedido es ahora: ${newData.status}`;
                    const currentStreak = (userData.streak && userData.streak.current) || 0;

                    switch (newData.status) {
                        case "IN_PREPARATION":
                            title = "¡Manos a la obra! 👨‍🍳";
                            body = `${venueName} ya está preparando tu rescate. Estará listo pronto.`;
                            break;
                        case "READY_PICKUP":
                            title = "¡Tu rescate está listo! 🛍️";
                            body = newData.deliveryMethod === "pickup"
                                ? `Acércate a ${venueName} a recoger tu pedido. ¡Corre, está esperando!`
                                : `${venueName} entregó tu pedido al repartidor. Va en camino.`;
                            break;
                        case "DRIVER_ACCEPTED":
                            title = "¡Repartidor en camino! 🏍️";
                            body = `Un repartidor ya aceptó tu pedido y va recogiendo en ${venueName}.`;
                            break;
                        case "IN_TRANSIT":
                            title = "¡Tu pedido va en camino! 🚚";
                            body = "El repartidor ya lleva tu rescate. ¡Prepárate para recibirlo!";
                            break;
                        case "COMPLETED":
                            title = "¡Rescate Exitoso! 🌍";
                            body = currentStreak >= 3
                                ? `¡${currentStreak} días de racha! Sigue así, eres un Guardián 🔥`
                                : "Gracias por salvar comida deliciosa. ¡Cuéntale a tus amigos!";
                            break;
                        case "CANCELLED":
                            title = "Pedido Cancelado 😔";
                            body = "Tu pedido fue cancelado. Te devolvemos el dinero en 3-5 días hábiles.";
                            break;
                        case "MISSED":
                            title = "¡Se escapó el rescate! ⏰";
                            body = `Tu pedido en ${venueName} expiró. ¡Mañana habrá más oportunidades!`;
                            break;
                    }

                    await admin.messaging().send({
                        notification: { title, body },
                        token: fcmToken,
                        webpush: {
                            fcmOptions: { link: `/#/app/orders?highlight=${orderId}` },
                            notification: { icon: "/pwa-192x192.png", badge: "/pwa-192x192.png" },
                        },
                        data: { orderId, status: newData.status, click_action: "OPEN_ORDER" },
                    });
                    console.log(`FCM Sent to ${newData.customerId} — Order ${orderId} → ${newData.status}`);
                }
            }
        } catch (error) {
            console.error("Error sending FCM notification:", error);
        }
    }

    // ── Gamification + Impact ─────────────────────────────────────────────────
    const isNowCompleted = newData.status === "COMPLETED" || newData.status === "DELIVERED";
    const wasNotCompleted = oldData.status !== "COMPLETED" && oldData.status !== "DELIVERED";

    if (!isNowCompleted || !wasNotCompleted) return;

    const userId = newData.customerId;
    const moneySaved = newData.moneySaved || 0;
    const co2Saved = newData.estimatedCo2 !== undefined ? newData.estimatedCo2 : 0.5;
    const pointsEarned = Math.floor(moneySaved / 1000) + Math.floor(co2Saved * 10);

    const userRef = db.collection("users").doc(userId);
    try {
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};

        const currentImpact = userData.impact || { co2Saved: 0, moneySaved: 0, totalRescues: 0, points: 0, level: "NOVICE" };
        const currentRescues = (currentImpact.totalRescues || 0) + 1;
        const validatedCo2 = Math.max(0, Math.min(co2Saved, 10));

        let newLevel = "NOVICE";
        if (currentRescues >= 21) newLevel = "GUARDIAN";
        else if (currentRescues >= 6) newLevel = "HERO";

        // Streak logic
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const existingStreak = userData.streak || { current: 0, longest: 0, lastOrderDate: "", multiplier: 1.0 };
        const lastDate = existingStreak.lastOrderDate || "";

        let newStreakCurrent = existingStreak.current;
        if (lastDate === today) {
            // Already ordered today — streak stays the same
        } else if (lastDate === yesterday) {
            newStreakCurrent = existingStreak.current + 1;
        } else {
            newStreakCurrent = 1;
        }

        const newStreakLongest = Math.max(existingStreak.longest, newStreakCurrent);
        let streakMultiplier = 1.0;
        if (newStreakCurrent >= 30) streakMultiplier = 3.0;
        else if (newStreakCurrent >= 14) streakMultiplier = 2.5;
        else if (newStreakCurrent >= 7) streakMultiplier = 2.0;
        else if (newStreakCurrent >= 3) streakMultiplier = 1.5;

        const streakUpdate = {
            "streak.current": newStreakCurrent,
            "streak.longest": newStreakLongest,
            "streak.lastOrderDate": today,
            "streak.multiplier": streakMultiplier,
        };

        const bonusPoints = Math.round(pointsEarned * streakMultiplier);

        if (!userData.impact) {
            await userRef.update({
                "impact": { totalRescues: 1, co2Saved: validatedCo2, moneySaved, points: bonusPoints, level: newLevel },
                ...streakUpdate,
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            await userRef.update({
                "impact.totalRescues": admin.firestore.FieldValue.increment(1),
                "impact.co2Saved": admin.firestore.FieldValue.increment(validatedCo2),
                "impact.moneySaved": admin.firestore.FieldValue.increment(moneySaved),
                "impact.points": admin.firestore.FieldValue.increment(bonusPoints),
                "impact.level": newLevel,
                ...streakUpdate,
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        console.log(`Updated impact for user ${userId}: +${validatedCo2}kg CO2, +${bonusPoints} pts (x${streakMultiplier} streak=${newStreakCurrent}). Level: ${newLevel}`);

        // Referral bonus: first rescue only
        if (currentRescues === 1 && userData.invitedBy) {
            try {
                const REFERRAL_BONUS = 50;
                const referrersSnap = await db.collection("users")
                    .where("referralCode", "==", userData.invitedBy)
                    .limit(1)
                    .get();

                if (!referrersSnap.empty) {
                    const referrerRef = referrersSnap.docs[0].ref;
                    const referrerData = referrersSnap.docs[0].data();

                    if (referrerData.impact) {
                        await referrerRef.update({
                            "impact.points": admin.firestore.FieldValue.increment(REFERRAL_BONUS),
                            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
                        });
                    } else {
                        await referrerRef.update({
                            "impact": { co2Saved: 0, moneySaved: 0, totalRescues: 0, points: REFERRAL_BONUS, level: "NOVICE" },
                            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }

                    await userRef.update({
                        "impact.points": admin.firestore.FieldValue.increment(REFERRAL_BONUS),
                    });

                    console.log(`Referral bonus: user ${userId} and referrer ${referrersSnap.docs[0].id} each received +${REFERRAL_BONUS} points`);
                } else {
                    console.warn(`Referral code "${userData.invitedBy}" not found — no bonus awarded`);
                }
            } catch (refErr) {
                console.error("Error applying referral bonus:", refErr);
            }
        }
    } catch (error) {
        console.error(`Error updating impact for user ${userId}:`, error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// redeemPoints
// Redeems loyalty points for a reward using an atomic Firestore transaction.
// ─────────────────────────────────────────────────────────────────────────────
exports.redeemPoints = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;

    // Rate limit: max 3 redemptions per user per hour
    const allowed = await checkRateLimit(`${userId}:redeemPoints`, 3, 60 * 60 * 1000);
    if (!allowed) {
        throw new HttpsError("resource-exhausted", "Has alcanzado el límite de canjes. Intenta de nuevo en una hora.");
    }

    const data = request.data || {};
    const rewardId = typeof data.rewardId === "string" ? data.rewardId : null;
    if (!rewardId) throw new HttpsError("invalid-argument", "Reward ID is required.");

    // Catalog controlled on backend (source of truth)
    const REWARD_CONFIG = {
        "discount_5k": { cost: 50, discountAmount: 5000, label: "5.000 COP de descuento" },
        "discount_10k": { cost: 90, discountAmount: 10000, label: "10.000 COP de descuento" },
        "free_pack": { cost: 150, discountAmount: 15000, label: "Pack Sorpresa Gratis (hasta $15.000 COP)" },
        "donation_meal": { cost: 100, discountAmount: 0, label: "Donación de comida" },
        "free_shipping": { cost: 50, discountAmount: 5000, label: "Envío Gratis (equivalente 5.000 COP)" },
        "discount_10": { cost: 150, discountAmount: 10000, label: "10% Descuento Extra (tope 10.000 COP)" },
    };

    const rewardConfig = REWARD_CONFIG[rewardId];
    if (!rewardConfig) throw new HttpsError("invalid-argument", "Reward ID is not valid.");
    const cost = rewardConfig.cost;

    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    try {
        return await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");

            const userData = userDoc.data();
            const impactPoints = userData.impact && userData.impact.points !== undefined ? userData.impact.points : 0;
            const currentPoints = Math.max(0, Number(impactPoints));
            if (isNaN(currentPoints)) throw new HttpsError("internal", "Invalid points balance.");
            if (currentPoints < cost) throw new HttpsError("failed-precondition", "Insufficient points.");

            const redemptionId = `redeem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            const activeRedemption = {
                id: redemptionId,
                rewardId,
                discountAmount: rewardConfig.discountAmount,
                label: rewardConfig.label,
                expiresAt,
                usedAt: null,
            };

            transaction.update(userRef, {
                "impact.points": admin.firestore.FieldValue.increment(-cost),
                "redemptions": admin.firestore.FieldValue.arrayUnion(activeRedemption),
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            transaction.set(db.collection("redemptions").doc(redemptionId), {
                id: redemptionId,
                userId,
                rewardId,
                cost,
                discountAmount: rewardConfig.discountAmount,
                label: rewardConfig.label,
                status: "PENDING",
                expiresAt,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true, newBalance: currentPoints - cost, chargedCost: cost, redemption: activeRedemption };
        });
    } catch (error) {
        console.error("Redemption error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// sendVerificationEmail
// Generates a verification link and sends it via SendGrid.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendVerificationEmail = onCall(
    { secrets: ["SENDGRID_KEY"] },
    async (request) => {
        const data = request.data || {};
        const email = data.email || (request.auth ? request.auth.token.email : null);

        if (!email || !validateEmail(email)) {
            throw new HttpsError("invalid-argument", "Valid email is required.");
        }

        // Rate limit: max 3 verification emails per address per hour
        const emailKey = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
        const allowed = await checkRateLimit(`sendVerif:${emailKey}`, 3, 60 * 60 * 1000);
        if (!allowed) {
            throw new HttpsError("resource-exhausted", "Too many verification emails. Try again later.");
        }

        const sgKey = process.env.SENDGRID_KEY || "";
        if (!sgKey || sgKey === "PLACEHOLDER_KEY") {
            console.error("FATAL: SENDGRID_KEY not configured.");
            throw new HttpsError("internal", "Email service not configured.");
        }
        sgMail.setApiKey(sgKey);

        try {
            const link = await admin.auth().generateEmailVerificationLink(email);

            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifica tu cuenta en Rescatto</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #f3f4f6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; }
            .content { padding: 40px; text-align: center; }
            .content h2 { color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
            .content p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
            .button { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; }
            .footer { padding: 24px; text-align: center; font-size: 13px; color: #9ca3af; background-color: #f9fafb; border-top: 1px solid #f3f4f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Rescatto</h1></div>
            <div class="content">
              <h2>¡Hola! 👋</h2>
              <p>Gracias por unirte a la comunidad de Rescatto. Para completar tu registro y asegurar tu cuenta, por favor haz clic en el botón de abajo:</p>
              <a href="${link}" class="button">Verificar mi cuenta ahora</a>
              <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
            </div>
            <div class="footer"><p><strong>© 2024 Rescatto Business</strong></p></div>
          </div>
        </body>
        </html>`;

            await sgMail.send({
                to: email,
                from: CONFIG.sendgrid.from,
                subject: "Verifica tu cuenta en Rescatto 🥗",
                html: htmlContent,
            });
            console.log(`Verification email sent to ${email} via SendGrid`);
            return { success: true };

        } catch (error) {
            console.error("Error sending verification email:", error);
            throw new HttpsError("internal", error.message);
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// deleteUserAccount
// Deletes a user from Firebase Auth. Only callable by Super Admins.
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteUserAccount = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const db = admin.firestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== "SUPER_ADMIN") {
        throw new HttpsError("permission-denied", "Only Super Admins can delete accounts.");
    }

    const { uid } = request.data || {};
    if (!uid || typeof uid !== "string") throw new HttpsError("invalid-argument", "UID is required.");

    try {
        await admin.auth().deleteUser(uid);
        console.log(`Successfully deleted user ${uid} from Auth`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting user ${uid} from Auth:`, error);
        throw new HttpsError("internal", error.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// applyDynamicPricing — every 15 minutes
// Adjusts dynamicDiscountedPrice based on time remaining until availableUntil.
// ─────────────────────────────────────────────────────────────────────────────
exports.applyDynamicPricing = onSchedule("every 15 minutes", async () => {
    const db = admin.firestore();
    const now = new Date();

    try {
        const snapshot = await db.collection("products")
            .where("isDynamicPricing", "==", true)
            .where("quantity", ">", 0)
            .get();

        if (snapshot.empty) {
            console.log("applyDynamicPricing: no dynamic products found.");
            return;
        }

        const TIERS = [
            { maxMinutes: 30, multiplier: 0.60, label: "⬇️ -40% últimos 30 min" },
            { maxMinutes: 60, multiplier: 0.70, label: "⬇️ -30% último 1h" },
            { maxMinutes: 120, multiplier: 0.80, label: "⬇️ -20% últimas 2h" },
            { maxMinutes: 240, multiplier: 0.90, label: "⬇️ -10% últimas 4h" },
        ];

        const batch = db.batch();
        let updatedCount = 0;

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const availableUntil = data.availableUntil ? new Date(data.availableUntil) : null;
            if (!availableUntil || availableUntil <= now) return;

            const minutesLeft = (availableUntil.getTime() - now.getTime()) / 60000;
            const tier = TIERS.find(t => minutesLeft <= t.maxMinutes);

            if (tier) {
                batch.update(docSnap.ref, {
                    dynamicDiscountedPrice: Math.round(data.discountedPrice * tier.multiplier),
                    dynamicTier: tier.label,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                updatedCount++;
            } else if (data.dynamicDiscountedPrice) {
                // More than 4h left — reset to base price
                batch.update(docSnap.ref, {
                    dynamicDiscountedPrice: admin.firestore.FieldValue.delete(),
                    dynamicTier: admin.firestore.FieldValue.delete(),
                });
                updatedCount++;
            }
        });

        await batch.commit();
        console.log(`applyDynamicPricing: updated ${updatedCount} products.`);
    } catch (error) {
        console.error("applyDynamicPricing error:", error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// deactivateExpiredProducts — every 60 minutes
// Sets quantity=0 for products past their availableUntil date.
// ─────────────────────────────────────────────────────────────────────────────
exports.deactivateExpiredProducts = onSchedule("every 60 minutes", async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
        const snapshot = await db.collection("products")
            .where("availableUntil", "<", now.toDate().toISOString())
            .where("quantity", ">", 0)
            .get();

        if (snapshot.empty) {
            console.log("deactivateExpiredProducts: no expired products found.");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                quantity: 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        console.log(`deactivateExpiredProducts: set quantity=0 for ${snapshot.size} expired product(s).`);
    } catch (error) {
        console.error("deactivateExpiredProducts error:", error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// handleMissedPickups — every 10 minutes
// Marks READY_PICKUP orders past their pickupDeadline as MISSED.
// ─────────────────────────────────────────────────────────────────────────────
exports.handleMissedPickups = onSchedule("every 10 minutes", async () => {
    const db = admin.firestore();
    const now = new Date();

    try {
        const snapshot = await db.collection("orders")
            .where("status", "==", "READY_PICKUP")
            .where("pickupDeadline", "<", now.toISOString())
            .get();

        if (snapshot.empty) {
            console.log("handleMissedPickups: no missed pickups found.");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                status: "MISSED",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        console.log(`handleMissedPickups: marked ${snapshot.size} order(s) as MISSED.`);
    } catch (error) {
        console.error("handleMissedPickups error:", error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// notifyBeforePickup — every 5 minutes
// Sends push notification when order is within 30 minutes of expiry.
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyBeforePickup = onSchedule("every 5 minutes", async () => {
    const db = admin.firestore();
    const now = new Date();
    const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000);

    try {
        const snapshot = await db.collection("orders")
            .where("status", "in", ["PAID", "READY_PICKUP"])
            .where("pickupDeadline", "<=", thirtyMinsFromNow.toISOString())
            .where("pickupDeadline", ">", now.toISOString())
            .get();

        if (snapshot.empty) {
            console.log("notifyBeforePickup: no upcoming expiring orders found.");
            return;
        }

        let notifiedCount = 0;
        const batch = db.batch();
        let batchHasUpdates = false;

        for (const docSnap of snapshot.docs) {
            const orderData = docSnap.data();
            if (orderData.notifiedExpiring) continue;

            if (orderData.customerId) {
                try {
                    const userDoc = await db.collection("users").doc(orderData.customerId).get();
                    if (userDoc.exists && userDoc.data().fcmToken) {
                        let venueName = "el restaurante";
                        if (orderData.venueId) {
                            const venueDoc = await db.collection("venues").doc(orderData.venueId).get();
                            if (venueDoc.exists) venueName = venueDoc.data().name || venueName;
                        }

                        await admin.messaging().send({
                            notification: {
                                title: "⚠️ ¡Tu rescate está por expirar!",
                                body: `Te quedan menos de 30 minutos para recoger tu pedido en ${venueName}. ¡No lo dejes perder!`,
                            },
                            token: userDoc.data().fcmToken,
                            webpush: {
                                fcmOptions: { link: `/#/app/orders?highlight=${docSnap.id}` },
                                notification: { icon: "/pwa-192x192.png", badge: "/pwa-192x192.png" },
                            },
                            data: { orderId: docSnap.id, click_action: "OPEN_ORDER" },
                        });
                        notifiedCount++;
                    }
                } catch (fcmErr) {
                    console.error(`Error sending expiry notification for order ${docSnap.id}:`, fcmErr);
                }
            }

            // Mark as notified regardless of FCM success to avoid repeated attempts
            batch.update(docSnap.ref, { notifiedExpiring: true });
            batchHasUpdates = true;
        }

        if (batchHasUpdates) {
            await batch.commit();
        }
        if (notifiedCount > 0) {
            console.log(`notifyBeforePickup: sent warning notifications to ${notifiedCount} user(s).`);
        }
    } catch (error) {
        console.error("notifyBeforePickup error:", error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// aggregateAdminStats
// Firestore trigger: increments global and per-venue counters on COMPLETED orders.
// ─────────────────────────────────────────────────────────────────────────────
exports.aggregateAdminStats = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();

    if (previousValue.status === "COMPLETED" || newValue.status !== "COMPLETED") return;

    const db = admin.firestore();
    const totalAmount = newValue.totalAmount || 0;
    const venueId = newValue.venueId;
    const co2Base = newValue.estimatedCo2 !== undefined
        ? newValue.estimatedCo2
        : (newValue.co2Saved !== undefined ? newValue.co2Saved : 0.5);
    const co2Saved = Number(co2Base) || 0.5;

    const globalRef = db.collection("stats").doc("global");
    const venueRef = venueId ? db.collection("stats_venues").doc(venueId) : null;

    const batch = db.batch();
    batch.set(globalRef, {
        totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
        totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
        totalCO2Saved: admin.firestore.FieldValue.increment(co2Saved),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (venueRef) {
        batch.set(venueRef, {
            totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
            totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
            totalCO2Saved: admin.firestore.FieldValue.increment(co2Saved),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    try {
        await batch.commit();
        console.log(`Successfully aggregated stats for order ${event.params.orderId}`);
    } catch (error) {
        console.error(`Error aggregating stats for order ${event.params.orderId}:`, error);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// migrateVenueIdToVenueIds
// One-time callable admin function. Idempotent — safe to run multiple times.
// ─────────────────────────────────────────────────────────────────────────────
exports.migrateVenueIdToVenueIds = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const db = admin.firestore();
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!callerDoc.exists) throw new HttpsError("permission-denied", "Caller not found.");

    const callerRole = callerDoc.data().role;
    if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
        throw new HttpsError("permission-denied", "Only admins can run migrations.");
    }

    const snapshot = await db.collection("users").get();
    const batch = db.batch();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const userDoc of snapshot.docs) {
        const data = userDoc.data();
        const hasVenueId = typeof data.venueId === "string" && data.venueId.length > 0;
        const hasVenueIds = Array.isArray(data.venueIds) && data.venueIds.length > 0;

        if (hasVenueId && !hasVenueIds) {
            batch.update(userDoc.ref, { venueIds: [data.venueId] });
            migratedCount++;
            console.log(`Migrating user ${userDoc.id}: venueId=${data.venueId} → venueIds=[${data.venueId}]`);
        } else if (hasVenueId && hasVenueIds && !data.venueIds.includes(data.venueId)) {
            batch.update(userDoc.ref, { venueIds: admin.firestore.FieldValue.arrayUnion(data.venueId) });
            migratedCount++;
            console.log(`Adding missing venueId to venueIds for user ${userDoc.id}`);
        } else {
            skippedCount++;
        }
    }

    if (migratedCount > 0) await batch.commit();

    const result = { migrated: migratedCount, skipped: skippedCount, total: snapshot.size };
    console.log("migrateVenueIdToVenueIds complete:", result);
    return result;
});

// ─────────────────────────────────────────────────────────────────────────────
// getFinanceStats
// Returns aggregated platform finance stats. Only callable by SUPER_ADMIN.
// ─────────────────────────────────────────────────────────────────────────────
exports.getFinanceStats = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Autenticación requerida.");
    }

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "SUPER_ADMIN") {
        throw new HttpsError("permission-denied", "Solo el Super Admin puede acceder a las estadísticas globales.");
    }

    const data = request.data || {};
    const { startDate, endDate } = data;

    let ordersQuery = db.collection("orders").where("status", "in", ["COMPLETED", "PAID"]);
    if (startDate) ordersQuery = ordersQuery.where("createdAt", ">=", startDate);
    if (endDate) ordersQuery = ordersQuery.where("createdAt", "<=", endDate);

    const snapshot = await ordersQuery.get();

    let totalRevenue = 0;
    let totalPlatformFee = 0;
    let totalVenueEarnings = 0;
    let totalOrders = 0;
    const venueBreakdown = {};

    snapshot.forEach(doc => {
        const order = doc.data();
        const subtotal = Number(order.subtotal) || 0;
        const platformFee = Number(order.platformFee) || subtotal * 0.10;
        const venueEarnings = Number(order.venueEarnings) || subtotal * 0.90;

        totalRevenue += subtotal;
        totalPlatformFee += platformFee;
        totalVenueEarnings += venueEarnings;
        totalOrders++;

        const vId = order.venueId || "unknown";
        if (!venueBreakdown[vId]) {
            venueBreakdown[vId] = { venueId: vId, revenue: 0, orders: 0, platformFee: 0 };
        }
        venueBreakdown[vId].revenue += subtotal;
        venueBreakdown[vId].orders++;
        venueBreakdown[vId].platformFee += platformFee;
    });

    const topVenues = Object.values(venueBreakdown)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    return {
        totalRevenue,
        totalPlatformFee,
        totalVenueEarnings,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topVenues,
        periodStart: startDate || null,
        periodEnd: endDate || null,
    };
});
