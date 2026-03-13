"use strict";

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("../admin");
const { log, error: logError } = require("../utils/logger");
const { IS_PROD, ALLOWED_ORIGINS } = require("../utils/config");
const { writeAuditLog } = require("../utils/audit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_for_deploy");

/**
 * Creates a Stripe Checkout Session for Rescatto Pass subscription.
 */
exports.createStripeCheckoutSession = onCall({
    secrets: ["STRIPE_SECRET_KEY"],
    cors: ALLOWED_ORIGINS
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
    }

    const { planId, successUrl, cancelUrl } = request.data;
    const userId = request.auth.uid;

    if (!["monthly", "annual"].includes(planId)) {
        throw new HttpsError("invalid-argument", "Plan no válido.");
    }

    // Map planId to Stripe Price IDs (Usually set in environment variables)
    // For development, these would be test mode price IDs.
    const priceId = planId === "monthly" 
        ? process.env.STRIPE_PRICE_MONTHLY 
        : process.env.STRIPE_PRICE_ANNUAL;

    if (!priceId && IS_PROD) {
        logError("FATAL: Stripe Price IDs not configured.");
        throw new HttpsError("internal", "Configuración de pagos incompleta.");
    }

    try {
        const userSnap = await db.collection("users").doc(userId).get();
        const userData = userSnap.data();

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId || (planId === "monthly" ? "price_monthly_placeholder" : "price_annual_placeholder"),
                    quantity: 1,
                },
            ],
            mode: "subscription",
            customer_email: userData.email,
            client_reference_id: userId,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId,
                planId
            }
        });

        return { sessionId: session.id, url: session.url };
    } catch (error) {
        logError("Stripe Checkout Session Error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Stripe Webhook Handler
 */
exports.stripeWebhook = onRequest({
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    cors: ALLOWED_ORIGINS,
    memory: "256MiB"
}, async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        logError("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    log("Stripe Webhook Received:", { type: event.type });

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object);
                break;
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
                await handleSubscriptionChanged(event.data.object);
                break;
            case "invoice.payment_succeeded":
                await handleInvoicePaid(event.data.object);
                break;
            default:
                log("Unhandled event type:", event.type);
        }

        res.status(200).send({ received: true });
    } catch (error) {
        logError("Error processing webhook event:", error);
        res.status(500).send("Internal Server Error");
    }
});

async function handleCheckoutCompleted(session) {
    const { userId, planId } = session.metadata;
    if (!userId) return;

    log("Checkout Completed:", { userId, planId, customerId: session.customer });

    // Link Stripe Customer ID to User
    await db.collection("users").doc(userId).update({
        stripeCustomerId: session.customer,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function handleSubscriptionChanged(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status; // active, past_due, canceled, etc.
    
    // Find user by stripeCustomerId
    const usersQuery = await db.collection("users")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (usersQuery.empty) return;
    
    const userDoc = usersQuery.docs[0];
    const isActive = status === "active" || status === "trialing";

    log("Subscription Changed:", { userId: userDoc.id, status, isActive });

    await userDoc.ref.update({
        "rescattoPass.isActive": isActive,
        "rescattoPass.status": status === "active" ? "active" : status === "canceled" ? "expired" : "suspended",
        "rescattoPass.expiresAt": new Date(subscription.current_period_end * 1000).toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeAuditLog({
        action: "subscription_updated",
        performedBy: "stripe_webhook",
        targetId: userDoc.id,
        targetType: "user",
        metadata: { status, subscriptionId: subscription.id }
    });
}

async function handleInvoicePaid(invoice) {
    // Optional: Log payment or renew benefits
    log("Invoice Paid:", { customer: invoice.customer, amount: invoice.amount_paid });
}
