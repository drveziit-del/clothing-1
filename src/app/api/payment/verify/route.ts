import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyPaymentSchema } from '@/lib/utils/validation';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAdminPrebookNotification } from '@/lib/email/sender';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { enqueueOrderProcessing, appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import { validateCoupon } from '@/lib/utils/couponValidator';
import crypto from 'crypto';

function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET not set');
  const body    = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

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

  // 2. Validate body
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = verifyPaymentSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = result.data;

  // 3. Verify signature
  let signatureValid: boolean;
  try {
    signatureValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  } catch (err) {
    console.error('Signature verification error:', err);
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
  }

  // 4. Fetch and verify Firestore order belongs to this user
  const orderRef = adminDb.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderData = orderDoc.data()!;
  if (orderData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (orderData.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: 'Order ID mismatch' }, { status: 400 });
  }

  // Idempotency check: if order is already paid or in production, skip double processing
  if (orderData.status === 'paid' || orderData.status === 'in_production' || orderData.paymentCaptured) {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order already verified' });
  }

  // 5. Update order status to paid and update coupon usage if applicable
  const batch = adminDb.batch();
  batch.update(orderRef, {
    status:             'paid',
    paymentCaptured:    true,
    razorpayPaymentId:  razorpay_payment_id,
    updatedAt:          FieldValue.serverTimestamp(),
  });

  if (orderData.couponCode) {
    const couponResult = await validateCoupon(orderData.couponCode, uid, orderData.subtotal, orderData.tax);
    if (couponResult.valid && couponResult.couponRef) {
      if (couponResult.couponData.isGlobal) {
        batch.update(couponResult.couponRef, {
          timesUsed: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        batch.update(couponResult.couponRef, {
          isUsed: true,
          usedAt: FieldValue.serverTimestamp(),
          orderId: orderId,
          timesUsed: FieldValue.increment(1),
        });
      }
    }
  }

  await batch.commit();
  await appendOrderHistory(orderId, 'razorpay_payment_verified', 'customer', { razorpay_payment_id });

  if (orderData.isPrebooking) {
    try {
      await sendAdminPrebookNotification({
        userName: orderData.prebookName || 'Anonymous User',
        userEmail: orderData.prebookEmail || orderData.userEmail,
        productTitle: orderData.items?.[0]?.title || 'Luxury Product',
        prebookingPricePaid: orderData.total,
        message: orderData.prebookMessage || '',
      });
    } catch (err) {
      console.error('Failed to send admin prebook email:', err);
    }
    return NextResponse.json({ status: 'ok', orderId });
  }

  // 6. Delegate background processing (referral, email, Printify) to orchestrator
  await enqueueOrderProcessing(orderId);

  return NextResponse.json({ status: 'ok', orderId });
}
