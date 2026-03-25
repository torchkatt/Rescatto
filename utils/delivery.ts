import { Venue } from '../types';
import { calculateDistance } from '../services/locationService';

export interface DeliveryCalculationResult {
    possible: boolean;
    fee: number;
    reason?: string;
    distance?: number;
}

// Tarifa flat de fallback cuando el negocio no tiene deliveryConfig configurado
const DEFAULT_FLAT_FEE = 5000; // COP

export const calculateDeliveryFee = (
    venue: Venue,
    userLat: number,
    userLng: number,
    orderTotal: number
): DeliveryCalculationResult => {
    // 1. Si el venue no tiene deliveryConfig, usar tarifa flat por defecto en vez de bloquear
    if (!venue.deliveryConfig) {
        const distanceKm = calculateDistance(userLat, userLng, venue.latitude, venue.longitude);
        return { possible: true, fee: DEFAULT_FLAT_FEE, distance: distanceKm };
    }

    // 2. Si tiene config pero domicilio está desactivado explícitamente, bloquear
    if (!venue.deliveryConfig.isEnabled) {
        return { possible: false, fee: 0, reason: 'El negocio no tiene domicilios activos.' };
    }

    // 2. Calculate Distance
    const distanceKm = calculateDistance(userLat, userLng, venue.latitude, venue.longitude);

    // 3. Check Max Distance
    if (distanceKm > venue.deliveryConfig.maxDistance) {
        return {
            possible: false,
            fee: 0,
            distance: distanceKm,
            reason: `Estás muy lejos (${distanceKm.toFixed(1)}km). Máximo: ${venue.deliveryConfig.maxDistance}km.`
        };
    }

    // 4. Check Min Order Amount
    if (venue.deliveryConfig.minOrderAmount && orderTotal < venue.deliveryConfig.minOrderAmount) {
        return {
            possible: false,
            fee: 0,
            distance: distanceKm,
            reason: `El pedido mínimo es $${venue.deliveryConfig.minOrderAmount}.`
        };
    }

    // 5. Check Free Delivery Threshold
    if (venue.deliveryConfig.freeDeliveryThreshold && orderTotal >= venue.deliveryConfig.freeDeliveryThreshold) {
        return { possible: true, fee: 0, distance: distanceKm };
    }

    // 6. Calculate Fee
    // Formula: Base Fee + (PricePerKm * Distance)
    // Note: Usually base fee covers the first X km, but here let's keep it simple or strictly additive as per user request for "ranges and logic". 
    // Let's implement a standard Base + Distance model.

    const rawFee = venue.deliveryConfig.baseFee + (venue.deliveryConfig.pricePerKm * distanceKm);
    const clampedFee = Math.max(0, Math.min(25000, Math.ceil(rawFee / 100) * 100));

    return { possible: true, fee: clampedFee, distance: distanceKm };
};
