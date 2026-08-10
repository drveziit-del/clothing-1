import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { paypalGateway } from '@/lib/paypal/client';
import { enqueueOrderProcessing, appendOrderHistory } from '@/lib/orchestrator/orderProcessor';

export async function POST(request: NextRequest) {
  // 1. Authoritative Cryptographic HMAC Signature Verification
  let verification: { valid: boolean; event?: any };
  try {
    verification = await paypalGateway.verifyWebhook(request);
  } catch (err) {
    console.error('[paypal/webhook] Webhook verification error:', err);
    return NextResponse.json({ error: 'Signature verification error' }, { status: 400 });
  }

  if (!verification.valid || !verification.event) {
    console.warn('[paypal/webhook] Webhook verification failed. Invalid signature.');
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const event = verification.event;
  const eventType: string = event.event_type || '';
  const resource = event.resource || {};

  console.log(`[paypal/webhook] Received authoritative event ${eventType}:`, resource.id);

  // 2. Handle Events
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED') {
    const paypalOrderId = resource.supplementary_data?.related_ids?.order_id || resource.id;

    if (paypalOrderId) {
      const query = await adminDb
        .collection('orders')
        .where('paypalOrderId', '==', paypalOrderId)
        .limit(1)
        .get();

      if (!query.empty) {
        const orderDoc = query.docs[0];
        const orderId = orderDoc.id;
        const orderData = orderDoc.data();

        if (!orderData.paymentCaptured && orderData.status !== 'paid') {
          const captureId = resource.id || paypalOrderId;

          await orderDoc.ref.update({
            status:          'paid',
            paymentCaptured: true,
            paypalCaptureId: captureId,
            updatedAt:       FieldValue.serverTimestamp(),
          });

          await appendOrderHistory(orderId, 'paypal_webhook_payment_captured', 'system', { eventType, captureId });
          await enqueueOrderProcessing(orderId);
        }
      }
    }
  } else if (eventType === 'PAYMENT.CAPTURE.REVERSED' || eventType === 'PAYMENT.CAPTURE.REFUNDED') {
    const captureId = resource.id;
    if (captureId) {
      const query = await adminDb.collection('orders').where('paypalCaptureId', '==', captureId).limit(1).get();
      if (!query.empty) {
        const orderDoc = query.docs[0];
        await orderDoc.ref.update({
          status:    'refunded',
          updatedAt: FieldValue.serverTimestamp(),
        });
        await appendOrderHistory(orderDoc.id, 'paypal_webhook_payment_refunded', 'system', { resource });
      }
    }
  } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
    const captureId = resource.id;
    if (captureId) {
      const query = await adminDb.collection('orders').where('paypalCaptureId', '==', captureId).limit(1).get();
      if (!query.empty) {
        const orderDoc = query.docs[0];
        await orderDoc.ref.update({
          status:    'failed',
          updatedAt: FieldValue.serverTimestamp(),
        });
        await appendOrderHistory(orderDoc.id, 'paypal_webhook_payment_denied', 'system', { resource });
      }
    }
  } else if (eventType === 'CUSTOMER.DISPUTE.CREATED') {
    const paypalOrderId = resource.disputed_transactions?.[0]?.seller_transaction_id || resource.id;
    if (paypalOrderId) {
      const query = await adminDb.collection('orders').where('paypalCaptureId', '==', paypalOrderId).limit(1).get();
      if (!query.empty) {
        const orderDoc = query.docs[0];
        await orderDoc.ref.update({
          status:    'disputed',
          updatedAt: FieldValue.serverTimestamp(),
        });
        await appendOrderHistory(orderDoc.id, 'paypal_webhook_customer_dispute_created', 'system', { resource });
      }
    }
  }

  return NextResponse.json({ status: 'ok', eventType });
}
