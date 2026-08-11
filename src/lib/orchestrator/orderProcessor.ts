import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { processReferral } from '@/lib/referral/engine';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { sendOrderConfirmationEmailsOnce } from '@/lib/email/sender';
import { normalizeCountryCode, normalizeRegionCode } from '@/lib/utils/isoCodes';
import type { Order } from '@/types';
import type { OrderJob, OrderHistoryEvent } from '@/lib/payment/types';

export async function appendOrderHistory(
  orderId: string,
  event: string,
  actor: 'system' | 'customer' | 'admin',
  metadata?: Record<string, unknown>
): Promise<void> {
  const historyEvent: OrderHistoryEvent = {
    timestamp: new Date().toISOString(),
    event,
    actor,
    metadata,
  };

  try {
    await adminDb.collection('orders').doc(orderId).update({
      history: FieldValue.arrayUnion(historyEvent),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`[appendOrderHistory] Failed to log event for order ${orderId}:`, err);
  }
}

export async function enqueueOrderProcessing(orderId: string): Promise<string> {
  const jobRef = adminDb.collection('order_jobs').doc(orderId);
  const jobSnap = await jobRef.get();

  if (jobSnap.exists) {
    const jobData = jobSnap.data();
    if (jobData?.status === 'completed' || jobData?.status === 'processing' || jobData?.status === 'pending') {
      console.log(`[OrderOrchestrator] Processing job already exists for order ${orderId} with status ${jobData?.status}. Skipping enqueue.`);
      return jobRef.id;
    }
  }

  const jobData = {
    orderId,
    event:        'OrderPaid',
    status:       'pending',
    attemptCount: (jobSnap.data()?.attemptCount ?? 0),
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  };

  await jobRef.set(jobData, { merge: true });
  await appendOrderHistory(orderId, 'order_job_enqueued', 'system', { jobId: jobRef.id });

  // Await background worker execution to guarantee it completes in serverless environments
  try {
    await processOrderJob(jobRef.id, orderId);
  } catch (err) {
    console.error(`[OrderOrchestrator] Background worker error for order ${orderId}:`, err);
  }

  return jobRef.id;
}

export async function processOrderJob(jobId: string, orderId: string, currentAttempt = 1): Promise<void> {
  const MAX_RETRIES = 3;
  const jobRef = adminDb.collection('order_jobs').doc(jobId);
  const orderRef = adminDb.collection('orders').doc(orderId);

  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    await jobRef.update({ status: 'failed', lastError: 'Order document missing', updatedAt: FieldValue.serverTimestamp() });
    return;
  }

  const orderData = orderDoc.data()!;
  const order: Order = {
    id: orderId,
    ...orderData,
    createdAt: orderData.createdAt?.toDate() ?? new Date(),
  } as Order;

  await jobRef.update({ status: 'processing', updatedAt: FieldValue.serverTimestamp() });

  // 1. Referral Commission Processing
  try {
    await processReferral(order);
    await appendOrderHistory(orderId, 'referral_processed', 'system');
  } catch (refErr: any) {
    console.error(`[OrderOrchestrator] Referral processing error for order ${orderId}:`, refErr);
  }

  // 2. Email Receipt Sender
  if (!orderData.emailSent) {
    try {
      await sendOrderConfirmationEmailsOnce(orderId, order);
      await orderRef.update({ emailSent: true });
      await appendOrderHistory(orderId, 'confirmation_email_sent', 'system', { email: order.userEmail });
    } catch (emailErr: any) {
      console.error(`[OrderOrchestrator] Email sending error for order ${orderId}:`, emailErr);
    }
  }

  // 3. Printify Automated Order Submission (with exponential backoff retry tracking)
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (shopId && order.shippingAddress && order.shippingAddress.street && order.shippingAddress.city) {
    const printifyItems = (order.items || []).filter(
      (i: any) => i.printifyProductId && !isNaN(Number(i.variant?.printifyVariantId ?? i.variant?.id))
    );

    if (printifyItems.length > 0) {
      try {
        const countryCode = normalizeCountryCode(order.shippingAddress.country);
        const regionCode = normalizeRegionCode(order.shippingAddress.state, countryCode);

        const printifyOrder = await createPrintifyOrder(shopId, {
          external_id: orderId,
          label:       `GERKINK-${orderId}`,
          line_items:  printifyItems.map((i) => ({
            product_id: i.printifyProductId || '',
            variant_id: Number(i.variant.printifyVariantId ?? i.variant.id),
            quantity:   i.quantity,
          })),
          shipping_method: 1,
          address_to: {
            first_name: order.shippingAddress.name.split(' ')[0] || 'Customer',
            last_name:  order.shippingAddress.name.split(' ').slice(1).join(' ') || 'Customer',
            email:      order.userEmail,
            phone:      order.shippingAddress.phone || '0000000000',
            country:    countryCode,
            region:     regionCode,
            address1:   order.shippingAddress.street,
            city:       order.shippingAddress.city,
            zip:        String(order.shippingAddress.zip || '00000').trim(),
          },
        });

        await orderRef.update({
          printifyOrderId: printifyOrder.id,
          status:          'in_production',
          updatedAt:       FieldValue.serverTimestamp(),
        });

        await jobRef.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
        await appendOrderHistory(orderId, 'printify_order_submitted', 'system', { printifyOrderId: printifyOrder.id });
        return;
      } catch (printifyErr: any) {
        const errMsg = printifyErr?.message || 'Printify submission failed';
        console.error(`[OrderOrchestrator] Printify error for order ${orderId} (Attempt ${currentAttempt}/${MAX_RETRIES}):`, errMsg);

        if (currentAttempt < MAX_RETRIES) {
          const backoffDelayMs = Math.pow(2, currentAttempt) * 1000; // 2s, 4s, 8s backoff
          await jobRef.update({
            attemptCount: FieldValue.increment(1),
            status:       'retrying',
            lastError:    errMsg,
            updatedAt:    FieldValue.serverTimestamp(),
          });
          await appendOrderHistory(orderId, 'printify_submission_retry_scheduled', 'system', { attempt: currentAttempt + 1, backoffMs: backoffDelayMs });

          // Synchronous await delay instead of setTimeout in serverless
          await new Promise((resolve) => setTimeout(resolve, backoffDelayMs));
          return processOrderJob(jobId, orderId, currentAttempt + 1);
        }

        await orderRef.update({ status: 'queued_for_printify', updatedAt: FieldValue.serverTimestamp() });
        await jobRef.update({
          attemptCount: FieldValue.increment(1),
          status:       'failed',
          lastError:    errMsg,
          updatedAt:    FieldValue.serverTimestamp(),
        });
        await appendOrderHistory(orderId, 'printify_submission_failed_max_retries', 'system', { error: errMsg });
        return;
      }
    }
  }

  await jobRef.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
}
