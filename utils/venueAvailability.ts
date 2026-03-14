import { Venue } from '../types';

/**
 * Determina si un venue está abierto ahora.
 * Soporta cierres post-medianoche (ej: closingTime "02:00" = cierra mañana).
 * Sin openingTime, asume apertura a las 06:00.
 */
export const isVenueOpen = (venue: Pick<Venue, 'closingTime'>): boolean => {
    if (!venue.closingTime) return true; // sin dato = asumimos abierto

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [closingH, closingM] = venue.closingTime.split(':').map(Number);
    const closingMinutes = closingH * 60 + closingM;

    const OPENING_MINUTES = 6 * 60; // 06:00 default

    // Caso post-medianoche: closingTime < 06:00 (ej: "02:00")
    // Significa que cierra al día siguiente a esa hora
    if (closingMinutes < OPENING_MINUTES) {
        // Abierto si: ahora >= apertura (06:00) OR ahora < cierre (02:00)
        return currentMinutes >= OPENING_MINUTES || currentMinutes < closingMinutes;
    }

    // Caso normal: closingTime >= 06:00
    // Abierto si: ahora >= apertura AND ahora < cierre
    return currentMinutes >= OPENING_MINUTES && currentMinutes < closingMinutes;
};
