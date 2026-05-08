import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { getRemoteConfig } from 'firebase/remote-config';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { logger } from '../utils/logger';

// Firebase configuration from environment variables
const firebaseConfig: Record<string, string> = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Solo incluir measurementId si está configurado — evita cargar gtag con id=undefined
if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    firebaseConfig.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
 
// Initialize Analytics — solo si measurementId está configurado
export const analytics = typeof window !== 'undefined' && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
    ? getAnalytics(app)
    : null;

// Initialize Firebase App Check (reCAPTCHA v3) to prevent backend abuse
// In local development, you need to set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`
// before initializing firebase to test properly without a real key.
export const appCheck = typeof window !== 'undefined' && import.meta.env.VITE_RECAPTCHA_V3_KEY
    ? initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_V3_KEY),
        isTokenAutoRefreshEnabled: true,
    })
    : null;

// Initialize Cloud Firestore con WebSocket para evitar el spinner infinito del navegador.
// experimentalAutoDetectLongPolling: detecta si WebSocket está disponible y lo prefiere
// sobre HTTP long-polling (que mantiene el tab en estado "cargando" indefinidamente).
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
});

// Initialize Cloud Functions and get a reference to the service
export const functions = getFunctions(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
// Se envuelve en try-catch porque en algunos navegadores estáticos o PWA no compatibles podría arrojar error.
export const messaging = typeof window !== 'undefined' ? (async () => {
    try {
        return getMessaging(app);
    } catch (error) {
        logger.warn('Firebase Messaging no es soportado en este navegador/entorno:', error);
        return null;
    }
})() : null;

// Initialize Remote Config
export const remoteConfig = typeof window !== 'undefined' ? getRemoteConfig(app) : null;
if (remoteConfig) {
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour
    remoteConfig.defaultConfig = {
        'enable_rescatto_pass': true,
        'enable_ai_predictions': true,
        'enable_referrals_v2': true,
        'maintenance_mode': false
    };
}

export default app;
