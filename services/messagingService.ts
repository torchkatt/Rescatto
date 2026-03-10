import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';

// VAPID key (certificado Web Push).
// Obtenerlo en: Firebase Console → Configuración del proyecto → Cloud Messaging → Certificados Web Push.
// Si no se configura, Firebase usa el key por defecto del proyecto (funciona para la mayoría de casos).
const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

export const messagingService = {
    /**
     * Solicita permiso al usuario para enviar notificaciones Push (Browser Modal).
     * Si acepta, recupera el FCM Token y lo vincula al perfil del usuario en Firestore.
     */
    requestPermissionAndSaveToken: async (userId: string) => {
        if (!VAPID_KEY) {
            logger.debug('FCM: VITE_FIREBASE_VAPID_KEY no configurado, omitiendo registro de token.');
            return null;
        }
        try {
            logger.log('🔑 Solicitando permisos de notificación...');
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                logger.log('🔔 Permiso concedido.');
                const msgInstance = await messaging;
                if (!msgInstance) {
                    logger.warn('⚠️ Messaging no inicializado (no soportado).');
                    return null;
                }

                const currentToken = await getToken(msgInstance, { vapidKey: VAPID_KEY });

                if (currentToken) {
                    logger.log('📲 FCM Token obtenido:', currentToken);
                    // Guardar Token en DB atado al usuario
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        fcmToken: currentToken,
                        lastTokenUpdate: new Date().toISOString()
                    });
                    return currentToken;
                } else {
                    logger.warn('⚠️ No se obtuvo Token de Registro. Solicita permisos de interfaz.');
                    return null;
                }
            } else {
                logger.warn('🚫 Permiso de notificaciones denegado o cerrado.');
                return null;
            }
        } catch (error) {
            logger.error('Error al solicitar permiso o token FCM:', error);
            return null;
        }
    },

    /**
     * Escucha activamente (en Foreground) si llega una notificación
     * mientras el usuario tiene la App Abierta.
     * Retorna una función de cleanup para cancelar el listener.
     */
    onForegroundMessage: (callback: (payload: any) => void): (() => void) => {
        let unsubscribe: (() => void) | null = null;
        if (messaging) {
            messaging.then((msgInstance) => {
                if (msgInstance) {
                    unsubscribe = onMessage(msgInstance, (payload) => {
                        logger.log('📩 Notificación recibida en Foreground:', payload);
                        callback(payload);
                    });
                }
            });
        }
        return () => { unsubscribe?.(); };
    }
};
