import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { sendPayoutStatusEmail } from '@/lib/email/sender';
import { z } from 'zod';

const actionSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional().nullable(),
});

async function requireAdmin(): Promise<{ uid: string } | { error: NextResponse }> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 }) };
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded?.admin) {
      return { error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }) };
    }
    return { uid: decoded.uid };
  } catch (err) {
    return { error: NextResponse.json({ error: 'Unauthorized: Invalid or revoked session' }, { status: 401 }) };
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    // 1. Pending queue (with index-missing fallback)
    let pendingDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const snap = await adminDb
        .collection('payout_requests')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(100)
        .get();
      pendingDocs = snap.docs;
    } catch (idxErr: any) {
      console.warn('[admin/payouts] pending query orderBy failed, falling back to unordered query:', idxErr?.message);
      const snap = await adminDb
        .collection('payout_requests')
        .where('status', '==', 'pending')
        .limit(100)
        .get();
      pendingDocs = snap.docs;
    }

    // 2. Processed queue (with index-missing fallback)
    let processedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const snap = await adminDb
        .collection('payout_requests')
        .where('status', 'in', ['paid_manual', 'rejected', 'processed'])
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .get();
      processedDocs = snap.docs;
    } catch (idxErr: any) {
      console.warn('[admin/payouts] processed query orderBy failed, falling back to unordered query:', idxErr?.message);
      try {
        const snap = await adminDb
          .collection('payout_requests')
          .where('status', 'in', ['paid_manual', 'rejected', 'processed'])
          .limit(20)
          .get();
        processedDocs = snap.docs;
      } catch {
        processedDocs = [];
      }
    }

    const serialize = (d: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
    });

    const pending = pendingDocs.map(serialize);
    const processed = processedDocs.map(serialize);

    // In-memory sort fallback
    pending.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    processed.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return NextResponse.json({
      pending,
      processed,
    });
  } catch (err) {
    console.error('[admin/payouts] Failed to list payout requests:', err);
    return NextResponse.json({ error: 'Failed to list payout requests', pending: [], processed: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'admin_payout_action', { limit: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { requestId, action, adminNote } = parsed.data;

  try {
    const requestRef = adminDb.collection('payout_requests').doc(requestId);

    // Atomic status transition — only pending requests can be decided once.
    const result = await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(requestRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data()!;
      if (data.status !== 'pending') throw new Error(`BAD_STATUS:${data.status}`);

      if (action === 'approve') {
        transaction.update(requestRef, {
          status: 'paid_manual',
          paidBy: auth.uid,
          paidAt: FieldValue.serverTimestamp(),
          adminNote: adminNote || null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { amount: Number(data.amount) || 0, userEmail: String(data.userEmail || ''), userName: String(data.userName || ''), method: String(data.method || '') };
      }

      // reject: Firestore requires all reads to execute before any writes.
      // Read linked referrals first before executing updates.
      const linked = await transaction.get(
        adminDb.collection('referrals')
          .where('affiliateUid', '==', data.userId)
          .where('payoutDetail', '==', requestId)
          .where('status', '==', 'claimed')
          .limit(500)
      );

      transaction.update(requestRef, {
        status: 'rejected',
        rejectedBy: auth.uid,
        rejectedAt: FieldValue.serverTimestamp(),
        adminNote: adminNote || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Restore the affiliate's claimable balance: referrals consumed by this
      // request go back to eligible_for_claim so they can re-claim with fixed details.
      linked.forEach((doc) => {
        transaction.update(doc.ref, {
          status: 'eligible_for_claim',
          payoutMethod: FieldValue.delete(),
          payoutDetail: FieldValue.delete(),
        });
      });

      return { amount: Number(data.amount) || 0, userEmail: String(data.userEmail || ''), userName: String(data.userName || ''), method: String(data.method || '') };
    });

    // Notify the affiliate (background — don't block the admin response).
    sendPayoutStatusEmail({
      userEmail: result.userEmail,
      userName: result.userName,
      amount: result.amount,
      method: result.method,
      approved: action === 'approve',
      adminNote: adminNote || undefined,
    }).catch((err) => console.error('[admin/payouts] Status email failed:', err));

    return NextResponse.json({
      success: true,
      requestId,
      status: action === 'approve' ? 'paid_manual' : 'rejected',
      restoredBalance: action === 'reject',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 });
    }
    if (msg.startsWith('BAD_STATUS:')) {
      return NextResponse.json({ error: `Request already processed (${msg.split(':')[1]})` }, { status: 409 });
    }
    console.error('[admin/payouts] Action failed:', err);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }
}
