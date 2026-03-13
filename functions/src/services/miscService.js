"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { admin } = require("../admin");

/**
 * Public endpoint for uptime monitoring.
 */
const healthCheck = onRequest({ cors: true }, async (_req, res) => {
    try {
        const db = admin.firestore();
        await db.collection("health").limit(1).get();
        return res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            version: "2.0.0 (modular)",
        });
    } catch (err) {
        return res.status(500).json({ status: "error", error: err.message });
    }
});

module.exports = { healthCheck };
