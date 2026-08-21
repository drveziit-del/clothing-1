'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import { signUpSchema } from '@/lib/utils/validation';
import { SIGNUP_ROASTS } from '@/lib/utils/roasts';
import styles from '../login/page.module.css';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useRoast();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roast, setRoast] = useState(SIGNUP_ROASTS[0]);
  const [refCode, setRefCode] = useState('');

  const redirect = searchParams.get('redirect') ?? '/';

  useEffect(() => {
    if (!authLoading && firebaseUser && !loading && !googleLoading) {
      window.location.href = redirect;
    }
  }, [firebaseUser, authLoading, loading, googleLoading, redirect]);

  useEffect(() => {
    // Pick random roast on client only (avoids hydration mismatch)
    setRoast(SIGNUP_ROASTS[Math.floor(Math.random() * SIGNUP_ROASTS.length)]);

    // Read referral code from cookie
    const match = document.cookie.match(/referral=([^;]+)/);
    if (match) setRefCode(decodeURIComponent(match[1]));

    // Also check URL param
    const ref = searchParams.get('ref');
    if (ref) {
      setRefCode(ref);
      // Store in cookie for 30 days
      const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `referral=${encodeURIComponent(ref)}; expires=${exp}; path=/; SameSite=Lax`;
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const raw = {
      email:       fd.get('email') as string,
      password:    fd.get('password') as string,
      displayName: fd.get('displayName') as string,
      referralCode: refCode || undefined,
    };

    const result = signUpSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      await signUpWithEmail(result.data.email, result.data.password, result.data.displayName, result.data.referralCode);
      toast('Account created. Your style era starts now.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('email-already-in-use')) {
        setErrors({ form: 'That email already exists. Sign in instead.' });
      } else {
        setErrors({ form: 'Sign up failed. Even this process judges you.' });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle(refCode);
      window.location.href = redirect;
    } catch (err) {
      console.error('Google Sign-in Error:', err);
      toast('Google sign-up failed.', 'error');
      setGoogleLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>GERKINK</Link>
          <h1 className={styles.title}>Join</h1>
          <p className={styles.roast}>{roast}</p>
          {refCode && (
            <span className="tag tag-coral" style={{ width: 'fit-content' }}>
              Referral: {refCode}
            </span>
          )}
        </div>

        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className={`btn btn-secondary btn-full ${styles.googleBtn}`}
        >
          {googleLoading ? 'Connecting...' : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className={styles.divider}><span>or</span></div>

        <form onSubmit={handleSubmit} noValidate className={styles.form}>
          {errors.form && <p className={styles.formError}>{errors.form}</p>}

          <div>
            <label htmlFor="displayName" className="input-label">Name</label>
            <input id="displayName" name="displayName" type="text" autoComplete="name"
              className="input" placeholder="What do people call you?" />
            {errors.displayName && <span className={styles.fieldError}>{errors.displayName}</span>}
          </div>

          <div>
            <label htmlFor="email" className="input-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email"
              className="input" placeholder="you@example.com" />
            {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
          </div>

          <div>
            <label htmlFor="password" className="input-label">Password</label>
            <div className={styles.inputWrap}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="input"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already in?{' '}
          <Link href={`/auth/login${redirect !== '/' ? `?redirect=${redirect}` : ''}`}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <SignupContent />
    </Suspense>
  );
}
