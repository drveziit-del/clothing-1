import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

/**
 * POST /api/admin/purge
 * Admin-only endpoint to purge test/development users and their associated data.
 *
 * Body: { emails: string[] }
 *
 * This will:
 * 1. Delete Firebase Auth accounts for each email
 * 2. Delete Firestore documents across: users, orders, referrals, coupons, milestones, payout_requests
 */

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return { error: 'Unauthorized', status: 401 };

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) return { error: 'Forbidden', status: 403 };
    return { uid: decoded.uid };
  } catch {
    return { error: 'Invalid session', status: 401 };
  }
}

async function deleteCollectionDocs(
  collectionName: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await adminDb
    .collection(collectionName)
    .where(field, '==', value)
    .get();

  if (snap.empty) return 0;

  const batch = adminDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

export async function POST(request: NextRequest) {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  let body: { emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { emails } = body;
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty array of emails to purge' }, { status: 400 });
  }

  // Safety: limit batch size to prevent accidental mass deletion
  if (emails.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 emails per purge request' }, { status: 400 });
  }

  const results: Array<{
    email: string;
    authDeleted: boolean;
    firestoreDeleted: Record<string, number>;
    error?: string;
  }> = [];

  for (const email of emails) {
    const result: (typeof results)[0] = {
      email,
      authDeleted: false,
      firestoreDeleted: {},
    };

    try {
      // 1. Find and delete Firebase Auth user
      let uid: string | null = null;
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
        await adminAuth.deleteUser(uid);
        result.authDeleted = true;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          result.error = 'Auth user not found (may already be deleted)';
        } else {
          throw err;
        }
      }

      // 2. Clean Firestore documents (by uid if found, otherwise skip)
      if (uid) {
        const collections = [
          { name: 'users', field: '__name__', directDoc: true },
          { name: 'orders', field: 'userId' },
          { name: 'referrals', field: 'affiliateUid' },
          { name: 'coupons', field: 'userId' },
          { name: 'milestones', field: 'affiliateUid' },
          { name: 'payout_requests', field: 'userId' },
        ];

        for (const col of collections) {
          if (col.directDoc) {
            // Delete secure payout details subcollection first
            const payoutSubcol = adminDb.collection('users').doc(uid).collection('secure_payout_details');
            const payoutSnap = await payoutSubcol.get();
            if (!payoutSnap.empty) {
              const subBatch = adminDb.batch();
              payoutSnap.docs.forEach((doc) => subBatch.delete(doc.ref));
              await subBatch.commit();
            }

            // Delete user document directly by UID
            const userDoc = adminDb.collection(col.name).doc(uid);
            const exists = await userDoc.get();
            if (exists.exists) {
              await userDoc.delete();
              result.firestoreDeleted[col.name] = 1;
            } else {
              result.firestoreDeleted[col.name] = 0;
            }
          } else {
            const count = await deleteCollectionDocs(col.name, col.field, uid);
            result.firestoreDeleted[col.name] = count;
          }
        }

        // Also clean referrals where this user was the referred person
        const referredCount = await deleteCollectionDocs('referrals', 'referredUid', uid);
        result.firestoreDeleted['referrals (as referred)'] = referredCount;
      }
    } catch (err: any) {
      result.error = err.message || 'Unknown error during purge';
      console.error(`Purge error for ${email}:`, err);
    }

    results.push(result);
  }

  return NextResponse.json({
    status: 'ok',
    message: `Purged ${results.filter((r) => r.authDeleted).length} of ${emails.length} accounts`,
    results,
  });
}
