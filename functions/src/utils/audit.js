"use strict";

const { db, admin } = require("../admin");

/**
 * Generic audit log helper.
 */
async function writeAuditLog({ action, performedBy, targetId, targetType, metadata }) {
    try {
        await db.collection("audit_logs").add({
            action,
            performedBy,
            targetId: targetId || null,
            targetType: targetType || null,
            metadata: metadata || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        // Silently fail audit logs to avoid breaking core flows, but log it
        console.error("Failed to write audit log:", err);
    }
}

module.exports = { writeAuditLog };
