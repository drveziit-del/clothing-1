import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { enqueueOrderProcessing, appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import { validateCoupon } from '@/lib/utils/couponValidator';

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'payment_verify', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // 1. Auth check
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

  // 2. Parse request body
  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  // 3. Preflight: fetch and verify order
  const orderRef = adminDb.collection('orders').doc(orderId);
  const preflight = await orderRef.get();

  if (!preflight.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const preData = preflight.data()!;
  if (preData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (preData.razorpayOrderId !== 'free_order' || preData.total !== 0) {
    return NextResponse.json({ error: 'Order is not eligible for free checkout' }, { status: 400 });
  }

  if (preData.status !== 'pending') {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order has already been processed' });
  }

  // Resolve coupon BEFORE the transaction — validateCoupon runs its own non-transactional reads.
  let couponRef: DocumentReference | null = null;
  let couponIsGlobal = false;
  if (preData.couponCode) {
    const couponResult = await validateCoupon(preData.couponCode, uid, preData.subtotal, preData.tax);
    if (couponResult.valid && couponResult.couponRef) {
      couponRef = couponResult.couponRef;
      couponIsGlobal = !!couponResult.couponData.isGlobal;
    }
  }

  // 4. Atomic commit: re-read inside a transaction to prevent double-processing races
  let alreadyProcessed = false;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists) throw new Error('ORDER_MISSING');

      const orderData = snap.data()!;
      if (orderData.userId !== uid) throw new Error('ORDER_MISMATCH');
      if (orderData.razorpayOrderId !== 'free_order' || orderData.total !== 0) throw new Error('NOT_FREE');

      if (orderData.status !== 'pending') {
        alreadyProcessed = true;
        return;
      }

      transaction.update(orderRef, {
        status: 'paid',
        paymentCaptured: true,
        paymentGateway: 'free',
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (couponRef) {
        if (couponIsGlobal) {
          transaction.update(couponRef, {
            timesUsed: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.update(couponRef, {
            isUsed: true,
            usedAt: FieldValue.serverTimestamp(),
            orderId: orderId,
            timesUsed: FieldValue.increment(1),
          });
        }
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ORDER_MISSING') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (msg === 'ORDER_MISMATCH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (msg === 'NOT_FREE') {
      return NextResponse.json({ error: 'Order is not eligible for free checkout' }, { status: 400 });
    }
    throw err;
  }

  if (alreadyProcessed) {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order has already been processed' });
  }

  await appendOrderHistory(orderId, 'free_checkout_verified', 'customer');

  // 5. Delegate background fulfillment to orchestrator
  await enqueueOrderProcessing(orderId);

  return NextResponse.json({ status: 'ok', orderId });
}
