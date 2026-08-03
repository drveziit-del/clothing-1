/**
 * Firebase Admin SDK — Server-side only.
 * Never import this in client components.
 */
import 'server-only';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId     = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'print-on-demand-895b7';
  const clientEmail   = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey    = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  // Running on Google Cloud (App Hosting / Cloud Run) — use Application Default Credentials
  return initializeApp({ projectId });
}

// Lazily instantiate so importing this module at build time (when env vars are absent)
// does not throw. Each export defers evaluation until a property is first accessed.
function lazySingleton<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      if (!instance) instance = factory();
      return (instance as Record<string | symbol, unknown>)[prop];
    },
  });
}

export const adminAuth = lazySingleton(() => getAuth(getAdminApp()));
export const adminDb   = lazySingleton(() => getFirestore(getAdminApp()));
