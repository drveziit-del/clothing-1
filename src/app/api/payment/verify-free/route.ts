import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
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

  // 3. Fetch and verify order
  const orderRef = adminDb.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderData = orderDoc.data()!;
  if (orderData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (orderData.razorpayOrderId !== 'free_order' || orderData.total !== 0) {
    return NextResponse.json({ error: 'Order is not eligible for free checkout' }, { status: 400 });
  }

  if (orderData.status !== 'pending') {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order has already been processed' });
  }

  // 4. Update order status and mark coupon as used atomically
  const batch = adminDb.batch();

  batch.update(orderRef, {
    status: 'paid',
    paymentCaptured: true,
    paymentGateway: 'free',
    updatedAt: FieldValue.serverTimestamp(),
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
  await appendOrderHistory(orderId, 'free_checkout_verified', 'customer');

  // 5. Delegate background fulfillment to orchestrator
  await enqueueOrderProcessing(orderId);

  return NextResponse.json({ status: 'ok', orderId });
}
