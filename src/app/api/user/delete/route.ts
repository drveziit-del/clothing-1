import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { executeAccountDeletion } from '@/lib/account/deletion';

/**
 * DELETE /api/user/delete (Legacy Route Alias)
 * Forwards to hardened account deletion engine with full session verification,
 * storage cleanup, anonymization, and session revocation.
 */
export async function DELETE(request: NextRequest) {
  if (isRateLimited(request, 'account_delete', { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many deletion attempts. Please try again later.' },
      { status: 429 }
    );
  }

  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // If a request body with confirmation or idToken is supplied, validate it
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text);
      if (body.uid && body.uid !== uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (body.confirmation && body.confirmation !== 'DELETE') {
        return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  const result = await executeAccountDeletion(uid);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to delete account.' },
      { status: result.statusCode || 500 }
    );
  }

  // Clear HTTP-only session cookies
  cookieStore.set('session', '', { maxAge: 0, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  cookieStore.set('is_admin', '', { maxAge: 0, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });

  return NextResponse.json({
    status: 'account_and_data_deleted',
    message: 'Account and associated personal data successfully deleted.',
  });
}
