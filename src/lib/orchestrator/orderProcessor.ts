import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { processReferral } from '@/lib/referral/engine';
import { allocateCustomerNumber } from '@/lib/customer/sequence';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { sendOrderConfirmationEmailsOnce } from '@/lib/email/sender';
import { normalizeCountryCode, normalizeRegionCode } from '@/lib/utils/isoCodes';
import type { Order } from '@/types';
import type { OrderHistoryEvent } from '@/lib/payment/types';

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
    ...(metadata ? { metadata } : {}),
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

  // Run background worker execution asynchronously so the HTTP checkout response is instant
  processOrderJob(jobRef.id, orderId).catch((err) => {
    console.error(`[OrderOrchestrator] Background worker error for order ${orderId}:`, err);
  });

  return jobRef.id;
}

export interface ClaimResult {
  claimed: boolean;
  reason?: string;
  leaseToken?: string;
  version?: number;
}

/**
 * Transactional job claiming with lease and version protection.
 * Guarantees:
 * 1. Two workers can NEVER successfully claim the same job simultaneously.
 * 2. Active unexpired leases are protected against concurrent theft.
 * 3. Expired leases (stalled/crashed workers) are safely reclaimable by bumping version.
 * 4. Completed jobs are strictly unclaimable.
 */
export async function claimOrderJob(
  jobId: string,
  workerId: string,
  leaseDurationMs: number = 5 * 60 * 1000
): Promise<ClaimResult> {
  const jobRef = adminDb.collection('order_jobs').doc(jobId);
  const now = Date.now();
  const leaseToken = `${workerId}_${crypto.randomUUID()}`;

  return await adminDb.runTransaction(async (transaction) => {
    const jobDoc = await transaction.get(jobRef);
    if (!jobDoc.exists) {
      return { claimed: false, reason: 'JOB_NOT_FOUND' };
    }

    const jobData = jobDoc.data()!;
    const status = jobData.status;

    if (status === 'completed') {
      return { claimed: false, reason: 'JOB_ALREADY_COMPLETED' };
    }

    const currentVersion = Number(jobData.version ?? 0);
    const leaseExpiresAtMs = jobData.leaseExpiresAtMs ? Number(jobData.leaseExpiresAtMs) : 0;

    // Active lease check: another worker holds an unexpired lock
    if (status === 'processing' && leaseExpiresAtMs > now && jobData.lockedBy !== workerId) {
      return {
        claimed: false,
        reason: `JOB_ACTIVELY_LOCKED_UNTIL_${new Date(leaseExpiresAtMs).toISOString()}`,
      };
    }

    const newVersion = currentVersion + 1;
    const newLeaseExpiresAtMs = now + leaseDurationMs;

    transaction.update(jobRef, {
      status: 'processing',
      lockedBy: workerId,
      leaseToken,
      leaseExpiresAtMs: newLeaseExpiresAtMs,
      version: newVersion,
      claimedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      claimed: true,
      leaseToken,
      version: newVersion,
    };
  });
}

/**
 * Transactionally completes an order processing job, verifying leaseToken ownership.
 */
export async function completeOrderJob(
  jobId: string,
  leaseToken?: string
): Promise<boolean> {
  const jobRef = adminDb.collection('order_jobs').doc(jobId);
  return await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(jobRef);
    if (!doc.exists) return false;
    const data = doc.data()!;
    if (leaseToken && data.leaseToken && data.leaseToken !== leaseToken) {
      console.warn(`[OrderOrchestrator] completeOrderJob lease mismatch for job ${jobId}`);
      return false;
    }
    transaction.update(jobRef, {
      status: 'completed',
      lockedBy: null,
      leaseToken: null,
      leaseExpiresAtMs: 0,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

export async function processOrderJob(
  jobId: string,
  orderId: string,
  currentAttempt = 1,
  workerId?: string
): Promise<void> {
  const MAX_RETRIES = 3;
  const actualWorkerId = workerId || `worker_${crypto.randomUUID()}`;
  const jobRef = adminDb.collection('order_jobs').doc(jobId);
  const orderRef = adminDb.collection('orders').doc(orderId);

  // 0. Claim the job transactionally with lease/version protection
  const claim = await claimOrderJob(jobId, actualWorkerId);
  if (!claim.claimed) {
    console.log(`[OrderOrchestrator] Worker ${actualWorkerId} could not claim job ${jobId}: ${claim.reason}. Skipping.`);
    return;
  }

  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    await jobRef.update({
      status: 'failed',
      lastError: 'Order document missing',
      lockedBy: null,
      leaseToken: null,
      leaseExpiresAtMs: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const orderData = orderDoc.data()!;
  const order: Order = {
    id: orderId,
    ...orderData,
    createdAt: orderData.createdAt?.toDate?.() ?? new Date(),
  } as Order;

  // 1. Customer Number Allocation (Founding 500 Campaign Sequence)
  let customerAllocated = typeof orderData.customerNumber === 'number';
  if (!customerAllocated) {
    try {
      const alloc = await allocateCustomerNumber(orderId);
      if (alloc) {
        customerAllocated = true;
        await appendOrderHistory(orderId, 'customer_number_allocated', 'system', {
          customerNumber: alloc.customerNumber,
          isFounding500: alloc.isFounding500,
        });
      }
    } catch (seqErr: any) {
      console.error(`[OrderOrchestrator] Customer number allocation error for order ${orderId}:`, seqErr);
    }
  }

  // Strictly enforce: Never mark an order fulfilled if customer-number allocation failed!
  if (!customerAllocated) {
    console.error(`[OrderOrchestrator] Halting fulfillment: customer-number allocation failed for order ${orderId}`);
    await jobRef.update({
      status: 'failed',
      lastError: 'Customer number allocation failed - fulfillment halted to preserve campaign sequence integrity',
      lockedBy: null,
      leaseToken: null,
      leaseExpiresAtMs: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await appendOrderHistory(orderId, 'fulfillment_halted_missing_customer_number', 'system');
    return;
  }

  // 2. Referral Commission Processing (Idempotent via doc referral_${order.id})
  if (!orderData.referralProcessed) {
    try {
      await processReferral(order);
      await orderRef.update({ referralProcessed: true });
      await appendOrderHistory(orderId, 'referral_processed', 'system');
    } catch (refErr: any) {
      console.error(`[OrderOrchestrator] Referral processing error for order ${orderId}:`, refErr);
    }
  }

  // 3. Email Receipt Sender (Idempotent via emailSent flag)
  if (!orderData.emailSent) {
    try {
      await sendOrderConfirmationEmailsOnce(orderId, order);
      await orderRef.update({ emailSent: true });
      await appendOrderHistory(orderId, 'confirmation_email_sent', 'system', { email: order.userEmail || null });
    } catch (emailErr: any) {
      console.error(`[OrderOrchestrator] Email sending error for order ${orderId}:`, emailErr);
    }
  }

  // 4. Printify Automated Order Submission
  // Check if order was already submitted to Printify
  if (orderData.printifyOrderId || orderData.status === 'in_production' || orderData.status === 'delivered') {
    console.log(`[OrderOrchestrator] Order ${orderId} already submitted to Printify (${orderData.printifyOrderId}). Completing job.`);
    await completeOrderJob(jobId, claim.leaseToken);
    return;
  }

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

        const currentSnap = await orderRef.get();
        const curStatus = currentSnap.data()?.status;
        const shouldUpdateStatus = !['shipped', 'delivered', 'cancelled'].includes(curStatus);

        await orderRef.update({
          printifyOrderId: printifyOrder.id,
          ...(shouldUpdateStatus ? { status: 'in_production' } : {}),
          updatedAt:       FieldValue.serverTimestamp(),
        });

        await completeOrderJob(jobId, claim.leaseToken);
        await appendOrderHistory(orderId, 'printify_order_submitted', 'system', { printifyOrderId: printifyOrder.id });
        return;
      } catch (printifyErr: any) {
        const errMsg = printifyErr?.message || 'Printify submission failed';
        console.error(`[OrderOrchestrator] Printify error for order ${orderId} (Attempt ${currentAttempt}/${MAX_RETRIES}):`, errMsg);

        if (currentAttempt < MAX_RETRIES) {
          const backoffDelayMs = Math.pow(2, currentAttempt) * 1000; // 2s, 4s, 8s backoff
          await jobRef.update({
            attemptCount:     FieldValue.increment(1),
            status:           'retrying',
            lastError:        errMsg,
            lockedBy:         null,
            leaseToken:       null,
            leaseExpiresAtMs: 0,
            updatedAt:        FieldValue.serverTimestamp(),
          });
          await appendOrderHistory(orderId, 'printify_submission_retry_scheduled', 'system', { attempt: currentAttempt + 1, backoffMs: backoffDelayMs });

          // Synchronous await delay instead of setTimeout in serverless
          await new Promise((resolve) => setTimeout(resolve, backoffDelayMs));
          return processOrderJob(jobId, orderId, currentAttempt + 1, actualWorkerId);
        }

        await orderRef.update({ status: 'queued_for_printify', updatedAt: FieldValue.serverTimestamp() });
        await jobRef.update({
          attemptCount:     FieldValue.increment(1),
          status:           'failed',
          lastError:        errMsg,
          lockedBy:         null,
          leaseToken:       null,
          leaseExpiresAtMs: 0,
          updatedAt:        FieldValue.serverTimestamp(),
        });
        await appendOrderHistory(orderId, 'printify_submission_failed_max_retries', 'system', { error: errMsg });
        return;
      }
    }
  }

  await completeOrderJob(jobId, claim.leaseToken);
}

/**
 * Re-drives fulfillment jobs abandoned by serverless freezes (fire-and-forget
 * work dying with the invocation). Called opportunistically from the admin
 * dashboard load — a zero-infrastructure stand-in for a scheduled sweeper.
 *
 * Stuck = pending/retrying/processing with updatedAt older than 10 minutes.
 */
export async function sweepStuckJobs(maxAgeMs: number = 10 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  let requeued = 0;

  try {
    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const snap = await adminDb
        .collection('order_jobs')
        .where('status', 'in', ['pending', 'retrying', 'processing'])
        .where('updatedAt', '<', cutoff)
        .limit(10)
        .get();
      docs = snap.docs;
    } catch (queryErr: any) {
      // If composite index is building or not yet created, fall back to single-field filter with in-memory cutoff
      if (queryErr?.code === 9 || String(queryErr?.message || '').includes('index')) {
        const fallbackSnap = await adminDb
          .collection('order_jobs')
          .where('status', 'in', ['pending', 'retrying', 'processing'])
          .limit(30)
          .get();

        docs = fallbackSnap.docs.filter((d) => {
          const raw = d.data()?.updatedAt;
          if (!raw) return true;
          const u = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
          return u < cutoff;
        }).slice(0, 10);
      } else {
        throw queryErr;
      }
    }

    for (const doc of docs) {
      const job = doc.data();
      const orderId = String(job.orderId || doc.id);
      const jobRef = adminDb.collection('order_jobs').doc(doc.id);
      const orderRef = adminDb.collection('orders').doc(orderId);

      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) {
        await jobRef.update({ status: 'failed', lastError: 'Order document missing (sweep)', updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const orderData = orderDoc.data()!;

      // Already fulfilled elsewhere — close the job instead of double-submitting.
      if (orderData.printifyOrderId || orderData.status === 'in_production' || orderData.status === 'delivered') {
        await jobRef.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      // Only paid orders should ever be fulfilled.
      if (!orderData.paymentCaptured && !['paid', 'queued_for_printify'].includes(orderData.status)) {
        await jobRef.update({ status: 'failed', lastError: 'Order not paid (sweep)', updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const nextAttempt = Number(job.attemptCount ?? 0) + 1;
      await jobRef.update({
        attemptCount: nextAttempt,
        status: 'pending',
        lastError: `swept_after_stall_${new Date().toISOString()}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await appendOrderHistory(orderId, 'order_job_swept_requeued', 'system', { attempt: nextAttempt });

      processOrderJob(doc.id, orderId, nextAttempt).catch((err) => {
        console.error(`[OrderOrchestrator] Swept job re-run failed for order ${orderId}:`, err);
      });
      requeued += 1;
    }
  } catch (err) {
    console.error('[OrderOrchestrator] Stuck-job sweep failed:', err);
  }

  return requeued;
}
