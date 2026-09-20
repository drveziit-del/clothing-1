import 'server-only';
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

  // 2. Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { orderId } = body;
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  const orderRef = adminDb.collection('orders').doc(orderId);

  // 3. Pre-read order outside transaction to verify baseline eligibility
  const preDoc = await orderRef.get();
  if (!preDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const preData = preDoc.data()!;
  if (preData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (preData.razorpayOrderId !== 'free_order' || preData.total !== 0) {
    return NextResponse.json({ error: 'Order is not eligible for free checkout' }, { status: 400 });
  }

  if (preData.status !== 'pending') {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order has already been processed' });
  }

  // Free orders strictly require a valid 100% discount coupon
  if (!preData.couponCode) {
    return NextResponse.json({ error: 'Free checkout requires a valid 100% discount coupon.' }, { status: 400 });
  }

  const couponResult = await validateCoupon(preData.couponCode, uid, preData.subtotal, preData.tax);
  if (!couponResult.valid || !couponResult.couponRef) {
    return NextResponse.json({ error: couponResult.error || 'Invalid or expired coupon for free checkout.' }, { status: 400 });
  }

  // Verify the discount actually covered the grand total
  const grandTotal = (preData.subtotal || 0) + (preData.tax || 0);
  if (couponResult.discount < grandTotal) {
    return NextResponse.json({ error: 'Coupon does not cover 100% of the order total.' }, { status: 400 });
  }

  const couponRef: DocumentReference = couponResult.couponRef;
  const couponIsGlobal = !!couponResult.couponData.isGlobal;

  // 4. Atomic commit: re-read inside a transaction to prevent double-processing races
  let alreadyProcessed = false;

  try {
    await adminDb.runTransaction(async (transaction) => {
      // 1. ALL READS FIRST
      const snap = await transaction.get(orderRef);
      if (!snap.exists) throw new Error('ORDER_MISSING');

      let couponDocSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (couponRef) {
        couponDocSnap = await transaction.get(couponRef);
      }

      const orderData = snap.data()!;
      if (orderData.userId !== uid) throw new Error('ORDER_MISMATCH');
      if (orderData.razorpayOrderId !== 'free_order' || orderData.total !== 0) throw new Error('NOT_FREE');

      if (orderData.status !== 'pending') {
        alreadyProcessed = true;
        return;
      }

      // 2. Validate coupon state authoritatively inside the transaction
      if (couponRef && couponDocSnap) {
        if (!couponDocSnap.exists) {
          throw new Error('COUPON_NOT_FOUND');
        }
        const cData = couponDocSnap.data()!;
        if (cData.isActive === false) {
          throw new Error('COUPON_INACTIVE');
        }
        if (!couponIsGlobal && cData.isUsed) {
          throw new Error('COUPON_ALREADY_USED');
        }
        if (couponIsGlobal && typeof cData.maxUses === 'number' && (cData.timesUsed || 0) >= cData.maxUses) {
          throw new Error('COUPON_MAX_USES_REACHED');
        }
      }

      // 3. ALL WRITES AFTER READS
      transaction.update(orderRef, {
        status: 'paid',
        paymentCaptured: true,
        paymentGateway: 'free',
        couponConsumed: true,
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
            updatedAt: FieldValue.serverTimestamp(),
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
    if (msg === 'COUPON_ALREADY_USED' || msg === 'COUPON_INACTIVE' || msg === 'COUPON_MAX_USES_REACHED' || msg === 'COUPON_NOT_FOUND') {
      return NextResponse.json({ error: 'Coupon is no longer valid or has already been used.' }, { status: 400 });
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
