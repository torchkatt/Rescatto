import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { messaging, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';

// Reemplazar con el KEY correspondiente de la consola de Firebase > Configuración del Proyecto > Cloud Messaging > Certificados Web Push
// Es crucial para recibir push notifications en la web (VAPID KEY).
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'TU_VAPID_KEY_AQUI';

export const messagingService = {
    /**
     * Solicita permiso al usuario para enviar notificaciones Push (Browser Modal).
     * Si acepta, recupera el FCM Token y lo vincula al perfil del usuario en Firestore.
     */
    requestPermissionAndSaveToken: async (userId: string) => {
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

                // Obtener Token
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
     */
    onForegroundMessage: (callback: (payload: any) => void) => {
        messaging.then((msgInstance) => {
            if (msgInstance) {
                onMessage(msgInstance, (payload) => {
                    logger.log('📩 Notificación recibida en Foreground:', payload);
                    callback(payload);
                });
            }
        });
    }
};
