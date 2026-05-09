"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { checkRateLimit } = require("./rateLimit");
const { IS_PROD } = require("./config");
const { log, warn } = require("./logger");

/**
 * Security Bunker: applies multiple layers of protection to a request.
 * 
 * @param {string} fnName - Name of the function for logging and rate limiting.
 * @param {import("firebase-functions/v2/https").CallableRequest} request - The callable request object.
 * @param {Object} options - Security options.
 * @param {boolean} options.enforceAppCheck - Whether to require a valid App Check token.
 * @param {number} options.maxReqs - Max requests for rate limiting.
 * @param {number} options.windowMs - Time window for rate limiting.
 * @param {number} options.maxPayloadKb - Max allowed payload size in KB.
 */
async function validateSecurityBunker(fnName, request, options = {}) {
    const {
        enforceAppCheck = IS_PROD,
        maxReqs = 20,
        windowMs = 60000,
        maxPayloadKb = 50,
        requiredRoles = [], // [] = everyone authenticated
    } = options;

    const uid = request.auth?.uid || "anonymous";

    // 1. Authentication (All bunker functions require Auth)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debes estar autenticado para acceder al búnker.");
    }

    // 2. Role Validation (Claim-based)
    if (requiredRoles.length > 0) {
        const userRole = request.auth.token.role;
        if (!requiredRoles.includes(userRole)) {
            warn(`[SecurityBunker] Role denied for ${fnName}`, { uid, userRole, requiredRoles });
            throw new HttpsError(
                "permission-denied",
                `No tienes los permisos necesarios (${requiredRoles.join(", ")}).`
            );
        }
    }

    // 1. App Check Enforcement
    // request.app will be undefined if App Check token is missing or invalid.
    // [Bunker] Bypass for SUPER_ADMIN to allow development/debugging.
    const isSuperAdmin = request.auth.token.role === "SUPER_ADMIN";
    if (enforceAppCheck && !request.app && !isSuperAdmin) {
        warn(`[SecurityBunker] App Check failed for ${fnName}`, { uid });
        throw new HttpsError(
            "failed-precondition",
            "La solicitud no proviene de una aplicación autorizada (App Check)."
        );
    }

    // 2. Payload Size Check
    const payloadSize = JSON.stringify(request.data || {}).length;
    if (payloadSize > maxPayloadKb * 1024) {
        warn(`[SecurityBunker] Payload too large for ${fnName}`, { uid, payloadSize });
        throw new HttpsError(
            "invalid-argument",
            `El contenido de la solicitud excede el límite de ${maxPayloadKb}KB.`
        );
    }

    // 3. Rate Limiting (per user/IP)
    const rateLimitKey = `${uid}:${fnName}`;
    const isAllowed = await checkRateLimit(rateLimitKey, maxReqs, windowMs);
    if (!isAllowed) {
        warn(`[SecurityBunker] Rate limit exceeded for ${fnName}`, { uid });
        throw new HttpsError(
            "resource-exhausted",
            "Has realizado demasiadas solicitudes. Intenta de nuevo en un momento."
        );
    }

    log(`[SecurityBunker] Validation passed for ${fnName}`, { uid });
    return true;
}

module.exports = { validateSecurityBunker };