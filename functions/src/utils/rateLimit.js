"use strict";

const { db, admin } = require("../admin");

/**
 * Counter-based sliding window rate limiter.
 * Resets counter when window expires. Atomic via Firestore transaction.
 *
 * @param {string} key     - Unique key (e.g. `${uid}:createOrder`)
 * @param {number} maxReqs - Max allowed requests in the window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {Promise<boolean>} true = allowed, false = rate-limit exceeded
 */
async function checkRateLimit(key, maxReqs, windowMs) {
    const docId = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 200);
    const rateLimitRef = db.collection("rate_limits").doc(docId);
    const now = Date.now();

    return db.runTransaction(async (t) => {
        const snap = await t.get(rateLimitRef);
        const data = snap.exists ? snap.data() : null;

        if (!data || (now - (data.windowStart || 0)) > windowMs) {
            t.set(rateLimitRef, { count: 1, windowStart: now, lastUpdated: now });
            return true;
        }

        if (data.count >= maxReqs) {
            return false;
        }

        t.update(rateLimitRef, {
            count: admin.firestore.FieldValue.increment(1),
            lastUpdated: now,
        });
        return true;
    });
}

module.exports = { checkRateLimit };
