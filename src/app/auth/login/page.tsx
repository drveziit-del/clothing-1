'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmail, signInWithGoogle } from '@/lib/firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import { loginSchema } from '@/lib/utils/validation';
import { LOGIN_ROASTS } from '@/lib/utils/roasts';
import styles from './page.module.css';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useRoast();
  const { firebaseUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Use first roast for SSR (deterministic), then pick random on client
  const [roast, setRoast] = useState(LOGIN_ROASTS[0]);

  useEffect(() => {
    setRoast(LOGIN_ROASTS[Math.floor(Math.random() * LOGIN_ROASTS.length)]);
  }, []);

  const redirect = searchParams.get('redirect') ?? '/';

  useEffect(() => {
    if (!authLoading && firebaseUser && !loading && !googleLoading) {
      router.replace(redirect);
    }
  }, [firebaseUser, authLoading, loading, googleLoading, redirect, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const raw = { email: fd.get('email') as string, password: fd.get('password') as string };

    const result = loginSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      await signInWithEmail(result.data.email, result.data.password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      if (msg.includes('wrong-password') || msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        setErrors({ form: 'Wrong email or password. Try harder.' });
      } else {
        setErrors({ form: 'Something went wrong. It\'s probably your fault.' });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const ref = document.cookie.match(/referral=([^;]+)/)?.[1];
      await signInWithGoogle(ref);
      router.replace(redirect);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setGoogleLoading(false);
        return;
      }
      console.error('Google Sign-in Error:', err);
      toast('Google sign-in failed. Manually type like it\'s 2010.', 'error');
      setGoogleLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>GERKINK</Link>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.roast}>{roast}</p>
        </div>

        {/* Google */}
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

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} noValidate className={styles.form}>
          {errors.form && <p className={styles.formError}>{errors.form}</p>}

          <div>
            <label htmlFor="email" className="input-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && <span id="email-error" className={styles.fieldError}>{errors.email}</span>}
          </div>

          <div>
            <label htmlFor="password" className="input-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              aria-describedby={errors.password ? 'pw-error' : undefined}
            />
            {errors.password && <span id="pw-error" className={styles.fieldError}>{errors.password}</span>}
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.footer}>
          No account?{' '}
          <Link href={`/auth/signup${redirect !== '/' ? `?redirect=${redirect}` : ''}`}>
            Join GERKINK
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <LoginContent />
    </Suspense>
  );
}
