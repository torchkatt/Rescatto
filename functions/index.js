"use strict";

/**
 * Rescatto Cloud Functions - Modular Entry Point
 * Refactored into Layer 3: Service-Oriented Architecture
 */

// ─── User & Auth Services ─────────────────────────────────────────────────────
const {
    ensureReferralCode,
    deleteUserAccount,
    getReferralStats,
    updateDriverLocation,
    onUserUpdated,
    onUserCreated
} = require("./src/services/userService");

// ─── Notification & Messaging ─────────────────────────────────────────────────
const {
    createNotification,
    sendVerificationEmail,
    onOrderNotification
} = require("./src/services/notificationService");

// ─── Payment Services (Wompi & Stripe) ────────────────────────────────────────
const {
    generateWompiSignature,
    wompiWebhook
} = require("./src/services/paymentService");

const {
    createStripeCheckoutSession,
    stripeWebhook
} = require("./src/services/stripeService");

// ─── Order & Inventory Services ───────────────────────────────────────────────
const {
    createOrder,
    onOrderUpdated,
    onOrderCreated,
    acceptOrder,
    rejectOrder,
    cancelOrderByClient,
    releaseToDriverPool,
    assignDriver,
    takeDelivery,
    markOrderInTransit,
    markDeliveredByDriver,
    confirmDelivery,
    disputeDelivery,
    markOrderReady,
    resolveDispute,
} = require("./src/services/orderService");

// ─── Loyalty & Reward Services ───────────────────────────────────────────────
const {
    redeemPoints
} = require("./src/services/rewardService");

// ─── Chat & Communication Services ────────────────────────────────────────────
const {
    resolveVenueChatTarget
} = require("./src/services/chatService");

// ─── Admin & Stats Services ───────────────────────────────────────────────────
const {
    getFinanceStats,
    aggregateAdminStats,
    migrateVenueIdToVenueIds,
    recordManualSettlement,
    updateVenueDeliveryConfig
} = require("./src/services/adminService");

// ─── Cron & Scheduled Jobs ────────────────────────────────────────────────────
const {
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
} = require("./src/services/cronService");


// ─── Miscellaneous Services ───────────────────────────────────────────────────
const {
    healthCheck,
    scheduledHealthCheck,
} = require("./src/services/miscService");

// ─── Subscription Services ────────────────────────────────────────────────────
const {
    createSubscriptionRequest,
    submitPaymentProof,
    approveSubscriptionRequest,
    rejectSubscriptionRequest,
} = require("./src/services/subscriptionService");

// ─── Payment Settings Services ────────────────────────────────────────────────
const {
    getBankPaymentInfo,
    requestBankInfoChange,
    updateBankPaymentInfo,
} = require("./src/services/paymentSettingsService");

// ─── Leaderboard Services ─────────────────────────────────────────────────────
const {
    getLeaderboard,
    getMyLeaderboardRank
} = require("./src/services/leaderboardService");

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Leaderboard
    getLeaderboard,
    getMyLeaderboardRank,

    // Auth & User
    ensureReferralCode,
    deleteUserAccount,
    getReferralStats,
    updateDriverLocation,
    onUserUpdated,
    onUserCreated,
    sendVerificationEmail,

    // Notifications
    createNotification,
    onOrderNotification,

    // Payments (Stripe & Wompi)
    generateWompiSignature,
    wompiWebhook,
    createStripeCheckoutSession,
    stripeWebhook,

    // Orders
    createOrder,
    onOrderUpdated,
    onOrderCreated,
    acceptOrder,
    rejectOrder,
    cancelOrderByClient,
    releaseToDriverPool,
    assignDriver,
    takeDelivery,
    markOrderInTransit,
    markDeliveredByDriver,
    confirmDelivery,
    disputeDelivery,
    markOrderReady,
    resolveDispute,

    // Rewards
    redeemPoints,

    // Chat
    resolveVenueChatTarget,

    // Admin
    getFinanceStats,
    aggregateAdminStats,
    migrateVenueIdToVenueIds,
    recordManualSettlement,
    updateVenueDeliveryConfig,

    // Cron
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

    // Misc

    healthCheck,
    scheduledHealthCheck,

    // Subscriptions
    createSubscriptionRequest,
    submitPaymentProof,
    approveSubscriptionRequest,
    rejectSubscriptionRequest,

    // Payment Settings (SUPER_ADMIN)
    getBankPaymentInfo,
    requestBankInfoChange,
    updateBankPaymentInfo,
};
