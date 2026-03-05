import { Product } from '../types';

type ProductLike = Pick<Product, 'quantity' | 'availableUntil'>;

export const isProductExpired = (availableUntil?: string, nowMs: number = Date.now()): boolean => {
    if (!availableUntil) return false;
    const expiresAt = new Date(availableUntil).getTime();
    if (!Number.isFinite(expiresAt)) return false;
    return expiresAt <= nowMs;
};

export const isProductAvailable = (product: ProductLike, nowMs: number = Date.now()): boolean => {
    return (Number(product.quantity) || 0) > 0 && !isProductExpired(product.availableUntil, nowMs);
};

export const getAvailabilityMessage = (availableUntil?: string): string => {
    if (isProductExpired(availableUntil)) return 'Producto expirado';
    return 'No disponible';
};
