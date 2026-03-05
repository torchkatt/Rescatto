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
    const orderId = payload.data?.orderId;
    const notificationOptions = {
        body: payload.notification?.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { orderId }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Deep linking: al hacer clic en la notificación, abrir/enfocar la app y navegar a la orden
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const orderId = event.notification.data?.orderId;
    const targetPath = orderId
        ? `/#/app/orders?highlight=${orderId}`
        : '/#/app/orders';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si ya hay una ventana abierta de la app, enfocarla y enviarle el orderId
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'NOTIFICATION_CLICK', orderId });
                    return;
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            return clients.openWindow(targetPath);
        })
    );
});
