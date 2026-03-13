"use strict";

const { db } = require("../admin");

/**
 * Sliding-window rate limiter using Firestore.
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
    const windowStart = now - windowMs;

    return db.runTransaction(async (t) => {
        const snap = await t.get(rateLimitRef);
        const existing = snap.exists ? (snap.data().requests || []) : [];
        const recent = existing.filter(ts => ts > windowStart);
        if (recent.length >= maxReqs) return false;
        recent.push(now);
        t.set(rateLimitRef, { requests: recent, lastUpdated: now });
        return true;
    });
}

module.exports = { checkRateLimit };
