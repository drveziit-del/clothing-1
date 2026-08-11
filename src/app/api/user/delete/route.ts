import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

/**
 * DELETE /api/user/delete
 * Account Deletion Flow: Anonymizes and deletes the user's personal data from Firestore,
 * deletes their secure payout details, revokes session cookies, and deletes their Firebase Auth account.
 */
export async function DELETE(request: NextRequest) {
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

  try {
    const batch = adminDb.batch();

    // 1. Delete user's secure payout details subcollection doc
    const securePayoutRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('secure_payout_details')
      .doc('payout');
    batch.delete(securePayoutRef);

    // 2. Delete main user document in Firestore
    const userRef = adminDb.collection('users').doc(uid);
    batch.delete(userRef);

    await batch.commit();

    // 3. Delete Firebase Auth user account
    await adminAuth.deleteUser(uid);

    // 4. Clear HTTP-only session cookies
    cookieStore.set('session', '', { maxAge: 0, path: '/' });
    cookieStore.set('is_admin', '', { maxAge: 0, path: '/' });

    return NextResponse.json({
      status: 'ok',
      message: 'Account and associated personal data successfully deleted.',
    });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 });
  }
}
