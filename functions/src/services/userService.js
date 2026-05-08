"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { db, admin } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling, withSecurityBunker } = require("../utils/errorHandler");

const { DeleteUserAccountSchema } = require("../schemas");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { log, error: logError } = require("../utils/logger");

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

    const countSnap = await db.collection("users")
        .where("referredBy", "==", referralCode)
        .count()
        .get();

    return {
        count: countSnap.data().count,
        referralCode
    };
}));

/**
 * Actualiza la ubicación en tiempo real de un driver.
 * Protegida por Búnker: Solo accesible para DRIVER.
 */
const updateDriverLocation = onCall(withSecurityBunker("updateDriverLocation", async (request) => {
    const { lat, lng } = request.data || {};
    
    if (typeof lat !== "number" || typeof lng !== "number") {
        throw new HttpsError("invalid-argument", "Latitud y Longitud deben ser números.");
    }

    // Validar rango de coordenadas
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new HttpsError("invalid-argument", "Coordenadas fuera de rango.");
    }

    const userId = request.auth.uid;
    const userRole = request.auth.token.role;

    if (userRole !== "DRIVER") {
        throw new HttpsError("permission-denied", "Solo los drivers pueden actualizar su ubicación.");
    }

    const userRef = db.collection("users").doc(userId);
    
    await userRef.update({
        lastLocation: new admin.firestore.GeoPoint(lat, lng),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
}, { requiredRoles: ["DRIVER"] }));

// ─── Custom Claims (Bunker Security) ──────────────────────────────────────────

/**
 * Sincroniza los Custom Claims de un usuario basándose en su perfil de Firestore.
 * Esto es el corazón del Búnker: los permisos viven en el token JWT.
 */
async function syncUserClaims(userId) {
    if (!userId) return;
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            // Si el perfil no existe, limpiamos los claims
            await admin.auth().setCustomUserClaims(userId, null);
            return;
        }

        const data = userDoc.data();
        const role = data.role || "CUSTOMER";
        const venueIds = normalizeVenueIds(data);
        
        // Estructura de claims compacta para no exceder el límite de 1KB
        const claims = {
            role,
            v: venueIds.length > 0 ? venueIds.slice(0, 5) : [], // v = venues (limitado a 5 por tamaño)
            isBunker: true, // Flag para indicar que el token pasó por el búnker
        };

        if (isAdminRole(role)) claims.isAdmin = true;

        await admin.auth().setCustomUserClaims(userId, claims);

        // Notificar al frontend para refresco silencioso (getIdToken(true))
        await db.collection("users").doc(userId).update({
            claimsVersion: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        log(`[SecurityBunker] Claims sincronizados para ${userId}`, { role });
    } catch (e) {
        logError(`[SecurityBunker] Error sincronizando claims para ${userId}`, e);
    }
}

/**
 * Trigger: Cuando el perfil de un usuario cambia, sincronizamos sus claims.
 */
const onUserUpdated = onDocumentUpdated("users/{userId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    
    // Solo resincronizar si cambió el rol o los venues asociados
    const roleChanged = newData.role !== oldData.role;
    const venuesChanged = JSON.stringify(normalizeVenueIds(newData)) !== JSON.stringify(normalizeVenueIds(oldData));

    if (roleChanged || venuesChanged) {
        await syncUserClaims(event.params.userId);
    }
});

/**
 * Trigger: Cuando se crea un usuario, sincronizamos sus claims iniciales.
 */
const onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
    await syncUserClaims(event.params.userId);
});

module.exports = {
    ensureReferralCode,
    deleteUserAccount,
    getReferralStats,
    updateDriverLocation,
    normalizeVenueIds,
    isAdminRole,
    createUniqueReferralCode,
    syncUserClaims,
    onUserUpdated,
    onUserCreated
};
