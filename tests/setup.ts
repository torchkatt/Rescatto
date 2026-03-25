import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill localStorage for test environments that don't provide it natively
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock Firebase modules globally - avoids real network calls in tests
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
  db: {},
  functions: {},
  storage: {},
  default: {},
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  FacebookAuthProvider: vi.fn(),
  OAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendEmailVerification: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: class FakeTimestamp {
    static now() { return new FakeTimestamp(); }
    toDate() { return new Date(); }
  },
  increment: vi.fn((n) => n),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  limit: vi.fn(),
  Unsubscribe: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
}));

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: true,
    PROD: false,
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
    VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    VITE_FIREBASE_APP_ID: '1:123:web:abc',
    VITE_WOMPI_PUBLIC_KEY: 'pub_test_mock',
    VITE_API_URL: 'http://localhost:5001/test/us-central1',
  },
  writable: true,
});

// Silence console.error in tests (optional: remove to debug)
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});
