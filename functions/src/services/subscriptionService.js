"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");

/**
 * Activa una suscripción de Rescatto Pass para el usuario.
 * Capa 13: Fidelización Pro & Operaciones de Escala.
 */
exports.subscribeToRescattoPass = onCall(async (request) => {
    // 1. Verificar Autenticación
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debe iniciar sesión para suscribirse.");
    }

    const { planId } = request.data;
    const userId = request.auth.uid;

    if (!["monthly", "annual"].includes(planId)) {
        throw new HttpsError("invalid-argument", "El plan seleccionado no es válido.");
    }

    try {
        const userRef = db.collection("users").doc(userId);
        
        // TODO: Integración con Stripe o PayU para procesamiento de pagos reales.
        // Por ahora, activamos la membresía directamente para validar la Capa 13.
        
        const now = new Date();
        const expiresAt = new Date();
        if (planId === "monthly") {
            expiresAt.setMonth(now.getMonth() + 1);
        } else {
            expiresAt.setFullYear(now.getFullYear() + 1);
        }

        const rescattoPass = {
            isActive: true,
            planId: planId,
            status: "active",
            startsAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            autoRenew: true,
            benefits: {
                freeDelivery: true,
                exclusiveDeals: true,
                multiplierBonus: planId === "annual" ? 1.2 : 1.1
            }
        };

        await userRef.update({ 
            rescattoPass,
            impact: {
                points: admin.firestore.FieldValue.increment(50) // Bono de bienvenida
            }
        });

        return { 
            success: true, 
            message: "Suscripción activada con éxito.",
            rescattoPass 
        };

    } catch (error) {
        console.error("Error in subscribeToRescattoPass:", error);
        throw new HttpsError("internal", "Error interno al procesar la suscripción.");
    }
});
