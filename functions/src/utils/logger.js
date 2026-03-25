"use strict";

/**
 * Structured JSON logger for Cloud Functions.
 * Wraps firebase-functions/logger to add consistent fields:
 * timestamp, severity level, and any extra context data.
 * Compatible with GCP Log Explorer structured log format.
 */
const fbLogger = require("firebase-functions/logger");

function buildEntry(level, msg, data) {
    return {
        severity: level,
        message: msg,
        timestamp: new Date().toISOString(),
        ...(data && typeof data === "object" ? data : {}),
    };
}

const log = (msg, data) => fbLogger.log(buildEntry("INFO", msg, data));
const warn = (msg, data) => fbLogger.warn(buildEntry("WARNING", msg, data));
const error = (msg, data) => fbLogger.error(buildEntry("ERROR", msg, data));
const debug = (msg, data) => {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        fbLogger.log(buildEntry("DEBUG", msg, data));
    }
};

module.exports = { log, warn, error, debug };
