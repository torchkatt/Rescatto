"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, admin, messaging } = require("../admin");
const { log, error: logError } = require("../utils/logger");
const { writeAuditLog } = require("../utils/audit");
const { withSecurityBunker } = require("../utils/errorHandler");
const nodemailer = require("nodemailer");
// const { CONFIG } = require("../utils/config"); // unused after Gmail migration
const crypto = require("crypto");

function createGmailTransport() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass || pass === "PLACEHOLDER_CONFIGURE_ME") return null;
    return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

async function sendGmail({ to, subject, html }) {
    const transport = createGmailTransport();
    if (!transport) { logError("Gmail no configurado — email no enviado."); return; }
    await transport.sendMail({ from: `"Rescatto" <${process.env.GMAIL_USER}>`, to, subject, html });
}

const PLANS = {
    monthly: { amount: 14900, durationMonths: 1, label: "Mensual" },
    annual:  { amount: 149000, durationMonths: 12, label: "Anual" },
};


/**
 * Genera un código de referencia seguro:
 * RP-{PLAN}-{USER6}-{TIMESTAMP4}-{RANDOM4}-{CHECKSUM2}
 * Ejemplo: RP-M-A3F2C1-6B2D-X9K4-Q7
 */
function generateSecureReferenceCode(userId, planId) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    // Componente del usuario: hash SHA256 del userId → toma 6 chars en base36
    const userHash = crypto.createHash("sha256").update(userId).digest("hex");
    const userComponent = parseInt(userHash.slice(0, 8), 16).toString(36).toUpperCase().slice(0, 6).padStart(6, "0");

    // Componente de tiempo: últimos 4 chars del timestamp en base36
    const timeComponent = Date.now().toString(36).toUpperCase().slice(-4);

    // Componente aleatorio: 4 chars
    let randComponent = "";
    for (let i = 0; i < 4; i++) randComponent += chars[Math.floor(Math.random() * chars.length)];

    // Checksum: suma de todos los chars → 2 chars
    const payload = `${planId[0].toUpperCase()}${userComponent}${timeComponent}${randComponent}`;
    const checksum = payload.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const checksumStr = (checksum % (36 * 36)).toString(36).toUpperCase().padStart(2, "0");

    return `RP-${planId[0].toUpperCase()}-${userComponent}-${timeComponent}-${randComponent}-${checksumStr}`;
}

/**
 * Notifica a todos los SUPER_ADMIN y ADMIN cuando un cliente envía su comprobante.
 * Envía: FCM push + Firestore notification + email (SendGrid)
 */
