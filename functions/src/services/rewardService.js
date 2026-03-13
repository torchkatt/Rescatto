"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling } = require("../utils/errorHandler");
const { RedeemPointsSchema } = require("../schemas");
const { writeAuditLog } = require("../utils/audit");

const REWARD_CONFIG = {
    "discount_5k": { cost: 50, discountAmount: 5000, label: "5.000 COP de descuento" },
    "discount_10k": { cost: 90, discountAmount: 10000, label: "10.000 COP de descuento" },
    "free_pack": { cost: 150, discountAmount: 15000, label: "Pack Sorpresa Gratis (hasta $15.000 COP)" },
    "donation_meal": { cost: 100, discountAmount: 0, label: "Donación de comida" },
    "free_shipping": { cost: 50, discountAmount: 5000, label: "Envío Gratis (equivalente 5.000 COP)" },
    "discount_10": { cost: 150, discountAmount: 10000, label: "10% Descuento Extra (tope 10.000 COP)" },
};

/**
 * Redeems points for a reward.
 */
const redeemPoints = onCall(withErrorHandling("redeemPoints", async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");

    const userId = request.auth.uid;
    const allowed = await checkRateLimit(`${userId}:redeemPoints`, 3, 60 * 60 * 1000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Too many attempts.");

    const redeemParsed = RedeemPointsSchema.safeParse(request.data || {});
    if (!redeemParsed.success) throw new HttpsError("invalid-argument", "Invalid input.");

    const { rewardId } = redeemParsed.data;
    const rewardConfig = REWARD_CONFIG[rewardId];
    if (!rewardConfig) throw new HttpsError("invalid-argument", "Invalid reward.");

    const cost = rewardConfig.cost;
    const userRef = db.collection("users").doc(userId);

    const result = await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");

        const userData = userDoc.data();
        const currentPoints = Math.max(0, Number(userData.impact?.points || 0));
        if (currentPoints < cost) throw new HttpsError("failed-precondition", "Insufficient points.");

        const redemptionId = `redeem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const activeRedemption = {
            id: redemptionId, rewardId, discountAmount: rewardConfig.discountAmount,
            label: rewardConfig.label, expiresAt, usedAt: null,
        };

        transaction.update(userRef, {
            "impact.points": admin.firestore.FieldValue.increment(-cost),
            "redemptions": admin.firestore.FieldValue.arrayUnion(activeRedemption),
            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.set(db.collection("redemptions").doc(redemptionId), {
            id: redemptionId, userId, rewardId, cost,
            discountAmount: rewardConfig.discountAmount, label: rewardConfig.label,
            status: "PENDING", expiresAt, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, newBalance: currentPoints - cost, redemption: activeRedemption };
    });

    await writeAuditLog({
        action: "points_redeemed", performedBy: userId, targetId: rewardId, targetType: "reward",
        metadata: { cost, rewardId },
    });

    return result;
}));

module.exports = { redeemPoints };
