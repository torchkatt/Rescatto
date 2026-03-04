import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Recuperar Variables de Entorno en un Worker puede ser complejo según el bundler.
// Vite PWA inyecta este script así que usaremos variables globales inyectadas o hardcode string.
// Lo más seguro es que el usuario las suministre reemplazando estas o usando el public/firebase-messaging-sw.js nativo.
// Por favor reemplazar con la config en PROD.

const firebaseConfig = {
    apiKey: self.__VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: self.__VITE_FIREBASE_AUTH_DOMAIN || "YOUR_DOMAIN",
    projectId: self.__VITE_FIREBASE_PROJECT_ID || "rescatto-app",
    messagingSenderId: self.__VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_ID",
    appId: self.__VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || 'Notificación de Rescatto';
    const notificationOptions = {
        body: payload.notification?.body,
        icon: '/pwa-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
