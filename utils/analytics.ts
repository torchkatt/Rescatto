import { logEvent } from 'firebase/analytics';
import { analytics } from '../services/firebase';

const track = (event: string, params?: Record<string, unknown>) => {
    if (!analytics) return;
    try {
        logEvent(analytics, event, params as Record<string, string>);
    } catch {
        // Silencioso — analytics nunca debe romper el flujo
    }
};

export const Analytics = {
    // ── Autenticación ──────────────────────────────────────────────────────
    userRegistered: (method: 'email' | 'google' | 'guest') =>
        track('user_registered', { method }),

    userLoggedIn: (method: 'email' | 'google') =>
        track('login', { method }),

    // ── Navegación / Descubrimiento ────────────────────────────────────────
    venueViewed: (venueId: string, venueName: string, city: string) =>
        track('venue_viewed', { venue_id: venueId, venue_name: venueName, city }),

    dealViewed: (productId: string, venueId: string, price: number) =>
        track('deal_viewed', { product_id: productId, venue_id: venueId, price }),

    searchPerformed: (query: string, resultsCount: number) =>
        track('search', { search_term: query, results_count: resultsCount }),

    // ── Carrito / Checkout ─────────────────────────────────────────────────
    addedToCart: (productId: string, venueId: string, price: number) =>
        track('add_to_cart', { product_id: productId, venue_id: venueId, value: price, currency: 'COP' }),

    removedFromCart: (productId: string) =>
        track('remove_from_cart', { product_id: productId }),

    checkoutStarted: (venueId: string, total: number, itemCount: number) =>
        track('begin_checkout', { venue_id: venueId, value: total, currency: 'COP', item_count: itemCount }),

    paymentMethodSelected: (method: 'card' | 'cash') =>
        track('payment_method_selected', { method }),

    // ── Órdenes ───────────────────────────────────────────────────────────
    orderCreated: (orderId: string, venueId: string, total: number, deliveryMethod: string) =>
        track('purchase', { transaction_id: orderId, venue_id: venueId, value: total, currency: 'COP', delivery_method: deliveryMethod }),

    orderCancelled: (orderId: string, reason?: string) =>
        track('order_cancelled', { order_id: orderId, reason: reason ?? 'unknown' }),

    orderRated: (orderId: string, rating: number) =>
        track('order_rated', { order_id: orderId, rating }),

    // ── Gamificación ──────────────────────────────────────────────────────
    referralShared: (referralCode: string) =>
        track('referral_shared', { referral_code: referralCode }),

    levelReached: (level: string) =>
        track('level_up', { level }),

    co2Milestone: (totalKg: number) =>
        track('co2_milestone', { total_kg: totalKg }),

    // ── Venue Owner ───────────────────────────────────────────────────────
    productCreated: (venueId: string, category: string) =>
        track('product_created', { venue_id: venueId, category }),

    flashDealActivated: (venueId: string, discount: number) =>
        track('flash_deal_activated', { venue_id: venueId, discount_pct: discount }),
};
