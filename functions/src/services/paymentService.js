"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withRequestErrorHandling } = require("../utils/errorHandler");
const { GenerateWompiSignatureSchema, WompiWebhookSchema } = require("../schemas");
const { log, error: logError, warn: logWarn } = require("../utils/logger");
const { IS_PROD, ALLOWED_ORIGINS } = require("../utils/config");
const { writeAuditLog } = require("../utils/audit");
const crypto = require("crypto-js");
const cryptoNode = require("crypto");

/**
 * Generates an integrity signature for Wompi payments.
 */
const generateWompiSignature = onRequest(
    {
        cors: ALLOWED_ORIGINS,
        secrets: ["WOMPI_INTEGRITY_SECRET", "WOMPI_PUBLIC_KEY"],
        timeoutSeconds: 15,
        memory: "128MiB"
    },
    withRequestErrorHandling("generateWompiSignature", async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Method Not Allowed" });
        }

        const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
        const ipAllowed = await checkRateLimit(`ip:wompiSig:${ip}`, 20, 60 * 1000);
        if (!ipAllowed) {
            return res.status(429).send({ error: "Too many requests. Please try again later." });
        }

        const sigParsed = GenerateWompiSignatureSchema.safeParse(req.body);
        if (!sigParsed.success) {
            return res.status(400).send({ error: sigParsed.error.issues[0]?.message || "Invalid input." });
        }
        const { reference, amount, currency } = sigParsed.data;

        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || (IS_PROD ? null : "test_integrity_secret_PLACEHOLDER");
        const publicKey = process.env.WOMPI_PUBLIC_KEY || (IS_PROD ? null : "test_public_key_PLACEHOLDER");

        if (!integritySecret) {
            logError("FATAL: WOMPI_INTEGRITY_SECRET not set in production.");
            return res.status(500).send({ error: "Payment configuration error." });
        }

        const amountInCents = Math.round(amount * 100);
        const signatureString = `${reference}${amountInCents}${currency}${integritySecret}`;
        const signature = crypto.SHA256(signatureString).toString(crypto.enc.Hex).toUpperCase();

        return res.status(200).send({ signature, reference, amountInCents, currency, publicKey });
    })
);

/**
 * Receives Wompi payment events and validates integrity.
 */
const wompiWebhook = onRequest(
    {
        cors: ALLOWED_ORIGINS,
        secrets: ["WOMPI_INTEGRITY_SECRET"],
        timeoutSeconds: 30,
        memory: "256MiB"
    },
    withRequestErrorHandling("wompiWebhook", async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).send({ error: "Method Not Allowed" });
        }

        const wompiSignature = req.headers["x-wompi-signature"];
        const wompiTimestamp = req.headers["x-wompi-timestamp"];

        if (!wompiSignature || !wompiTimestamp) {
            logWarn("Wompi webhook: missing signature headers");
            return res.status(400).send({ error: "Missing signature headers" });
        }

        const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || (IS_PROD ? null : "test_integrity_secret_PLACEHOLDER");
        if (!integritySecret) {
            logError("FATAL: WOMPI_INTEGRITY_SECRET not set.");
            return res.status(500).send({ error: "Configuration error." });
        }

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
            logWarn("Wompi webhook: INVALID signature — rejecting event");
            return res.status(401).send({ error: "Invalid signature" });
        }

        const webhookParsed = WompiWebhookSchema.safeParse(req.body);
        if (!webhookParsed.success) {
            return res.status(200).send({ received: true });
        }
        const event = webhookParsed.data;
        const eventType = event.event;
        const transactionData = event.data.transaction;

        log("Wompi webhook: Procesando evento", {
            eventType,
            transactionId: transactionData.id,
            status: transactionData.status,
            reference: transactionData.reference || null,
            amount: transactionData.amount_in_cents || null,
        });

        // Idempotency guard
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
            log("Wompi webhook: Evento ya procesado (duplicado)", { transactionId: transactionData.id, idempotencyKey });
            return res.status(200).send({ received: true, duplicate: true });
        }

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

                log(`Order ${orderDoc.id} APPROVED webhook → ${txResult.updated ? "PAID" : "skipped (" + txResult.reason + ")"}`);
                if (txResult.updated) {
                    await writeAuditLog({
                        action: "payment_approved",
                        performedBy: "wompi_webhook",
                        targetId: orderDoc.id,
                        targetType: "order",
                        metadata: { transactionId: transactionData.id, status: transactionData.status },
                    });
                }
            } else {
                logError(`Wompi webhook: order not found for transaction ${transactionData.id}`);
                await db.collection("webhook_errors").doc().set({
                    service: "wompi", eventType, transactionId: transactionData.id,
                    reason: "order not found",
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }

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
                log(`Order ${q.docs[0].id} FAILED webhook → ${txResult.updated ? "CANCELLED" : "skipped (" + txResult.reason + ")"}`);
            }
        }

        return res.status(200).send({ received: true });
    })
);

module.exports = {
    generateWompiSignature,
    wompiWebhook
};