async function notifyAdminsOfPaymentProof(requestData) {
    try {
        const adminsSnap = await db.collection("users")
            .where("role", "in", ["SUPER_ADMIN", "ADMIN"])
            .get();

        if (adminsSnap.empty) return;

        const formatCOP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
        const planLabel = PLANS[requestData.planId]?.label || requestData.planId;
        const amount = formatCOP(requestData.amount);

        const fcmTokens = [];
        const emails = [];
        const notifBatch = db.batch();

        adminsSnap.docs.forEach(adminDoc => {
            const adminData = adminDoc.data();

            // FCM token
            if (adminData.fcmToken) fcmTokens.push(adminData.fcmToken);

            // Email
            if (adminData.email) emails.push(adminData.email);

            // Notificación Firestore
            const notifRef = db.collection("notifications").doc();
            notifBatch.set(notifRef, {
                userId: adminDoc.id,
                title: "💳 Comprobante de pago recibido",
                message: `${requestData.userName} envió comprobante para Rescatto Pass ${planLabel} · ${amount}. Ref: ${requestData.referenceCode}`,
                type: "subscription_proof",
                link: "/admin/subscriptions",
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        await notifBatch.commit();
        log("notifyAdmins: Firestore notifications created", { count: adminsSnap.size });

        // FCM push
        if (fcmTokens.length > 0) {
            try {
                await messaging.sendEachForMulticast({
                    tokens: fcmTokens,
                    notification: {
                        title: "💳 Comprobante de pago recibido",
                        body: `${requestData.userName} · Pass ${planLabel} · ${amount}`,
                    },
                    data: { link: "/admin/subscriptions" },
                    webpush: { fcmOptions: { link: `${process.env.APP_URL || ""}/admin/subscriptions` } },
                });
                log("notifyAdmins: FCM sent", { tokens: fcmTokens.length });
            } catch (fcmErr) {
                logError("notifyAdmins: FCM error (non-fatal)", fcmErr);
            }
        }

        // Email Gmail
        if (emails.length > 0) {
            await sendGmail({
                to: emails.join(","),
                subject: `💳 Nuevo comprobante de pago — ${requestData.userName}`,
                html: buildAdminNotifEmail(requestData, planLabel, amount),
            });
            log("notifyAdmins: email sent", { emails });
        }
    } catch (err) {
        logError("notifyAdminsOfPaymentProof error (non-fatal):", err);
    }
}

// ── Cloud Functions ───────────────────────────────────────────────────────────

/**
 * Crea una solicitud de suscripción prepago con código de referencia seguro.
 */
exports.createSubscriptionRequest = onCall(
    withSecurityBunker("createSubscriptionRequest", async (request) => {

    const { planId } = request.data;
    if (!PLANS[planId]) throw new HttpsError("invalid-argument", "Plan no válido.");

    const userId = request.auth.uid;
    const plan = PLANS[planId];

    // Si ya tiene solicitud activa pendiente, retornarla
    const existingSnap = await db.collection("subscription_requests")
        .where("userId", "==", userId)
        .where("status", "in", ["pending_payment", "pending_review"])
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        const existing = existingSnap.docs[0];
        return { id: existing.id, ...existing.data() };
    }

    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data() || {};

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h
    const referenceCode = generateSecureReferenceCode(userId, planId);

    const requestData = {
        userId,
        userName:  userData.fullName || "Cliente",
        userEmail: userData.email    || "",
        planId,
        amount: plan.amount,
        referenceCode,
        status: "pending_payment",
        createdAt:  now.toISOString(),
        expiresAt:  expiresAt.toISOString(),
    };

    const docRef = await db.collection("subscription_requests").add(requestData);

    await writeAuditLog({
        action: "subscription_request_created",
        performedBy: userId,
        targetId: docRef.id,
        targetType: "subscription_request",
        metadata: { planId, amount: plan.amount, referenceCode },
    });

    log("createSubscriptionRequest", { requestId: docRef.id, userId, planId, referenceCode });
    return { id: docRef.id, ...requestData };
    })
);

/**
 * El cliente sube el comprobante → pasa a pending_review y notifica a los admins.
 */
exports.submitPaymentProof = onCall(
    { secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD"] },
    withSecurityBunker("submitPaymentProof", async (request) => {

        const { requestId, transactionNumber, paymentProofUrl } = request.data;
        if (!requestId || !transactionNumber) {
            throw new HttpsError("invalid-argument", "requestId y transactionNumber son obligatorios.");
        }

        const ref = db.collection("subscription_requests").doc(requestId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada.");

        const data = snap.data();
        if (data.userId !== request.auth.uid) throw new HttpsError("permission-denied", "Sin permiso.");
        if (data.status !== "pending_payment") {
            throw new HttpsError("failed-precondition", "La solicitud ya fue procesada.");
        }

        await ref.update({
            status: "pending_review",
            transactionNumber,
            paymentProofUrl: paymentProofUrl || null,
            submittedAt: new Date().toISOString(),
        });

        await writeAuditLog({
            action: "payment_proof_submitted",
            performedBy: request.auth.uid,
            targetId: requestId,
            targetType: "subscription_request",
            metadata: { transactionNumber, hasProofFile: !!paymentProofUrl },
        });

        // Notificar a los admins (FCM + email + Firestore) — no bloquea la respuesta
        notifyAdminsOfPaymentProof({ ...data, transactionNumber });

        log("submitPaymentProof", { requestId });
        return { success: true };
    })
);

/**
 * (Admin) Aprueba la solicitud y activa el Rescatto Pass.
 */
exports.approveSubscriptionRequest = onCall(
    { secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD"] },
    withSecurityBunker("approveSubscriptionRequest", async (request) => {

        const { requestId } = request.data;
        if (!requestId) throw new HttpsError("invalid-argument", "requestId requerido.");

        const ref = db.collection("subscription_requests").doc(requestId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada.");

        const data = snap.data();
        if (data.status === "approved") throw new HttpsError("failed-precondition", "Ya aprobada.");

        const plan = PLANS[data.planId];
        const now = new Date();
        const passExpiry = new Date();
        passExpiry.setMonth(passExpiry.getMonth() + plan.durationMonths);

        const rescattoPass = {
            isActive: true,
            planId: data.planId,
            status: "active",
            startsAt:   now.toISOString(),
            expiresAt:  passExpiry.toISOString(),
            autoRenew: false,
            benefits: {
                freeDelivery:   true,
                exclusiveDeals: true,
                multiplierBonus: data.planId === "annual" ? 1.2 : 1.1,
            },
        };

        await db.runTransaction(async (tx) => {
            tx.update(ref, {
                status: "approved",
                approvedAt: now.toISOString(),
                approvedBy: request.auth.uid,
            });
            tx.update(db.collection("users").doc(data.userId), { rescattoPass });
        });

        // Notificar al cliente por email
        try {
            if (data.userEmail) {
                const planLabel = plan.label;
                const expDate = passExpiry.toLocaleDateString("es-CO");
                await sendGmail({
                    to: data.userEmail,
                    subject: "🎉 ¡Tu Rescatto Pass está activo!",
                    html: buildApprovalEmail(data.userName, planLabel, expDate),
                });
            }
        } catch (emailErr) {
            logError("approveSubscriptionRequest: email error (non-fatal)", emailErr);
        }

        await writeAuditLog({
            action: "subscription_approved",
            performedBy: request.auth.uid,
            targetId: data.userId,
            targetType: "user",
            metadata: { requestId, planId: data.planId, amount: data.amount },
        });

        log("approveSubscriptionRequest", { requestId, userId: data.userId });
        return { success: true };
    }, { requiredRoles: ["ADMIN", "SUPER_ADMIN"] })
);

/**
 * (Admin) Rechaza la solicitud con motivo.
 */
exports.rejectSubscriptionRequest = onCall(
    withSecurityBunker("rejectSubscriptionRequest", async (request) => {

    const { requestId, reason } = request.data;
    if (!requestId) throw new HttpsError("invalid-argument", "requestId requerido.");

    const ref = db.collection("subscription_requests").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Solicitud no encontrada.");

    const data = snap.data();
    await ref.update({
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        rejectedReason: reason || "Pago no verificado.",
    });

    await writeAuditLog({
        action: "subscription_rejected",
        performedBy: request.auth.uid,
        targetId: data.userId,
        targetType: "user",
        metadata: { requestId, reason },
    });

    log("rejectSubscriptionRequest", { requestId });
    return { success: true };
}, { requiredRoles: ["ADMIN", "SUPER_ADMIN"] }));

// ── Email templates ───────────────────────────────────────────────────────────

function buildAdminNotifEmail(req, planLabel, amount) {
    return `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:0}
      .c{max-width:560px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb}
      .h{background:linear-gradient(135deg,#1A6B4A,#0d9488);padding:32px 20px;text-align:center;color:#fff}
      .h h1{margin:0;font-size:24px;font-weight:800}
      .b{padding:36px}
      .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
      .label{color:#6b7280;font-weight:600}
      .value{color:#111827;font-weight:700}
      .btn{display:inline-block;background:#1A6B4A;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:800;margin-top:24px}
      .f{padding:20px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>💳 Nuevo Comprobante de Pago</h1></div>
      <div class="b">
        <p style="color:#4b5563;margin-bottom:24px">Se recibió un comprobante de pago que requiere verificación:</p>
        <div class="row"><span class="label">Cliente</span><span class="value">${req.userName}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${req.userEmail}</span></div>
        <div class="row"><span class="label">Plan</span><span class="value">Rescatto Pass ${planLabel}</span></div>
        <div class="row"><span class="label">Monto</span><span class="value">${amount}</span></div>
        <div class="row"><span class="label">Referencia</span><span class="value" style="font-family:monospace;letter-spacing:2px">${req.referenceCode}</span></div>
        <div class="row"><span class="label">Nº Transacción</span><span class="value">${req.transactionNumber || "—"}</span></div>
        <div style="text-align:center">
          <a href="${process.env.APP_URL || ""}/admin/subscriptions" class="btn">Revisar en el Panel →</a>
        </div>
      </div>
      <div class="f">© ${new Date().getFullYear()} Rescatto · Panel de Administración</div>
    </div>
    </body></html>`;
}

function buildApprovalEmail(userName, planLabel, expiresDate) {
    return `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:0}
      .c{max-width:560px;margin:40px auto;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb}
      .h{background:linear-gradient(135deg,#1A6B4A,#0d9488);padding:40px 20px;text-align:center;color:#fff}
      .h h1{margin:0;font-size:28px;font-weight:900}
      .b{padding:40px;text-align:center}
      .badge{display:inline-block;background:#f0fdf4;border:2px solid #1A6B4A;border-radius:999px;padding:8px 20px;color:#1A6B4A;font-weight:800;font-size:14px;margin-bottom:24px}
      .f{padding:20px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6}
    </style></head><body>
    <div class="c">
      <div class="h"><h1>🎉 ¡Bienvenido a Rescatto Pass!</h1></div>
      <div class="b">
        <div class="badge">✓ Pago Verificado</div>
        <h2 style="color:#111827;font-size:22px;font-weight:700">Hola, ${userName}</h2>
        <p style="color:#4b5563;line-height:1.7">Tu suscripción al <strong>Plan ${planLabel}</strong> ha sido activada exitosamente.<br>Disfruta todos los beneficios premium de Rescatto.</p>
        <p style="color:#6b7280;font-size:14px">Vigente hasta: <strong>${expiresDate}</strong></p>
      </div>
      <div class="f">© ${new Date().getFullYear()} Rescatto</div>
    </div>
    </body></html>`;
}
