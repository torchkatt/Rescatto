/**
 * Feature Flags — Rescatto v0.2.0
 *
 * Centralizes all feature toggles so that unfinished or experimental features
 * can be safely shipped to production without being visible to end users.
 *
 * Usage:
 *   import { isFeatureEnabled, FLAG } from '../utils/featureFlags';
 *   if (isFeatureEnabled(FLAG.DYNAMIC_PRICING)) { ... }
 *
 * To enable a flag in dev: set VITE_FF_<FLAG_NAME>=true in .env.local
 * To enable a flag in prod: update the DEFAULT value in FEATURE_FLAGS below.
 */

export const FLAG = {
    /** Dynamic pricing engine for venue products */
    DYNAMIC_PRICING: 'DYNAMIC_PRICING',
    /** AI-powered demand predictions on the business dashboard */
    AI_PREDICTIONS: 'AI_PREDICTIONS',
    /** Rescatto Pass subscription flow */
    RESCATTO_PASS: 'RESCATTO_PASS',
    /** Flash Deals feature (venue-facing and customer-facing) */
    FLASH_DEALS: 'FLASH_DEALS',
    /** In-app chat between customers and venue / driver */
    IN_APP_CHAT: 'IN_APP_CHAT',
    /** Referral program */
    REFERRALS: 'REFERRALS',
    /** PWA install prompt */
    PWA_INSTALL_PROMPT: 'PWA_INSTALL_PROMPT',
    /** React Query DevTools panel */
    REACT_QUERY_DEVTOOLS: 'REACT_QUERY_DEVTOOLS',
    /** Notification permission modal */
    NOTIFICATION_PERMISSION_MODAL: 'NOTIFICATION_PERMISSION_MODAL',
} as const;

export type FeatureFlag = (typeof FLAG)[keyof typeof FLAG];

/** Default state for each flag (production values). */
const FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
    DYNAMIC_PRICING: true,
    AI_PREDICTIONS: true,
    RESCATTO_PASS: true,
    FLASH_DEALS: true,
    IN_APP_CHAT: true,
    REFERRALS: true,
    PWA_INSTALL_PROMPT: true,
    REACT_QUERY_DEVTOOLS: false,
    NOTIFICATION_PERMISSION_MODAL: true,
};

/**
 * Returns true if the given feature flag is enabled.
 * Env var VITE_FF_<FLAG> overrides the default when set to "true" or "false".
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
    const envKey = `VITE_FF_${flag}` as keyof ImportMeta['env'];
    const envValue = import.meta.env[envKey];
    if (envValue === 'true') return true;
    if (envValue === 'false') return false;
    return FEATURE_FLAGS[flag] ?? false;
}

/**
 * React hook — re-evaluates on every render (flags are static at build time,
 * so this is safe and cheap).
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
    return isFeatureEnabled(flag);
}
