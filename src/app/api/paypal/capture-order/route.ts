import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { paypalGateway } from '@/lib/paypal/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { validateCoupon } from '@/lib/utils/couponValidator';
import { enqueueOrderProcessing, appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import z from 'zod';

const captureSchema = z.object({
  orderId:       z.string().min(1),
  paypalOrderId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'paypal_capture_order', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // 1. Auth check (optional for guest orders)
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  let uid: string | undefined;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      uid = decoded.uid;
    } catch {}
  }

  // 2. Validate request body
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = captureSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { orderId, paypalOrderId } = result.data;

  // 3. Fetch order & check idempotency guard
  const orderRef = adminDb.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderData = orderDoc.data()!;
  if (uid && orderData.userId && !orderData.userId.startsWith('guest_') && orderData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Idempotency Guard: If already captured or paid, return immediately
  if (orderData.paymentCaptured || orderData.status === 'paid' || orderData.status === 'in_production') {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order already captured' });
  }

  // 4. Capture PayPal Order via REST API
  let captureResult: { captureId: string; status: string; amountValue?: number };
  try {
    captureResult = await paypalGateway.captureOrder(paypalOrderId);
  } catch (err: any) {
    console.error(`[paypal/capture-order] Error capturing PayPal order ${paypalOrderId}:`, err);
    return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 });
  }

  if (captureResult.status !== 'COMPLETED') {
    return NextResponse.json({ error: `Payment not completed (Status: ${captureResult.status})` }, { status: 400 });
  }

  // Amount Integrity Guard: Cross-check captured amount vs database order total
  if (typeof captureResult.amountValue === 'number') {
    const expectedAmount = orderData.totalAmountUSD;
    if (Math.abs(captureResult.amountValue - expectedAmount) > 0.05) {
      console.error(`[paypal/capture-order] Captured amount mismatch for order ${orderId}: Expected $${expectedAmount}, Captured $${captureResult.amountValue}`);
      return NextResponse.json({ error: `Captured amount mismatch ($${captureResult.amountValue} vs expected $${expectedAmount})` }, { status: 400 });
    }
  }

  // 5. Atomic Update Order & Coupon in Firestore
  const batch = adminDb.batch();
  batch.update(orderRef, {
    status:          'paid',
    paymentCaptured: true,
    paypalCaptureId: captureResult.captureId,
    updatedAt:       FieldValue.serverTimestamp(),
  });

  if (orderData.couponCode) {
    const couponResult = await validateCoupon(orderData.couponCode, uid || 'guest', orderData.subtotal, orderData.tax);
    if (couponResult.valid && couponResult.couponRef) {
      if (couponResult.couponData.isGlobal) {
        batch.update(couponResult.couponRef, {
          timesUsed: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        batch.update(couponResult.couponRef, {
          isUsed:    true,
          usedAt:    FieldValue.serverTimestamp(),
          orderId:   orderId,
          timesUsed: FieldValue.increment(1),
        });
      }
    }
  }

  await batch.commit();
  await appendOrderHistory(orderId, 'paypal_payment_captured', 'customer', {
    paypalCaptureId: captureResult.captureId,
  });

  // 6. Enqueue Asynchronous Background Processing Worker (Printify, Email, Referral)
  const jobId = await enqueueOrderProcessing(orderId);

  return NextResponse.json({ status: 'ok', orderId, jobId });
}
