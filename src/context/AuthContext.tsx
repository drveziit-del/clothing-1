'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { getFirebaseAuth, getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import { setSessionCookie, handleGoogleRedirectResult } from '@/lib/firebase/auth';
import type { User } from '@/types';

// Type-only import — erased at compile time, doesn't trigger SDK evaluation
import type { User as FirebaseUser } from 'firebase/auth';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isLoggedInRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubAuth: (() => void) | undefined;

    async function initAuth() {
      try {
        const authInstance = getFirebaseAuth();
        if (!authInstance) {
          setLoading(false);
          return;
        }

        const { onIdTokenChanged } = require('firebase/auth') as typeof import('firebase/auth');

        // Process any pending Google redirect result (creates user profile if new)
        await handleGoogleRedirectResult();

        if (!active) return;

        unsubAuth = onIdTokenChanged(authInstance, async (fbUser) => {
          if (!active) return;
          const wasLoggedIn = isLoggedInRef.current;
          isLoggedInRef.current = !!fbUser;

          setFirebaseUser(fbUser);

          if (!fbUser) {
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            fetch('/api/auth/session', { method: 'DELETE', keepalive: true }).catch((err) => {
              console.error('Error clearing session cookie on logout:', err);
            });
            if (wasLoggedIn) {
              window.location.href = '/auth/login';
            }
            return;
          }

          // Sync session cookie
          try {
            const idToken = await fbUser.getIdToken();
            await setSessionCookie(idToken);

            if (!active) return;

            // Check admin claim
            const tokenResult = await fbUser.getIdTokenResult();
            setIsAdmin(tokenResult.claims['admin'] === true);
          } catch (err) {
            console.error('Error in onIdTokenChanged cookie sync:', err);
          }

          setLoading(false);
        });
      } catch (err) {
        console.warn('AuthContext initAuth error:', err);
        if (active) setLoading(false);
      }
    }

    initAuth();

    return () => {
      active = false;
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Subscribe to Firestore user profile when logged in
  useEffect(() => {
    if (!firebaseUser) { setUser(null); return; }

    try {
      const db = getFirestoreDb();
      if (!db) return;

      const { doc, onSnapshot } = getFirestoreModule();

      const unsub = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setUser({ id: snap.id, ...snap.data() } as unknown as User);
          }
        },
        (err) => {
          console.warn('User profile snapshot error:', err);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('User profile effect error:', err);
    }
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

