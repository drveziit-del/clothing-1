import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyPaymentSchema } from '@/lib/utils/validation';
import { processReferral } from '@/lib/referral/engine';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAdminPrebookNotification, sendOrderConfirmationEmail, sendAdminOrderNotification } from '@/lib/email/sender';
import type { Order } from '@/types';
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
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
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

  // 5. Update order status to paid and update coupon usage if applicable
  const batch = adminDb.batch();
  batch.update(orderRef, {
    status:             'paid',
    razorpayPaymentId:  razorpay_payment_id,
    updatedAt:          FieldValue.serverTimestamp(),
  });

  if (orderData.couponCode) {
    const couponSnap = await adminDb.collection('coupons')
      .where('code', '==', orderData.couponCode)
      .where('userId', '==', uid)
      .where('isUsed', '==', false)
      .limit(1)
      .get();

    if (!couponSnap.empty) {
      batch.update(couponSnap.docs[0].ref, {
        isUsed: true,
        usedAt: FieldValue.serverTimestamp(),
        orderId: orderId,
      });
    }
  }

  await batch.commit();

  const order: Order = {
    id: orderId,
    ...orderData,
    status: 'paid',
    razorpayPaymentId: razorpay_payment_id,
    createdAt: orderData.createdAt?.toDate() ?? new Date(),
  } as Order;

  // 6. Process referral (fire-and-forget — don't block response)
  processReferral(order).catch((err) => console.error('Referral processing error:', err));

  if (orderData.isPrebooking) {
    try {
      await sendAdminPrebookNotification({
        userName: orderData.prebookName || 'Anonymous User',
        userEmail: orderData.prebookEmail || orderData.userEmail,
        productTitle: order.items[0]?.title || 'Luxury Product',
        prebookingPricePaid: orderData.total,
        message: orderData.prebookMessage || '',
      });
    } catch (err) {
      console.error('Failed to send admin prebook email:', err);
    }
    return NextResponse.json({ status: 'ok', orderId });
  }

  // Send order confirmation email to the customer (fire-and-forget)
  sendOrderConfirmationEmail(order).catch((err) =>
    console.error('Failed to send order confirmation email:', err)
  );

  // Send order alert notification to the admin (fire-and-forget)
  sendAdminOrderNotification(order).catch((err) =>
    console.error('Failed to send admin order notification email:', err)
  );

  // 7. Submit to Printify (if shop ID configured)
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (shopId) {
    try {
      const printifyOrder = await createPrintifyOrder(shopId, {
        external_id: orderId,
        label:       `GERKINK-${orderId}`,
        line_items:  order.items.map((i) => ({
          product_id: i.printifyProductId ?? '',
          variant_id: Number(i.variant.printifyVariantId ?? i.variant.id),
          quantity:   i.quantity,
        })),
        shipping_method: 1,
        address_to: {
          first_name: order.shippingAddress ? order.shippingAddress.name.split(' ')[0] : 'Guest',
          last_name:  (order.shippingAddress && order.shippingAddress.name.split(' ').slice(1).join(' ')) || '-',
          email:      order.userEmail,
          country:    order.shippingAddress ? order.shippingAddress.country : 'US',
          region:     order.shippingAddress ? order.shippingAddress.state : 'NY',
          address1:   order.shippingAddress ? order.shippingAddress.street : '123 Main St',
          city:       order.shippingAddress ? order.shippingAddress.city : 'New York',
          zip:        order.shippingAddress ? order.shippingAddress.zip : '10001',
        },
      });

      await orderRef.update({
        printifyOrderId: printifyOrder.id,
        status:          'in_production',
      });
    } catch (err) {
      // Printify failure doesn't fail the payment — log for manual retry
      console.error('Printify order creation failed:', err);
    }
  }

  return NextResponse.json({ status: 'ok', orderId });
}
