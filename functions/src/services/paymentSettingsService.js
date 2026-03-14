"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, admin } = require("../admin");
const { log } = require("../utils/logger");
const { writeAuditLog } = require("../utils/audit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

function createGmailTransport() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass || pass === "PLACEHOLDER_CONFIGURE_ME") {
        throw new HttpsError("internal", "Servicio de email no configurado.");
    }
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
}

const PAYMENT_INFO_DOC = "settings/payment_info";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos

async function assertSuperAdmin(auth) {
    if (!auth) throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
    const userDoc = await db.collection("users").doc(auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "SUPER_ADMIN") {
        throw new HttpsError("permission-denied", "Solo SUPER_ADMIN.");
    }
}

function hashOTP(code) {
    return crypto.createHash("sha256").update(code + "rescatto-otp-salt").digest("hex");
}

function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

/**
 * Retorna los datos bancarios actuales desde Firestore.
 * Accesible por cualquier usuario autenticado (para mostrarlo en el modal de pago).
 */
exports.getBankPaymentInfo = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debe iniciar sesión.");

    const snap = await db.doc(PAYMENT_INFO_DOC).get();
    if (!snap.exists) {
        // Retorna vacío si aún no fue configurado
        return { configured: false };
    }
    const data = snap.data();
    return {
        configured: true,
        bankName:    data.bankName    || "",
        accountType: data.accountType || "",
        brebKey:     data.brebKey     || "",
        holder:      data.holder      || "",
        nit:         data.nit         || "",
    };
});

/**
 * (SUPER_ADMIN) Solicita un cambio de datos bancarios.
 * Genera y envía un OTP al correo del admin.
 */
exports.requestBankInfoChange = onCall(
    { secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD"] },
    async (request) => {
        await assertSuperAdmin(request.auth);

        const adminId = request.auth.uid;
        const adminSnap = await db.collection("users").doc(adminId).get();
        const adminEmail = adminSnap.data()?.email;
        if (!adminEmail) throw new HttpsError("not-found", "Email del admin no encontrado.");

        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

        // Guardar OTP hasheado — eliminado al usarse o al vencer
        await db.collection("otp_verifications").doc(adminId).set({
            otpHash,
            purpose: "bank_info_change",
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            used: false,
        });

        // Enviar email con OTP via Gmail
        const transport = createGmailTransport();
        await transport.sendMail({
            from: `"Rescatto Admin" <${process.env.GMAIL_USER}>`,
            to: adminEmail,
            subject: "🔐 Código de verificación — Rescatto Admin",
            html: buildOTPEmail(otp, adminSnap.data()?.fullName || "Administrador"),
        });

        await writeAuditLog({
            action: "bank_info_otp_requested",
            performedBy: adminId,
            targetId: "settings/payment_info",
            targetType: "settings",
            metadata: { maskedEmail: maskEmail(adminEmail) },
        });

        log("requestBankInfoChange: OTP enviado", { adminId, adminEmail });
        return { success: true, maskedEmail: maskEmail(adminEmail) };
    }
);

/**
 * (SUPER_ADMIN) Verifica el OTP y actualiza los datos bancarios.
 */
exports.updateBankPaymentInfo = onCall(async (request) => {
    await assertSuperAdmin(request.auth);

    const { otp, bankName, accountType, brebKey, holder, nit } = request.data;
    if (!otp || !bankName || !holder) {
        throw new HttpsError("invalid-argument", "Datos incompletos.");
    }

    const adminId = request.auth.uid;
    const otpRef = db.collection("otp_verifications").doc(adminId);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) throw new HttpsError("failed-precondition", "No hay verificación pendiente.");

    const { otpHash, purpose, expiresAt, used } = otpSnap.data();

    if (used) throw new HttpsError("failed-precondition", "El código ya fue utilizado.");
    if (purpose !== "bank_info_change") throw new HttpsError("failed-precondition", "Código inválido para esta operación.");
    if (expiresAt.toDate() < new Date()) {
        await otpRef.delete();
        throw new HttpsError("deadline-exceeded", "El código expiró. Solicita uno nuevo.");
    }
    if (hashOTP(otp) !== otpHash) {
        throw new HttpsError("permission-denied", "Código incorrecto.");
    }

    // OTP válido — marcar como usado y actualizar datos
    await db.runTransaction(async (tx) => {
        tx.delete(otpRef);
        tx.set(db.doc(PAYMENT_INFO_DOC), {
            bankName,
            accountType: accountType || "Cuenta de Ahorros",
            brebKey:     brebKey     || "",
            holder,
            nit:         nit         || "",
            updatedAt: new Date().toISOString(),
            updatedBy: adminId,
        });
    });

    await writeAuditLog({
        action: "bank_payment_info_updated",
        performedBy: adminId,
        targetId: "settings/payment_info",
        targetType: "settings",
        metadata: { bankName, holder },
    });

    log("updateBankPaymentInfo: datos actualizados", { adminId });
    return { success: true };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskEmail(email) {
    const [user, domain] = email.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
}

function buildOTPEmail(otp, name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 24px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background: linear-gradient(135deg, #1A6B4A 0%, #0d9488 100%); padding: 36px 20px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 26px; font-weight: 800; }
        .body { padding: 40px; text-align: center; }
        .otp-box { display: inline-block; background: #f0fdf4; border: 2px dashed #1A6B4A; border-radius: 16px; padding: 20px 40px; margin: 24px 0; }
        .otp-code { font-size: 44px; font-weight: 900; color: #1A6B4A; letter-spacing: 12px; font-family: monospace; }
        .warning { font-size: 13px; color: #6b7280; margin-top: 8px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>🔐 Rescatto Admin</h1></div>
        <div class="body">
          <h2 style="color:#111827; font-size:22px; font-weight:700;">Hola, ${name}</h2>
          <p style="color:#4b5563;">Recibimos una solicitud para modificar los datos bancarios de la plataforma.<br>Usa el siguiente código para confirmar la operación:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="warning">⏱ Este código expira en <strong>5 minutos</strong> y es de uso único.</p>
          <p class="warning">Si no solicitaste este cambio, ignora este mensaje y revisa el acceso a tu cuenta.</p>
        </div>
        <div class="footer">© ${new Date().getFullYear()} Rescatto · Panel de Administración</div>
      </div>
    </body>
    </html>`;
}
