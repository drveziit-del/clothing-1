import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { processReferral } from '@/lib/referral/engine';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import type { Order } from '@/types';

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody  = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { event: string; payload: { payment: { entity: { id: string; order_id: string; status: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { payment } = event.payload;
  const razorpayOrderId = payment.entity.order_id;

  // Find Firestore order by Razorpay order ID
  const snap = await adminDb
    .collection('orders')
    .where('razorpayOrderId', '==', razorpayOrderId)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ status: 'order_not_found' });
  }

  const orderRef = snap.docs[0].ref;

  switch (event.event) {
    case 'payment.captured': {
      const orderDoc = snap.docs[0];
      const orderData = orderDoc.data();

      // Idempotency check: If order is already paid, in production, shipped or delivered, skip
      if (['paid', 'in_production', 'shipped', 'delivered'].includes(orderData.status)) {
        console.log(`Order ${orderDoc.id} already processed (status: ${orderData.status}). Webhook skipping duplicate event.`);
        break;
      }

      // Secondary idempotency: check webhookProcessedAt timestamp
      if (orderData.webhookProcessedAt) {
        console.log(`Order ${orderDoc.id} webhook already processed at ${orderData.webhookProcessedAt}. Skipping.`);
        break;
      }

      await orderRef.update({
        status:              'paid',
        razorpayPaymentId:   payment.entity.id,
        webhookProcessedAt:  FieldValue.serverTimestamp(),
        updatedAt:           FieldValue.serverTimestamp(),
      });

      const order: Order = {
        id: orderDoc.id,
        ...orderData,
        status: 'paid',
        razorpayPaymentId: payment.entity.id,
        createdAt: orderData.createdAt?.toDate() ?? new Date(),
      } as Order;

      // 1. Process referral (fire-and-forget)
      processReferral(order).catch((err) => console.error('Webhook Referral processing error:', err));

      if (orderData.isPrebooking) {
        try {
          const { sendAdminPrebookNotification } = await import('@/lib/email/sender');
          await sendAdminPrebookNotification({
            userName: orderData.prebookName || 'Anonymous User',
            userEmail: orderData.prebookEmail || orderData.userEmail,
            productTitle: order.items[0]?.title || 'Luxury Product',
            prebookingPricePaid: orderData.total,
            message: orderData.prebookMessage || '',
          });
        } catch (err) {
          console.error('Webhook: Failed to send admin prebook email:', err);
        }
        break;
      }

      // Send order confirmation email to the customer (fire-and-forget)
      try {
        const { sendOrderConfirmationEmail } = await import('@/lib/email/sender');
        sendOrderConfirmationEmail(order).catch((err) =>
          console.error('Webhook: Failed to send order confirmation email:', err)
        );
      } catch (err) {
        console.error('Webhook: Failed to send order confirmation email:', err);
      }

      // Send order alert notification to the admin (fire-and-forget)
      try {
        const { sendAdminOrderNotification } = await import('@/lib/email/sender');
        sendAdminOrderNotification(order).catch((err) =>
          console.error('Webhook: Failed to send admin order notification email:', err)
        );
      } catch (err) {
        console.error('Webhook: Failed to send admin order notification email:', err);
      }

      // 2. Submit to Printify (if shop ID configured and not already attempted)
      const shopId = process.env.PRINTIFY_SHOP_ID;
      if (shopId && !orderData.fulfillmentAttempted) {
        try {
          const printifyOrder = await createPrintifyOrder(shopId, {
            external_id: orderDoc.id,
            label:       `GERKINK-${orderDoc.id}`,
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
            printifyOrderId:      printifyOrder.id,
            status:               'in_production',
            fulfillmentAttempted: true,
          });
        } catch (err) {
          console.error('Webhook Printify order creation failed:', err);
          // Mark fulfillment as attempted even on failure to prevent infinite retries
          await orderRef.update({ fulfillmentAttempted: true }).catch(() => {});
        }
      }
      break;
    }

    case 'payment.failed':
      await orderRef.update({
        status:    'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
  }

  return NextResponse.json({ status: 'ok' });
}
