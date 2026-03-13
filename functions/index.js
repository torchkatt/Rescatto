"use strict";

/**
 * Rescatto Cloud Functions - Modular Entry Point
 * Refactored into Layer 3: Service-Oriented Architecture
 */

// ─── User & Auth Services ─────────────────────────────────────────────────────
const {
    ensureReferralCode,
    deleteUserAccount,
    getReferralStats
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
    onOrderCreated
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
    migrateVenueIdToVenueIds
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
    sendRetentionNotifications
} = require("./src/services/cronService");

// ─── Miscellaneous Services ───────────────────────────────────────────────────
const {
    healthCheck
} = require("./src/services/miscService");

// ─── Subscription Services ────────────────────────────────────────────────────
const {
    subscribeToRescattoPass
} = require("./src/services/subscriptionService");

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

    // Rewards
    redeemPoints,

    // Chat
    resolveVenueChatTarget,

    // Admin
    getFinanceStats,
    aggregateAdminStats,
    migrateVenueIdToVenueIds,

    // Cron
    applyDynamicPricing,
    deactivateExpiredProducts,
    handleMissedPickups,
    notifyBeforePickup,
    resetBrokenStreaks,
    sendStreakReminders,
    resetPeriodicStats,
    sendRetentionNotifications,

    // Misc
    healthCheck,

    // Subscriptions
    subscribeToRescattoPass
};
