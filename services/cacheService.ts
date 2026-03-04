import { logger } from '../utils/logger';
/**
 * Servicio de caché local para optimizar lecturas de Firestore.
 * Almacena datos en localStorage con un tiempo de expiración (TTL).
 */

interface CacheItem<T> {
    data: T;
    expiry: number; // Timestamp de expiración
}

export const cacheService = {
    /**
     * Obtiene un valor de la caché si existe y no ha expirado.
     * @param key Clave de almacenamiento
     * @returns El dato almacenado o null si no existe/expiró
     */
    get: <T>(key: string): T | null => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            const item: CacheItem<T> = JSON.parse(itemStr);
            const now = new Date().getTime();

            // Verificar expiración
            if (now > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            return item.data;
        } catch (error) {
            logger.error('Error leyendo de caché:', error);
            return null;
        }
    },

    /**
     * Guarda un valor en la caché con un TTL (Time To Live).
     * @param key Clave de almacenamiento
     * @param data Datos a guardar
     * @param ttlMinutes Tiempo de vida en minutos
     */
    set: <T>(key: string, data: T, ttlMinutes: number): void => {
        try {
            const now = new Date().getTime();
            const item: CacheItem<T> = {
                data,
                expiry: now + (ttlMinutes * 60 * 1000),
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            logger.error('Error escribiendo en caché:', error);
        }
    },

    /**
     * Elimina una clave específica de la caché.
     * @param key Clave a eliminar
     */
    remove: (key: string): void => {
        localStorage.removeItem(key);
    },

    /**
     * Limpia todas las claves que empiecen por un prefijo.
     * @param prefix Prefijo de las claves a eliminar (ej: "venue_")
     */
    clearByPrefix: (prefix: string): void => {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        });
    }
};
