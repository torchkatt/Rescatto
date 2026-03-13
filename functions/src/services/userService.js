"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { db, admin } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling } = require("../utils/errorHandler");
const { DeleteUserAccountSchema } = require("../schemas");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function createUniqueReferralCode(maxAttempts = 10) {
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

// ─── Cloud Functions Logic ───────────────────────────────────────────────

/**
 * ensures a user has a referral code.
 */
const ensureReferralCode = onCall(withErrorHandling("ensureReferralCode", async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const allowed = await checkRateLimit(`${userId}:ensureReferralCode`, 8, 60 * 1000);
    if (!allowed) throw new HttpsError("resource-exhausted", "Too many requests.");

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");

    const userData = userSnap.data() || {};
    if (typeof userData.referralCode === "string" && userData.referralCode.trim().length >= 6) {
        return { referralCode: userData.referralCode.trim(), created: false };
    }

    const referralCode = await createUniqueReferralCode();
    await userRef.set({
        referralCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { referralCode, created: true };
}));

/**
 * Deletes a user account (Super Admin only).
 */
const deleteUserAccount = onCall(withErrorHandling("deleteUserAccount", async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== "SUPER_ADMIN") {
        throw new HttpsError("permission-denied", "Only Super Admins can delete accounts.");
    }

    const deleteParsed = DeleteUserAccountSchema.safeParse(request.data || {});
    if (!deleteParsed.success) {
        throw new HttpsError("invalid-argument", deleteParsed.error.issues[0]?.message || "UID is required.");
    }
    const { uid } = deleteParsed.data;

    await admin.auth().deleteUser(uid);
    // Note: audit log should be handled by a helper if possible, or here.
    // For now keeping it simple.
    
    return { success: true };
}));

/**
 * Gets referral statistics for the authenticated user.
 */
const getReferralStats = onCall(withErrorHandling("getReferralStats", async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const userId = request.auth.uid;
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
        throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data();
    const referralCode = (userData.referralCode || "").trim();

    if (!referralCode || referralCode.length < 6) {
        return { count: 0, referralCode: "" };
    }

    // Count users invited by this code using Admin SDK (bypasses rules)
    const countSnap = await db.collection("users")
        .where("invitedBy", "==", referralCode)
        .count()
        .get();

    return {
        count: countSnap.data().count,
        referralCode
    };
}));

module.exports = {
    ensureReferralCode,
    deleteUserAccount,
    getReferralStats,
    normalizeVenueIds,
    isAdminRole,
    createUniqueReferralCode
};
