"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { db, admin, messaging } = require("../admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { withErrorHandling } = require("../utils/errorHandler");
const { CreateNotificationSchema, SendVerificationEmailSchema } = require("../schemas");
const { log, error: logError } = require("../utils/logger");
const sgMail = require("@sendgrid/mail");
const { CONFIG } = require("../utils/config");

/**
 * Creates a notification for a user.
 */
const createNotification = onCall(withErrorHandling("createNotification", async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const dataParsed = CreateNotificationSchema.safeParse(request.data || {});
    if (!dataParsed.success) {
        throw new HttpsError("invalid-argument", dataParsed.error.issues[0]?.message || "Invalid data.");
    }
    const { userId, title, message, type, link } = dataParsed.data;

    // Solo admins pueden crear notificaciones para otros usuarios
    if (userId !== request.auth.uid) {
        const callerDoc = await db.collection("users").doc(request.auth.uid).get();
        const callerRole = callerDoc.exists ? callerDoc.data().role : null;
        if (callerRole !== "SUPER_ADMIN" && callerRole !== "ADMIN") {
            throw new HttpsError("permission-denied", "No puedes crear notificaciones para otro usuario.");
        }
    }

    const notificationRef = db.collection("notifications").doc();
    await notificationRef.set({
        userId,
        title,
        message,
        type,
        link: link || null,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, notificationId: notificationRef.id };
}));

/**
 * Sends a verification email.
 */
const sendVerificationEmail = onCall(
    { secrets: ["SENDGRID_KEY"] },
    withErrorHandling("sendVerificationEmail", async (request) => {
        const dataParsed = SendVerificationEmailSchema.safeParse(request.data || {});
        if (!dataParsed.success) {
            throw new HttpsError("invalid-argument", dataParsed.error.issues[0]?.message || "Invalid email.");
        }
        const { email } = dataParsed.data;

        const allowed = await checkRateLimit(`emailVerif:${email}`, 3, 60 * 60 * 1000);
        if (!allowed) {
            throw new HttpsError("resource-exhausted", "Too many verification emails. Try again later.");
        }

        const sgKey = process.env.SENDGRID_KEY || "";
        if (!sgKey || sgKey === "PLACEHOLDER_KEY") {
            logError("FATAL: SENDGRID_KEY not configured.");
            throw new HttpsError("internal", "Email service not configured.");
        }
        sgMail.setApiKey(sgKey);

        const link = await admin.auth().generateEmailVerificationLink(email);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifica tu cuenta en Rescatto</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #f3f4f6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; }
            .content { padding: 40px; text-align: center; }
            .content h2 { color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
            .content p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
            .button { display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; }
            .footer { padding: 24px; text-align: center; font-size: 13px; color: #9ca3af; background-color: #f9fafb; border-top: 1px solid #f3f4f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Rescatto</h1></div>
            <div class="content">
              <h2>¡Hola! 👋</h2>
              <p>Gracias por unirte a la comunidad de Rescatto. Para completar tu registro y asegurar tu cuenta, por favor haz clic en el botón de abajo:</p>
              <a href="${link}" class="button">Verificar mi cuenta ahora</a>
              <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
            </div>
            <div class="footer"><p><strong>© 2024 Rescatto Business</strong></p></div>
          </div>
        </body>
        </html>`;

        await sgMail.send({
            to: email,
            from: CONFIG.sendgrid.from,
            subject: "Verifica tu cuenta en Rescatto 🥗",
            html: htmlContent,
        });
        log(`Verification email sent to ${email} via SendGrid`);
        return { success: true };
    })
);

/**
 * Pub/Sub Trigger: Handles notifications when an order event is published.
 */
const onOrderNotification = onMessagePublished("order-events", async (event) => {
    const messageData = event.data.message.json;
    if (!messageData || messageData.type !== "ORDER_CREATED") return;

    const { orderId, venueId, customerName, totalAmount } = messageData;

    try {
        const amountStr = new Intl.NumberFormat("es-CO", { 
            style: "currency", 
            currency: "COP", 
            maximumFractionDigits: 0 
        }).format(totalAmount || 0);

        const title = "¡Nuevo Pedido! 🎉";
        const message = `${customerName} ha realizado un pedido por ${amountStr}.`;

        const [ownersByArray, ownersByString, staffByArray, staffByString] = await Promise.all([
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueIds", "array-contains", venueId).get(),
            db.collection("users").where("role", "==", "VENUE_OWNER").where("venueId", "==", venueId).get(),
            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueIds", "array-contains", venueId).get(),
            db.collection("users").where("role", "==", "KITCHEN_STAFF").where("venueId", "==", venueId).get(),
        ]);

        const targetUsers = new Map();
        [...ownersByArray.docs, ...ownersByString.docs, ...staffByArray.docs, ...staffByString.docs].forEach(doc => {
            targetUsers.set(doc.id, doc.data());
        });

        if (targetUsers.size === 0) return;

        const batch = db.batch();
        const tokens = [];
        targetUsers.forEach((userData, userId) => {
            batch.set(db.collection("notifications").doc(), {
                userId, title, message, type: "success", read: false,
                link: `/order-management?search=${orderId}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (userData.fcmToken) tokens.push(userData.fcmToken);
        });
        await batch.commit();

        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
                tokens,
                notification: { title, body: message },
                data: { 
                    click_action: "FLUTTER_NOTIFICATION_CLICK", 
                    link: `/order-management?search=${orderId}`, 
                    orderId: String(orderId) 
                },
            });
        }
    } catch (e) { logError("onOrderNotification Error", e); }
});

module.exports = {
    createNotification,
    sendVerificationEmail,
    onOrderNotification
};
