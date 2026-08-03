import { getFirebaseAuth, getFirestoreDb, getFirestoreModule } from './config';
import type { User } from '@/types';

// Type-only imports — erased at compile time
import type { UserCredential } from 'firebase/auth';

function generateReferralCode(uid: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hash = uid.slice(0, 4).toUpperCase();
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GERK-${hash}${suffix}`;
}

async function createUserProfile(
  credential: UserCredential,
  displayName?: string,
  referredBy?: string
): Promise<void> {
  const { doc, setDoc, getDoc, serverTimestamp } = getFirestoreModule();

  const { uid, email } = credential.user;
  const userRef = doc(getFirestoreDb(), 'users', uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    const referralCode = generateReferralCode(uid);
    await setDoc(userRef, {
      uid,
      email,
      displayName: displayName ?? credential.user.displayName ?? 'Anonymous',
      role: 'user',
      referralCode,
      referredBy: referredBy ?? null,
      referralCount: 0,
      totalEarnings: 0,
      photoURL: credential.user.photoURL ?? null,
      createdAt: serverTimestamp(),
    });
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  referralCode?: string
): Promise<UserCredential> {
  const { createUserWithEmailAndPassword } = require('firebase/auth') as typeof import('firebase/auth');
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await createUserProfile(credential, displayName, referralCode);
  const idToken = await credential.user.getIdToken();
  await setSessionCookie(idToken);
  return credential;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const { signInWithEmailAndPassword } = require('firebase/auth') as typeof import('firebase/auth');
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const idToken = await credential.user.getIdToken();
  await setSessionCookie(idToken);
  return credential;
}

export async function signInWithGoogle(referralCode?: string): Promise<void> {
  const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = require('firebase/auth') as typeof import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  try {
    const credential = await signInWithPopup(getFirebaseAuth(), provider);
    await createUserProfile(credential, undefined, referralCode ?? undefined);

    const idToken = await credential.user.getIdToken();
    await setSessionCookie(idToken);
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
      if (referralCode) sessionStorage.setItem('gerkink_referral', referralCode);
      await signInWithRedirect(getFirebaseAuth(), provider);
      return;
    }
    throw err;
  }
}

/**
 * Call this on app init to handle the redirect result after Google sign-in.
 * Returns the credential if a redirect just completed, or null otherwise.
 */
export async function handleGoogleRedirectResult(): Promise<void> {
  const { getRedirectResult } = require('firebase/auth') as typeof import('firebase/auth');

  try {
    const result = await getRedirectResult(getFirebaseAuth());
    if (result) {
      const referralCode = sessionStorage.getItem('gerkink_referral');
      sessionStorage.removeItem('gerkink_referral');
      await createUserProfile(result, undefined, referralCode ?? undefined);

      // Explicitly set session cookie before redirecting
      const idToken = await result.user.getIdToken();
      await setSessionCookie(idToken);

      // Navigate to the intended destination after sign-in
      const redirect = sessionStorage.getItem('gerkink_redirect') ?? '/';
      sessionStorage.removeItem('gerkink_redirect');
      window.location.replace(redirect);
    }
  } catch (err) {
    console.error('Error handling Google redirect result:', err);
    sessionStorage.removeItem('gerkink_redirect');
    sessionStorage.removeItem('gerkink_referral');
  }
}

export async function signOut(): Promise<void> {
  const { signOut: firebaseSignOut } = require('firebase/auth') as typeof import('firebase/auth');
  await firebaseSignOut(getFirebaseAuth());
  // Clear session cookie via API (also revokes refresh tokens)
  // Fire-and-forget with keepalive so page navigation/redirect doesn't abort it
  fetch('/api/auth/session', { method: 'DELETE', keepalive: true }).catch((err) => {
    console.error('Error clearing session cookie on logout:', err);
  });
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const { doc, getDoc } = getFirestoreModule();
  const snap = await getDoc(doc(getFirestoreDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as unknown as User;
}

export async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function setSessionCookie(idToken: string): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    keepalive: true, // Keep alive so page navigation/redirect doesn't abort it
  });
}

