import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { processReferral } from '@/lib/referral/engine';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { sendOrderConfirmationEmail, sendAdminOrderNotification } from '@/lib/email/sender';
import type { Order } from '@/types';

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
    return NextResponse.json({ error: 'Order has already been processed' }, { status: 400 });
  }

  // 4. Update order status and mark coupon as used atomically
  const batch = adminDb.batch();

  batch.update(orderRef, {
    status: 'paid',
    updatedAt: FieldValue.serverTimestamp(),
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
    createdAt: orderData.createdAt?.toDate() ?? new Date(),
  } as Order;

  // 5. Process referral (fire-and-forget)
  processReferral(order).catch((err) => console.error('Referral processing error:', err));

  // Send order confirmation email to the customer (fire-and-forget)
  sendOrderConfirmationEmail(order).catch((err) =>
    console.error('Failed to send order confirmation email:', err)
  );

  // Send order alert notification to the admin (fire-and-forget)
  sendAdminOrderNotification(order).catch((err) =>
    console.error('Failed to send admin order notification email:', err)
  );

  // 6. Submit to Printify (if shop ID configured)
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
      console.error('Printify order creation failed:', err);
    }
  }

  return NextResponse.json({ status: 'ok', orderId });
}
