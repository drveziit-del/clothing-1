import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { processReferral } from '@/lib/referral/engine';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { normalizeCountryCode, normalizeRegionCode } from '@/lib/utils/isoCodes';
import type { Order } from '@/types';

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
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
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderRef = snap.docs[0].ref;

  switch (event.event) {
    case 'payment.captured': {
      let shouldRunPostCommitSideEffects = false;
      let orderDataForSideEffects: any = null;
      let orderObjForSideEffects: Order | null = null;

      try {
        await adminDb.runTransaction(async (transaction) => {
          const orderDoc = await transaction.get(orderRef);
          if (!orderDoc.exists) {
            throw new Error('Order document does not exist');
          }

          const orderData = orderDoc.data()!;

          // Idempotency check: If order is already paid, in production, shipped or delivered, skip
          if (['paid', 'in_production', 'shipped', 'delivered'].includes(orderData.status)) {
            console.log(`Order ${orderDoc.id} already processed (status: ${orderData.status}). Webhook skipping duplicate event.`);
            return;
          }

          // Secondary idempotency: check webhookProcessedAt timestamp
          if (orderData.webhookProcessedAt) {
            console.log(`Order ${orderDoc.id} webhook already processed at ${orderData.webhookProcessedAt}. Skipping.`);
            return;
          }

          transaction.update(orderRef, {
            status:              'paid',
            razorpayPaymentId:   payment.entity.id,
            webhookProcessedAt:  FieldValue.serverTimestamp(),
            updatedAt:           FieldValue.serverTimestamp(),
          });

          shouldRunPostCommitSideEffects = true;
          orderDataForSideEffects = orderData;
          orderObjForSideEffects = {
            id: orderDoc.id,
            ...orderData,
            status: 'paid',
            razorpayPaymentId: payment.entity.id,
            createdAt: orderData.createdAt?.toDate() ?? new Date(),
          } as Order;
        });
      } catch (err: any) {
        console.error('Razorpay Webhook transaction failed:', err);
        return NextResponse.json({ error: 'Internal webhook processing failure' }, { status: 500 });
      }

      if (shouldRunPostCommitSideEffects && orderObjForSideEffects) {
        const order = orderObjForSideEffects as any as Order;
        const orderData = orderDataForSideEffects;

        // 1. Process referral (awaited for serverless safety)
        try {
          await processReferral(order);
        } catch (err) {
          console.error('Webhook Referral processing error:', err);
        }

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

        // Send order confirmation & admin alert emails (at-most-once check, awaited)
        try {
          const { sendOrderConfirmationEmailsOnce } = await import('@/lib/email/sender');
          await sendOrderConfirmationEmailsOnce(order.id, order);
        } catch (err) {
          console.error('Webhook: Failed to send order emails:', err);
        }

        // 2. Submit to Printify (if shop ID configured and not already attempted)
        const shopId = process.env.PRINTIFY_SHOP_ID;
        if (shopId && !orderData.fulfillmentAttempted) {
          const printifyItems = (order.items || [])
            .filter((i: any) => i.printifyProductId && !isNaN(Number(i.variant?.printifyVariantId ?? i.variant?.id)));

          if (printifyItems.length > 0) {
            try {
              const countryCode = normalizeCountryCode(order.shippingAddress?.country);
              const regionCode = normalizeRegionCode(order.shippingAddress?.state, countryCode);

              const printifyOrder = await createPrintifyOrder(shopId, {
                external_id: order.id,
                label:       `GERKINK-${order.id}`,
                line_items:  printifyItems.map((i: any) => ({
                  product_id: i.printifyProductId || '',
                  variant_id: Number(i.variant.printifyVariantId ?? i.variant.id),
                  quantity:   i.quantity,
                })),
                shipping_method: 1,
                address_to: {
                  first_name: order.shippingAddress ? order.shippingAddress.name.split(' ')[0] : 'Guest',
                  last_name:  (order.shippingAddress && order.shippingAddress.name.split(' ').slice(1).join(' ')) || '-',
                  email:      order.userEmail,
                  phone:      (order.shippingAddress && order.shippingAddress.phone) || '0000000000',
                  country:    countryCode,
                  region:     regionCode,
                  address1:   order.shippingAddress ? order.shippingAddress.street : '123 Main St',
                  city:       order.shippingAddress ? order.shippingAddress.city : 'New York',
                  zip:        order.shippingAddress ? String(order.shippingAddress.zip).trim() : '10001',
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
