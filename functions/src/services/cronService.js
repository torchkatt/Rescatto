"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require("../admin");
const { log, error: logError } = require("../utils/logger");

/**
 * Adjusts dynamic pricing based on time left.
 */
const applyDynamicPricing = onSchedule("every 15 minutes", async () => {
    const now = new Date();
    try {
        const snapshot = await db.collection("products")
            .where("isDynamicPricing", "==", true)
            .where("quantity", ">", 0).get();

        if (snapshot.empty) return;

        const TIERS = [
            { maxMinutes: 30, multiplier: 0.60, label: "⬇️ -40% últimos 30 min" },
            { maxMinutes: 60, multiplier: 0.70, label: "⬇️ -30% último 1h" },
            { maxMinutes: 120, multiplier: 0.80, label: "⬇️ -20% últimas 2h" },
            { maxMinutes: 240, multiplier: 0.90, label: "⬇️ -10% últimas 4h" },
        ];

        const batch = db.batch();
        let updated = 0;
        snapshot.docs.forEach(snap => {
            const data = snap.data();
            const availableUntil = data.availableUntil ? new Date(data.availableUntil) : null;
            if (!availableUntil || availableUntil <= now) return;

            const minutesLeft = (availableUntil - now) / 60000;
            const tier = TIERS.find(t => minutesLeft <= t.maxMinutes);

            if (tier) {
                batch.update(snap.ref, {
                    dynamicDiscountedPrice: Math.round(data.discountedPrice * tier.multiplier),
                    dynamicTier: tier.label,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                updated++;
            } else if (data.dynamicDiscountedPrice) {
                batch.update(snap.ref, {
                    dynamicDiscountedPrice: admin.firestore.FieldValue.delete(),
                    dynamicTier: admin.firestore.FieldValue.delete(),
                });
                updated++;
            }
        });
        await batch.commit();
        log(`applyDynamicPricing: updated ${updated} products.`);
    } catch (e) { logError("applyDynamicPricing error", e); }
});

/**
 * Deactivates expired products.
 */
const deactivateExpiredProducts = onSchedule("every 60 minutes", async () => {
    const nowStr = new Date().toISOString();
    try {
        const snapshot = await db.collection("products")
            .where("availableUntil", "<", nowStr)
            .where("quantity", ">", 0).get();

        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.docs.forEach(snap => {
            batch.update(snap.ref, { quantity: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
        log(`deactivateExpiredProducts: deactivated ${snapshot.size} products.`);
    } catch (e) { logError("deactivateExpiredProducts error", e); }
});

/**
 * Marks READY_PICKUP orders past deadline as MISSED.
 */
const handleMissedPickups = onSchedule("every 10 minutes", async () => {
    const nowStr = new Date().toISOString();
    try {
        const snapshot = await db.collection("orders")
            .where("status", "==", "READY_PICKUP")
            .where("pickupDeadline", "<", nowStr).get();

        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.docs.forEach(snap => {
            batch.update(snap.ref, { status: "MISSED", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
        log(`handleMissedPickups: marked ${snapshot.size} orders as MISSED.`);
    } catch (e) { logError("handleMissedPickups error", e); }
});

/**
 * Sends notification 30 mins before pickup deadline.
 */
const notifyBeforePickup = onSchedule("every 5 minutes", async () => {
    const now = new Date();
    const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60000);

    try {
        const snapshot = await db.collection("orders")
            .where("status", "in", ["PAID", "READY_PICKUP"])
            .where("pickupDeadline", "<=", thirtyMinsFromNow.toISOString())
            .where("pickupDeadline", ">", now.toISOString())
            .get();

        if (snapshot.empty) return;

        let notifiedCount = 0;
        const batch = db.batch();

        for (const docSnap of snapshot.docs) {
            const orderData = docSnap.data();
            if (orderData.notifiedExpiring) continue;

            if (orderData.customerId) {
                try {
                    const userDoc = await db.collection("users").doc(orderData.customerId).get();
                    if (userDoc.exists && userDoc.data().fcmToken) {
                        let venueName = (orderData.metadata && orderData.metadata.venueName) || "el restaurante";
                        await admin.messaging().send({
                            notification: {
                                title: "⚠️ ¡Tu rescate está por expirar!",
                                body: `Te quedan menos de 30 minutos para recoger tu pedido en ${venueName}.`,
                            },
                            token: userDoc.data().fcmToken,
                        });
                        notifiedCount++;
                    }
                } catch (e) { logError("Expiry notify error", e); }
            }
            batch.update(docSnap.ref, { notifiedExpiring: true });
        }

        await batch.commit();
        if (notifiedCount > 0) log(`notifyBeforePickup: sent ${notifiedCount} warnings.`);
    } catch (e) { logError("notifyBeforePickup error", e); }
});

/**
 * Resets broken streaks for users who haven't ordered in > 48 hours.
 */
const resetBrokenStreaks = onSchedule("every 24 hours", async () => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    try {
        const snapshot = await db.collection("users")
            .where("streak.current", ">", 0)
            .where("streak.lastOrderDate", "<", fortyEightHoursAgo)
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        snapshot.docs.forEach(snap => {
            batch.update(snap.ref, {
                "streak.current": 0,
                "streak.multiplier": 1.0,
                "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        log(`resetBrokenStreaks: reset ${snapshot.size} users.`);
    } catch (e) { logError("resetBrokenStreaks error", e); }
});

/**
 * Job: Reminds users with active streaks (>2) who haven't ordered today.
 * Runs at 19:00 COT (00:00 UTC).
 */
const sendStreakReminders = onSchedule("0 0 * * *", async () => {
    log("Iniciando sendStreakReminders...");
    const today = new Date().toISOString().split("T")[0];
    
    try {
        const snap = await db.collection("users")
            .where("streak.current", ">=", 3)
            .where("fcmToken", "!=", null)
            .get();
            
        if (snap.empty) return;
        
        const reminders = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.streak.lastOrderDate !== today) {
                reminders.push({
                    token: data.fcmToken,
                    notification: {
                        title: "¡Que no se apague tu racha! 🔥",
                        body: `Llevas ${data.streak.current} días seguidos. ¡Rescata algo hoy para mantenerla!`
                    },
                    data: { type: "streak_reminder" }
                });
            }
        });
        
        if (reminders.length > 0) {
            // Firebase limits multicast to 500
            for (let i = 0; i < reminders.length; i += 500) {
                const chunk = reminders.slice(i, i + 500);
                await admin.messaging().sendEach(chunk);
            }
            log(`Enviados ${reminders.length} recordatorios de racha.`);
        }
    } catch (e) {
        logError("sendStreakReminders Error", e);
    }
});

/**
 * Job: Resets periodic stats (weekly/monthly).
 * Weekly: Runs Sunday midnight. Monthly: Runs 1st day of month.
 */
const resetPeriodicStats = onSchedule("0 0 * * *", async () => {
    const now = new Date();
    const isMonday = now.getUTCDay() === 1; // Resets what happened "last week"
    const isFirstOfMonth = now.getUTCDate() === 1;
    
    if (!isMonday && !isFirstOfMonth) return;
    
    log(`Iniciando resetPeriodicStats... (Monday: ${isMonday}, 1st: ${isFirstOfMonth})`);
    
    try {
        const usersRef = db.collection("users");
        const snap = await usersRef.get();
        
        if (snap.empty) return;
        
        const batchSize = 400;
        let batch = db.batch();
        let count = 0;
        
        for (const doc of snap.docs) {
            const update = {};
            if (isMonday) update["impact.weeklyRescues"] = 0;
            if (isFirstOfMonth) update["impact.monthlyRescues"] = 0;
            
            if (Object.keys(update).length > 0) {
                batch.update(doc.ref, update);
                count++;
            }
            
            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        
        if (count % batchSize !== 0) {
            await batch.commit();
        }
        
        log(`Reseteadas estadísticas para ${count} usuarios.`);
    } catch (e) {
        logError("resetPeriodicStats Error", e);
    }
});

/**
 * Job: Sends re-engagement notifications to inactive users (7 days).
 */
const sendRetentionNotifications = onSchedule("0 10 * * *", async () => {
    log("Iniciando sendRetentionNotifications...");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
        const snap = await db.collection("users")
            .where("fcmToken", "!=", null)
            .where("lastLogin", "<", sevenDaysAgo)
            .limit(1000) // Safety limit
            .get();
            
        if (snap.empty) return;
        
        const notifications = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Don't spam if already notified recently
            if (!data.lastRetentionNotify || data.lastRetentionNotify < sevenDaysAgo) {
                notifications.push({
                    token: data.fcmToken,
                    notification: {
                        title: "¡Te extrañamos en Rescatto! 🥗",
                        body: "¿Sabías que hoy hay nuevos packs sorpresa cerca de ti? Rescata algo rico y salva el planeta."
                    },
                    data: { type: "retention" }
                });
                // Update last notify date to avoid spam
                db.collection("users").doc(doc.id).update({
                    lastRetentionNotify: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        
        if (notifications.length > 0) {
            for (let i = 0; i < notifications.length; i += 500) {
                const chunk = notifications.slice(i, i + 500);
                await admin.messaging().sendEach(chunk);
            }
            log(`Enviadas ${notifications.length} notificaciones de retención.`);
        }
    } catch (e) {
        logError("sendRetentionNotifications Error", e);
    }
});

module.exports = { 
    applyDynamicPricing, 
    deactivateExpiredProducts, 
    handleMissedPickups, 
    notifyBeforePickup,
    resetBrokenStreaks,
    sendStreakReminders,
    resetPeriodicStats,
    sendRetentionNotifications
};
