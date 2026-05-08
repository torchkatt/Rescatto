"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { error: logError } = require("./logger");
const { generateCorrelationId } = require("./correlationId");
const { validateSecurityBunker } = require("./security");

/**
 * Wraps an onCall handler with consistent error handling and correlation ID injection.
 */
function withErrorHandling(fnName, handler) {
    return async (request) => {
        const correlationId = generateCorrelationId();
        try {
            return await handler(request, correlationId);
        } catch (err) {
            if (err instanceof HttpsError) {
                throw err;
            }
            logError(`[${fnName}] Unhandled error`, {
                correlationId,
                message: err.message,
                stack: err.stack,
                userId: request.auth?.uid || "anonymous",
            });
            throw new HttpsError("internal", "Ha ocurrido un error inesperado. Intenta de nuevo.");
        }
    };
}

/**
 * El wrapper definitivo: combina Seguridad de Búnker + Manejo de Errores.
 * Úsalo para todas las funciones Cloud públicas.
 */
function withSecurityBunker(fnName, handler, options = {}) {
    return async (request) => {
        const correlationId = generateCorrelationId();
        try {
            // 1. Capa de Seguridad (App Check, Rate Limit, Payload)
            await validateSecurityBunker(fnName, request, options);

            // 2. Ejecución del Handler
            return await handler(request, correlationId);
        } catch (err) {
            if (err instanceof HttpsError) {
                throw err;
            }
            logError(`[${fnName}] Bunker Error`, {
                correlationId,
                message: err.message,
                stack: err.stack,
                userId: request.auth?.uid || "anonymous",
            });
            throw new HttpsError("internal", "Error de seguridad o servidor. Intenta de nuevo.");
        }
    };
}

/**
 * Wraps an onRequest handler with consistent error handling and correlation ID.
 */
function withRequestErrorHandling(fnName, handler) {
    return async (req, res) => {
        const correlationId = req.headers["x-correlation-id"] || generateCorrelationId();
        res.setHeader("x-correlation-id", correlationId);
        try {
            return await handler(req, res, correlationId);
        } catch (err) {
            logError(`[${fnName}] Unhandled error`, {
                correlationId,
                message: err.message,
                stack: err.stack,
                method: req.method,
                path: req.path,
            });
            return res.status(500).json({ error: "Internal Server Error", correlationId });
        }
    };
}

module.exports = { withErrorHandling, withRequestErrorHandling, withSecurityBunker };
