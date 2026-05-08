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
 * Marks READY pickup orders past deadline as MISSED.
 * (Renombrado de READY_PICKUP a READY)
 */
const handleMissedPickups = onSchedule("every 10 minutes", async () => {
    const nowStr = new Date().toISOString();
    try {
        // Solo pedidos de pickup (no delivery) que llevan más de 20 min listos
        const snapshot = await db.collection("orders")
            .where("status", "==", "READY")
            .where("pickupDeadline", "<", nowStr).get();

        if (snapshot.empty) return;
        const batch = db.batch();
        // Filtrar solo los que son pickup, no delivery
        let count = 0;
        snapshot.docs.forEach(snap => {
            const data = snap.data();
            if (data.deliveryMethod !== "delivery") {
                batch.update(snap.ref, {
                    status: "MISSED",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                count++;
            }
        });
        if (count > 0) await batch.commit();
        if (count > 0) log(`handleMissedPickups: marcados ${count} pedidos como MISSED.`);
    } catch (e) { logError("handleMissedPickups error", e); }
});

/**
 * Sends notification 10 mins before pickup deadline.
 * (Actualizado: usa READY en lugar de READY_PICKUP)
 */
const notifyBeforePickup = onSchedule("every 5 minutes", async () => {
    const now = new Date();
    const tenMinsFromNow = new Date(now.getTime() + 10 * 60000);

    try {
        const snapshot = await db.collection("orders")
            .where("status", "in", ["ACCEPTED", "IN_PREPARATION", "READY"])
            .where("pickupDeadline", "<=", tenMinsFromNow.toISOString())
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
                                body: `Te quedan menos de 10 minutos para recoger tu pedido en ${venueName}.`,
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

/**
 * Cron: cancela pedidos PENDING que el negocio no aceptó dentro de 5 minutos.
 * Re-envía FCM cada 60 segundos al staff hasta aceptación o timeout.
 * Ejecuta cada minuto.
 */
const handleOrderAcceptanceTimeout = onSchedule("every 1 minutes", async () => {
    const nowStr = new Date().toISOString();
    try {
        const snapshot = await db.collection("orders")
            .where("status", "==", "PENDING")
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        let cancelledCount = 0;
        const reminderPromises = [];

        for (const docSnap of snapshot.docs) {
            const order = docSnap.data();
            const orderId = docSnap.id;

            // ¿Expiró el tiempo de aceptación?
            if (order.acceptanceDeadline && order.acceptanceDeadline < nowStr) {
                batch.update(docSnap.ref, {
                    status: "CANCELLED",
                    cancellationReason: "ACCEPTANCE_TIMEOUT",
                    cancelledAt: nowStr,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                cancelledCount++;

                // Notificar al cliente
                if (order.customerId) {
                    reminderPromises.push(
                        db.collection("users").doc(order.customerId).get().then(userDoc => {
                            if (userDoc.exists && userDoc.data().fcmToken) {
                                return admin.messaging().send({
                                    notification: {
                                        title: "Pedido cancelado automáticamente",
                                        body: "El negocio no respondió a tiempo. Tu pedido fue cancelado.",
                                    },
                                    token: userDoc.data().fcmToken,
                                    data: { orderId, type: "ACCEPTANCE_TIMEOUT" },
                                });
                            }
                        }).catch(e => logError("Timeout notify client error", e))
                    );
                }

                // Notificar al dueño del venue
                if (order.venueId) {
                    const productsList = (order.products || []).map(p => `${p.name} x${p.quantity}`).join(", ");
                    reminderPromises.push(
                        Promise.all([
                            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", order.venueId).get(),
                            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", order.venueId).get(),
                        ]).then(([byArr, byStr]) => {
                            const ownerMap = new Map();
                            [...byArr.docs, ...byStr.docs].forEach(d => ownerMap.set(d.id, d.data()));
                            const tokens = [];
                            ownerMap.forEach(ud => { if (ud.fcmToken) tokens.push(ud.fcmToken); });
                            if (tokens.length === 0) return;
                            return admin.messaging().sendEachForMulticast({
                                tokens,
                                notification: {
                                    title: "⚠️ Pedido cancelado por timeout",
                                    body: `Un pedido fue cancelado porque tu equipo no respondió en 5 minutos. Productos: ${productsList}`,
                                },
                                data: { orderId, type: "ACCEPTANCE_TIMEOUT_OWNER" },
                            });
                        }).catch(e => logError("Timeout notify owner error", e))
                    );
                }
                continue;
            }

            // ¿Debe re-notificarse? (cada 60 segundos)
            const lastNotified = order.lastKitchenNotifiedAt;
            const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
            if (!lastNotified || lastNotified < sixtySecondsAgo) {
                batch.update(docSnap.ref, {
                    lastKitchenNotifiedAt: nowStr,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Re-enviar FCM al staff del venue
                if (order.venueId) {
                    const productsList = (order.products || []).map(p => `${p.name} x${p.quantity}`).join(", ");
                    const amount = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(order.totalAmount || 0);
                    reminderPromises.push(
                        Promise.all([
                            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", order.venueId).get(),
                            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", order.venueId).get(),
                            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueIds", "array-contains", order.venueId).get(),
                            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueId", "==", order.venueId).get(),
                        ]).then(([owArr, owStr, stArr, stStr]) => {
                            const staffMap = new Map();
                            [...owArr.docs, ...owStr.docs, ...stArr.docs, ...stStr.docs].forEach(d => staffMap.set(d.id, d.data()));
                            const tokens = [];
                            staffMap.forEach(ud => { if (ud.fcmToken) tokens.push(ud.fcmToken); });
                            if (tokens.length === 0) return;
                            return admin.messaging().sendEachForMulticast({
                                tokens,
                                notification: {
                                    title: "🔔 Nuevo pedido esperando — ¡Acepta o rechaza!",
                                    body: `${order.customerName || "Un cliente"}: ${productsList} — ${amount}`,
                                },
                                data: { orderId, type: "ORDER_PENDING_REMINDER" },
                            });
                        }).catch(e => logError("Kitchen reminder FCM error", e))
                    );
                }
            }
        }

        await Promise.all([batch.commit(), ...reminderPromises]);
        if (cancelledCount > 0) log(`handleOrderAcceptanceTimeout: cancelados ${cancelledCount} pedidos por timeout.`);
    } catch (e) { logError("handleOrderAcceptanceTimeout error", e); }
});

/**
 * Cron: auto-completa pedidos que el driver marcó como entregados
 * pero el cliente no confirmó ni disputó en 15 minutos.
 * Ejecuta cada 5 minutos.
 */
const handleDriverConfirmationTimeout = onSchedule("every 5 minutes", async () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    try {
        const snapshot = await db.collection("orders")
            .where("awaitingClientConfirmation", "==", true)
            .where("driverMarkedCompletedAt", "<", fifteenMinsAgo)
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        const nowStr = new Date().toISOString();
        snapshot.docs.forEach(snap => {
            batch.update(snap.ref, {
                status: "COMPLETED",
                awaitingClientConfirmation: false,
                deliveredAt: nowStr,
                autoCompletedAt: nowStr,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
        log(`handleDriverConfirmationTimeout: auto-completados ${snapshot.size} pedidos.`);
    } catch (e) { logError("handleDriverConfirmationTimeout error", e); }
});

/**
 * Daily Firestore backup via the Firestore Admin API.
 * Runs every day at 02:00 UTC to export all collections to GCS.
 *
 * Required: set FIRESTORE_BACKUP_BUCKET env var (e.g. gs://rescatto-backups)
 * and grant the App Engine default service account roles/datastore.importExportAdmin.
 */
const backupFirestore = onSchedule(
    { schedule: "0 2 * * *", timeZone: "UTC", retryCount: 2 },
    async () => {
        const bucket = process.env.FIRESTORE_BACKUP_BUCKET;
        if (!bucket) {
            logError("backupFirestore: FIRESTORE_BACKUP_BUCKET not configured — skipping.");
            return;
        }

        const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const outputUriPrefix = `${bucket}/firestore/${timestamp}`;

        try {
            const firestore = admin.firestore();
            // @ts-ignore — exportDocuments is available on the Firestore admin client
            await firestore.collection("_health_").doc("__backup_trigger__").set(
                { lastBackupAttempt: admin.firestore.FieldValue.serverTimestamp() },
                { merge: true }
            );

            // Use the Firestore Admin REST API to trigger the export
            const { GoogleAuth } = require("google-auth-library");
            const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/datastore" });
            const client = await auth.getClient();
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`;
            const response = await client.request({
                url,
                method: "POST",
                data: { outputUriPrefix },
            });

            log("backupFirestore: export triggered", {
                outputUriPrefix,
                operationName: response.data?.name,
            });

            // Record successful trigger in Firestore for monitoring
            await db.collection("system_events").add({
                type: "BACKUP_TRIGGERED",
                outputUriPrefix,
                operationName: response.data?.name || null,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            logError("backupFirestore: export failed", { message: e.message, stack: e.stack });
            // Record failure for alerting
            await db.collection("system_events").add({
                type: "BACKUP_FAILED",
                error: e.message,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            }).catch(() => {});
        }
    }
);

/**
 * Cron: cleans up old system data to maintain database hygiene.
 * - rate_limits > 24h
 * - webhook_dedup > 7 days
 * Runs every day at 03:00 UTC.
 */
const cleanupData = onSchedule("0 3 * * *", async () => {
    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
        let deletedRateLimits = 0;
        let deletedWebhooks = 0;

        // Cleanup rate_limits
        const rateLimitsSnap = await db.collection("rate_limits")
            .where("lastRequest", "<", twentyFourHoursAgo)
            .limit(500).get();
        
        if (!rateLimitsSnap.empty) {
            const batch = db.batch();
            rateLimitsSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedRateLimits = rateLimitsSnap.size;
        }

        // Cleanup webhook_dedup
        const webhooksSnap = await db.collection("webhook_dedup")
            .where("createdAt", "<", sevenDaysAgo)
            .limit(500).get();

        if (!webhooksSnap.empty) {
            const batch = db.batch();
            webhooksSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedWebhooks = webhooksSnap.size;
        }

        log(`cleanupData: deleted ${deletedRateLimits} rate_limits and ${deletedWebhooks} webhooks.`);
    } catch (e) { logError("cleanupData error", e); }
});

module.exports = {
    applyDynamicPricing,
    deactivateExpiredProducts,
    handleMissedPickups,
    notifyBeforePickup,
    resetBrokenStreaks,
    sendStreakReminders,
    resetPeriodicStats,
    sendRetentionNotifications,
    handleOrderAcceptanceTimeout,
    handleDriverConfirmationTimeout,
    backupFirestore,
    cleanupData,
};

