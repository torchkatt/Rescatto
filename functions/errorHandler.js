"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { error: logError } = require("firebase-functions/logger");

/**
 * Wraps an onCall handler with consistent error handling.
 * - Logs errors with structured context
 * - Converts unknown errors to HttpsError("internal", generic message)
 * - Passes through HttpsError instances unchanged
 *
 * @param {string} fnName - Function name for logging
 * @param {Function} handler - async (request) => result
 * @returns {Function} Wrapped handler
 */
function withErrorHandling(fnName, handler) {
    return async (request) => {
        try {
            return await handler(request);
        } catch (err) {
            if (err instanceof HttpsError) {
                throw err;
            }
            logError(`[${fnName}] Unhandled error`, {
                message: err.message,
                stack: err.stack,
                userId: request.auth?.uid || "anonymous",
            });
            throw new HttpsError("internal", "Ha ocurrido un error inesperado. Intenta de nuevo.");
        }
    };
}

/**
 * Wraps an onRequest handler with consistent error handling.
 *
 * @param {string} fnName - Function name for logging
 * @param {Function} handler - async (req, res) => void
 * @returns {Function} Wrapped handler
 */
function withRequestErrorHandling(fnName, handler) {
    return async (req, res) => {
        try {
            return await handler(req, res);
        } catch (err) {
            logError(`[${fnName}] Unhandled error`, {
                message: err.message,
                stack: err.stack,
                method: req.method,
                path: req.path,
            });
            return res.status(500).json({ error: "Internal Server Error" });
        }
    };
}

module.exports = { withErrorHandling, withRequestErrorHandling };
