import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';

/**
 * POST /api/auth/session
 * Creates an HTTP-only session cookie from a Firebase ID token.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'auth_session', { limit: 60, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { idToken } = (await request.json()) as { idToken: string };

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Verify the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Check if user is admin
    const isAdmin = decoded.admin === true;

    // Create session cookie (5 day expiry)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const cookieStore = await cookies();

    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    // Set admin indicator cookie (httpOnly for security)
    cookieStore.set('is_admin', String(isAdmin), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Session creation error:', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

/**
 * DELETE /api/auth/session
 * Revokes and clears the session cookie.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Cookie invalid — still clear it
    }
  }

  // Explicitly clear cookies with path '/'
  cookieStore.set('session', '', { maxAge: 0, path: '/' });
  cookieStore.set('is_admin', '', { maxAge: 0, path: '/' });
  return NextResponse.json({ status: 'ok' });
}
