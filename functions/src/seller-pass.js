"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * createSellerSubscription — Actualiza la suscripción de un seller tras pago Wompi
 */
exports.createSellerSubscription = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const { planId, transactionId } = request.data;
    if (!planId || !transactionId)
        throw new HttpsError("invalid-argument", "planId y transactionId requeridos.");

    // Leer el plan desde Firestore (no hardcoded)
    const planDoc = await db.collection("subscription_plans").doc(planId).get();
    if (!planDoc.exists) throw new HttpsError("not-found", "Plan no encontrado.");
    const plan = planDoc.data();
    if (!plan || !plan.isActive) throw new HttpsError("failed-precondition", "Plan no disponible.");

    const sellerSnap = await db.collection('sellers')
        .where('ownerId', '==', request.auth.uid)
        .limit(1)
        .get();
    if (sellerSnap.empty) throw new HttpsError("not-found", "No tienes un perfil de vendedor.");

    const sellerId = sellerSnap.docs[0].id;
    const now = new Date();
    const expiresAt = new Date(now);
    if (plan.period === 'monthly') expiresAt.setMonth(expiresAt.getMonth() + 1);
    else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await db.collection('sellers').doc(sellerId).update({
        subscription: plan.id,
        subscriptionExpiresAt: expiresAt.toISOString(),
        commissionRate: plan.commissionRate,
        updatedAt: now.toISOString(),
    });

    return { success: true, sellerId, plan: plan.id, expiresAt: expiresAt.toISOString() };
});

/**
 * handleWompiSellerSubscription — Webhook de Wompi para pagos de suscripción
 */
exports.handleWompiSellerSubscription = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const event = req.body;
        if (event.event !== 'transaction.updated' || event.data?.transaction?.status !== 'APPROVED') {
            res.status(200).json({ received: true });
            return;
        }

        const tx = event.data.transaction;
        const reference = tx.reference || '';
        const parts = reference.split('_');
        if (parts.length < 2 || parts[0] !== 'sellerpass') {
            res.status(200).json({ received: true });
            return;
        }

        const planId = parts[1];
        const sellerId = parts.slice(2).join('_') || '';

        // Leer plan desde Firestore
        const planSnap = await db.collection("subscription_plans").doc(planId).get();
        if (!planSnap.exists || !sellerId) {
            res.status(200).json({ received: true });
            return;
        }
        const plan = planSnap.data();

        const now = new Date();
        const expiresAt = new Date(now);
        if (plan.period === 'monthly') expiresAt.setMonth(expiresAt.getMonth() + 1);
        else expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        await db.collection('sellers').doc(sellerId).update({
            subscription: planId,
            subscriptionExpiresAt: expiresAt.toISOString(),
            commissionRate: plan.commissionRate,
            updatedAt: now.toISOString(),
        });

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('handleWompiSellerSubscription error:', error);
        res.status(200).json({ received: true });
    }
});