"use strict";

const { randomUUID } = require("crypto");

/**
 * Generates a short correlation ID for tracing a request across logs.
 * Format: 8-char hex prefix of a UUID — short enough to log, unique enough to trace.
 */
function generateCorrelationId() {
    return randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Injects a correlationId into a request object and returns a scoped logger
 * that automatically attaches the ID to every log entry.
 */
function withCorrelation(request) {
    const correlationId = request?.headers?.["x-correlation-id"] || generateCorrelationId();
    return {
        correlationId,
        log: (msg, data = {}) => require("./logger").log(msg, { correlationId, ...data }),
        warn: (msg, data = {}) => require("./logger").warn(msg, { correlationId, ...data }),
        error: (msg, data = {}) => require("./logger").error(msg, { correlationId, ...data }),
    };
}

module.exports = { generateCorrelationId, withCorrelation };
