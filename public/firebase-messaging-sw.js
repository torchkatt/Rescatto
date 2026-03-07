// ============================================================
// firebase-messaging-sw.js — Rescatto Push Notifications
//
// IMPORTANTE: Este archivo es un Service Worker clásico (no ES module).
// No tiene acceso a import.meta.env ni a node_modules.
// Usa importScripts con la API compat de Firebase por CDN.
//
// Las credenciales de Firebase son públicas (se exponen en el bundle
// de la app de todas formas) y pueden hardcodearse aquí con seguridad.
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyDwyx4xTIZbZQ9lXXLQ_D5Q9tTS30_vvMo',
    authDomain: 'rescatto-c8d2b.firebaseapp.com',
    projectId: 'rescatto-c8d2b',
    storageBucket: 'rescatto-c8d2b.firebasestorage.app',
    messagingSenderId: '929924964651',
    appId: '1:929924964651:web:7d0937f22a3f62eb5a256e',
});

const messaging = firebase.messaging();

// Maneja notificaciones recibidas mientras la app está en background o cerrada.
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'Rescatto';
    const orderId = payload.data?.orderId || null;

    self.registration.showNotification(notificationTitle, {
        body: payload.notification?.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { orderId },
    });
});

// Deep linking: al tocar la notificación, navegar a la orden correspondiente.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const orderId = event.notification.data?.orderId;
    const targetPath = orderId
        ? `/#/app/orders?highlight=${orderId}`
        : '/#/app/orders';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si la app ya está abierta: enfocarla y comunicarle el orderId por postMessage.
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if (orderId) {
                        client.postMessage({ type: 'NOTIFICATION_CLICK', orderId });
                    }
                    return;
                }
            }
            // Si no hay ventana abierta: abrir una nueva en la ruta correcta.
            return clients.openWindow(targetPath);
        })
    );
});
