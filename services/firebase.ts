import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

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
        console.warn('Firebase Messaging no es soportado en este navegador/entorno:', error);
        return null;
    }
})() : null;

export default app;
