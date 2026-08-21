/**
 * Firebase Client SDK — Lazy initialization.
 *
 * Uses JS Proxy + dynamic import() to ensure the Firebase SDK modules
 * (which internally reference `location`) are never evaluated during
 * server-side rendering, preventing ReferenceError on the server.
 *
 * Consumers import `auth`, `db`, `storage` as before — the Proxy
 * transparently loads and initialises everything on first property access.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Cache resolved instances so we only import() once.
let _app: any;
let _auth: any;
let _db: any;
let _storage: any;

function ensureApp() {
  if (!_app) {
    try {
      const { initializeApp, getApps, getApp } = require('firebase/app');
      _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    } catch (err) {
      console.warn('Firebase initializeApp error:', err);
      return null;
    }
  }
  return _app;
}

function ensureAuth() {
  if (!_auth) {
    try {
      const app = ensureApp();
      if (!app) return null;
      const { getAuth } = require('firebase/auth');
      _auth = getAuth(app);
    } catch (err) {
      console.warn('Firebase getAuth error:', err);
      return null;
    }
  }
  return _auth;
}

function ensureDb() {
  if (!_db) {
    try {
      const app = ensureApp();
      if (!app) return null;
      const { initializeFirestore, getFirestore } = getFirestoreModule();
      try {
        _db = initializeFirestore(app, {
          experimentalForceLongPolling: true,
        });
      } catch {
        _db = getFirestore(app);
      }
    } catch (err) {
      console.warn('Firebase getFirestore error:', err);
      return null;
    }
  }
  return _db;
}

function ensureStorage() {
  if (!_storage) {
    try {
      const app = ensureApp();
      if (!app) return null;
      const { getStorage } = require('firebase/storage');
      _storage = getStorage(app);
    } catch (err) {
      console.warn('Firebase getStorage error:', err);
      return null;
    }
  }
  return _storage;
}

const isServer = typeof window === 'undefined';

function createLazyProxy<T extends object>(initializer: () => T, name: string): T {
  return new Proxy({} as any, {
    get(target, prop) {
      if (
        typeof prop === 'symbol' ||
        ['$$typeof', 'then', 'toJSON', 'default', 'constructor', '__esModule'].includes(prop as string)
      ) {
        return (target as any)[prop];
      }

      if (isServer) {
        if (prop === 'currentUser') return null;
        return undefined;
      }

      const instance = initializer();
      return (instance as any)[prop];
    },
  }) as T;
}

// Lazy proxy — the require() calls only execute on first property access,
// which only happens inside `useEffect` or event handlers on the client.
export const auth: import('firebase/auth').Auth = createLazyProxy<import('firebase/auth').Auth>(ensureAuth, 'auth');

export const db: import('firebase/firestore').Firestore = createLazyProxy<import('firebase/firestore').Firestore>(ensureDb, 'db');

export const storage: import('firebase/storage').FirebaseStorage = createLazyProxy<import('firebase/storage').FirebaseStorage>(ensureStorage, 'storage');

// Export getters for the real (unwrapped) instances.
// Use these when passing to Firestore functions like doc(), collection()
// which do internal instanceof checks that Proxy can't satisfy.
export const getFirestoreDb = ensureDb;
export const getFirebaseAuth = ensureAuth;
export const getFirebaseStorage = ensureStorage;

export default createLazyProxy<any>(ensureApp, 'app');

// Helper to ensure we always get the exact same module instance
// across hot reloads and different files to prevent instanceof errors
export function getFirestoreModule() {
  return require('firebase/firestore') as typeof import('firebase/firestore');
}

export function getStorageModule() {
  return require('firebase/storage') as typeof import('firebase/storage');
}
