"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require("../admin");
const { log, warn, error: logError } = require("../utils/logger");

const VERSION = "2.0.0";

/**
 * Public HTTP endpoint for uptime monitoring (e.g. UptimeRobot, BetterUptime).
 * Returns 200 with a structured payload when all critical services respond.
 * Returns 503 if Firestore or Auth are unreachable.
 */
const healthCheck = onRequest({ cors: true }, async (_req, res) => {
    const checks = {};
    let allHealthy = true;

    // Firestore
    try {
        await db.collection("health").limit(1).get();
        checks.firestore = "ok";
    } catch (err) {
        checks.firestore = `error: ${err.message}`;
        allHealthy = false;
    }

    // Auth (list 1 user — lightweight)
    try {
        await admin.auth().listUsers(1);
        checks.auth = "ok";
    } catch (err) {
        checks.auth = `error: ${err.message}`;
        allHealthy = false;
    }

    const status = allHealthy ? "ok" : "degraded";
    const code = allHealthy ? 200 : 503;

    return res.status(code).json({
        status,
        version: VERSION,
        timestamp: new Date().toISOString(),
        checks,
    });
});

/**
 * Scheduled health probe — runs every 10 minutes and writes a heartbeat
 * to Firestore. If any check fails, it writes a HEALTH_ALERT event that
 * can trigger a Firestore alert / monitoring rule.
 */
const scheduledHealthCheck = onSchedule(
    { schedule: "every 10 minutes", retryCount: 0 },
    async () => {
        const checks = {};
        let allHealthy = true;

        // Firestore write round-trip
        try {
            const ref = db.collection("health").doc("probe");
            await ref.set({ lastProbe: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            checks.firestore = "ok";
        } catch (err) {
            checks.firestore = `error: ${err.message}`;
            allHealthy = false;
        }

        // Verify at least one active venue exists (basic data-layer sanity)
        try {
            const snap = await db.collection("venues").where("isActive", "==", true).limit(1).get();
            checks.venueData = snap.empty ? "warn:no_active_venues" : "ok";
            if (snap.empty) warn("scheduledHealthCheck: no active venues found");
        } catch (err) {
            checks.venueData = `error: ${err.message}`;
            allHealthy = false;
        }

        if (allHealthy) {
            log("scheduledHealthCheck: all systems nominal", { checks });
        } else {
            logError("scheduledHealthCheck: degraded state detected", { checks });
            // Write an alert event for monitoring dashboards / Firestore alerts
            await db.collection("system_events").add({
                type: "HEALTH_ALERT",
                checks,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(() => {});
        }
    }
);

module.exports = { healthCheck, scheduledHealthCheck };
