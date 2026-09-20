import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { executeAccountDeletion } from '@/lib/account/deletion';

/**
 * DELETE /api/account
 * Secure customer self-deletion endpoint with reauthentication, rate limiting,
 * and comprehensive data retention/anonymization discipline.
 */
export async function DELETE(request: NextRequest) {
  // 1. Abuse Protection: Rate limit to 5 destructive requests per 15 minutes per IP
  if (isRateLimited(request, 'account_delete', { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many deletion attempts. Please try again later.' },
      { status: 429 }
    );
  }

  // 2. Resolve Authenticated Session Cookie
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Active authentication session required.' },
      { status: 401 }
    );
  }

  let sessionUid: string;
  try {
    const decodedSession = await adminAuth.verifySessionCookie(session, true);
    sessionUid = decodedSession.uid;
  } catch (sessionErr: any) {
    console.warn('[api/account/delete] Session verification failed:', sessionErr?.message);
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or expired session.' },
      { status: 401 }
    );
  }

  // 3. Parse Request Payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }

  // 4. Validate Typed Confirmation String
  if (!body || typeof body !== 'object' || body.confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: 'Invalid confirmation string. You must explicitly type "DELETE" to confirm.' },
      { status: 400 }
    );
  }

  // 5. IDOR & Authority Guard: Client cannot specify or forge another user's UID
  if (body.uid && body.uid !== sessionUid) {
    return NextResponse.json(
      { error: 'Forbidden: You cannot request deletion for another user account.' },
      { status: 403 }
    );
  }

  // 6. Cryptographic Reauthentication Verification via Firebase ID Token
  const idToken = body.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json(
      { error: 'Reauthentication required. Fresh ID token missing.' },
      { status: 401 }
    );
  }

  let decodedIdToken: any;
  try {
    decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
  } catch (tokenErr: any) {
    console.warn('[api/account/delete] ID token verification failed:', tokenErr?.message);
    return NextResponse.json(
      { error: 'Forbidden: Invalid reauthentication token.' },
      { status: 403 }
    );
  }

  // Ensure ID token matches the authenticated session user
  if (decodedIdToken.uid !== sessionUid) {
    return NextResponse.json(
      { error: 'Forbidden: Reauthentication credentials do not match authenticated session.' },
      { status: 403 }
    );
  }

  // Ensure recent authentication (within last 5 minutes = 300 seconds)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const authTime = decodedIdToken.auth_time;
  if (!authTime || (nowSeconds - authTime > 300)) {
    return NextResponse.json(
      { error: 'Reauthentication expired. Please reauthenticate and try again within 5 minutes.' },
      { status: 403 }
    );
  }

  // 7. Execute Account Deletion Workflow
  const result = await executeAccountDeletion(sessionUid);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to delete account.' },
      { status: result.statusCode || 500 }
    );
  }

  // 8. Invalidate HTTP-only Session Cookies
  cookieStore.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  cookieStore.set('is_admin', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return NextResponse.json({
    status: 'ok',
    message: 'Your account and personal data have been permanently deleted.',
  });
}
