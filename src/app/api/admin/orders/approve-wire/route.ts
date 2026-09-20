import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { appendOrderHistory, enqueueOrderProcessing } from '@/lib/orchestrator/orderProcessor';
import z from 'zod';

const approveWireSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'admin_approve_wire', { limit: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // 1. Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let adminUid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    adminUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = approveWireSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { orderId, action, adminNote } = result.data;

  // 3. Process action in Firestore transaction
  try {
    const orderRef = adminDb.collection('orders').doc(orderId);

    let transitionWon = false;
    let isAlreadyApproved = false;
    let isAlreadyRejected = false;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(orderRef);
        if (!doc.exists) {
          throw new Error('ORDER_NOT_FOUND');
        }

        const data = doc.data()!;

        if (action === 'approve') {
          // If already paid and captured, treat as idempotent retry
          if (data.status === 'paid' && data.paymentCaptured === true) {
            isAlreadyApproved = true;
            return;
          }

          if (!['awaiting_wire_confirmation', 'pending'].includes(data.status)) {
            throw new Error(`INVALID_STATUS:${data.status}`);
          }

          transaction.update(orderRef, {
            status: 'paid',
            paymentCaptured: true,
            wireApprovedBy: adminUid,
            wireApprovedAt: FieldValue.serverTimestamp(),
            adminNote: adminNote || 'Wire transfer verified and approved by admin treasury desk.',
            updatedAt: FieldValue.serverTimestamp(),
          });
          transitionWon = true;
        } else {
          // Reject action
          if (data.status === 'cancelled') {
            isAlreadyRejected = true;
            return;
          }

          if (['paid', 'shipped', 'fulfilled', 'in_production'].includes(data.status)) {
            throw new Error(`INVALID_STATUS:${data.status}`);
          }

          transaction.update(orderRef, {
            status: 'cancelled',
            wireRejectedBy: adminUid,
            wireRejectedAt: FieldValue.serverTimestamp(),
            adminNote: adminNote || 'Wire transfer rejected or not received.',
            updatedAt: FieldValue.serverTimestamp(),
          });
          transitionWon = true;
        }
      });
    } catch (txErr: any) {
      if (txErr?.message === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      if (txErr?.message?.startsWith('INVALID_STATUS:')) {
        const st = txErr.message.replace('INVALID_STATUS:', '');
        return NextResponse.json({ error: `Cannot ${action} order with status: ${st}` }, { status: 409 });
      }
      throw txErr;
    }

    // Downstream side effects only executed by the winning transition
    if (action === 'approve') {
      if (isAlreadyApproved) {
        return NextResponse.json({
          success: true,
          orderId,
          status: 'paid',
          idempotent: true,
          message: 'Wire transfer payment already approved and allocation confirmed.',
        });
      }

      if (transitionWon) {
        await appendOrderHistory(orderId, 'wire_deposit_approved_by_admin', 'admin', {
          adminUid,
          adminNote,
          approvedAt: new Date().toISOString(),
        });

        // Enqueue fulfillment (Printify submission, confirmation emails, referral engine).
        // Only the single winner enqueues processing!
        await enqueueOrderProcessing(orderId);

        return NextResponse.json({
          success: true,
          orderId,
          status: 'paid',
          message: 'Wire transfer payment approved and allocation confirmed!',
        });
      }
    } else {
      if (isAlreadyRejected) {
        return NextResponse.json({
          success: true,
          orderId,
          status: 'cancelled',
          idempotent: true,
          message: 'Wire transfer already rejected.',
        });
      }

      if (transitionWon) {
        await appendOrderHistory(orderId, 'wire_deposit_rejected_by_admin', 'admin', {
          adminUid,
          adminNote,
          rejectedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          orderId,
          status: 'cancelled',
          message: 'Wire transfer rejected.',
        });
      }
    }

    return NextResponse.json({ error: 'State transition conflict' }, { status: 409 });
  } catch (err) {
    console.error('Error approving/rejecting wire order:', err);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }
}
