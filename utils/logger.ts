/**
 * Centralized logger utility
 * Respects development/production environment
 * Prevents console.log spam in production
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log general information (development only)
     */
    log: (...args: any[]): void => {
        if (isDev) console.log(...args);
    },

    /**
     * Log errors (always shown)
     */
    error: (...args: any[]): void => {
        console.error(...args);
    },

    /**
     * Log warnings (development only)
     */
    warn: (...args: any[]): void => {
        if (isDev) console.warn(...args);
    },

    /**
     * Log informational messages (development only)
     */
    info: (...args: any[]): void => {
        if (isDev) console.info(...args);
    },

    /**
     * Log debug information (development only)
     */
    debug: (...args: any[]): void => {
        if (isDev) console.debug(...args);
    },
};
