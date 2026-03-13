import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig } from './firebase';
import { logger } from '../utils/logger';

export const featureFlagService = {
    /**
     * Sincroniza las banderas con el servidor.
     * Debe llamarse al inicio de la aplicación.
     */
    init: async () => {
        if (!remoteConfig) return;
        try {
            remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
            await fetchAndActivate(remoteConfig);
            logger.log('✅ Banderas de funcionalidad sincronizadas');
        } catch (error: any) {
            // Silence common 403/Forbidden errors as we have local defaults
            const isForbidden = error.code === 'remoteconfig/fetch-status' || 
                               error.message?.includes('403') || 
                               error.message?.includes('Forbidden');
            
            if (isForbidden) {
                // Log as a single quiet warning instead of a red error
                logger.warn('⚠️ Remote Config pendiente de configuración en consola. Usando valores locales.');
            } else {
                logger.error('❌ Error crítico en Remote Config:', error);
            }
        }
    },

    /**
     * Obtiene el valor de una bandera de funcionalidad.
     */
    isEnabled: (flag: string): boolean => {
        if (!remoteConfig) return true; // Default to true if config fails
        try {
            return getValue(remoteConfig, flag).asBoolean();
        } catch (error) {
            return true;
        }
    },

    /**
     * Obtiene un valor de cadena (ej: texto de mantenimiento).
     */
    getString: (flag: string): string => {
        if (!remoteConfig) return '';
        return getValue(remoteConfig, flag).asString();
    }
};
