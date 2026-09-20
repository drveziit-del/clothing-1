import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { paypalGateway } from '@/lib/paypal/client';
import { sendCustomDesignNotification } from '@/lib/email/sender';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Verify Webhook Signature with PayPal
  let verifyResult: { valid: boolean; event?: any };
  try {
    verifyResult = await paypalGateway.verifyWebhook(request);
  } catch (err: any) {
    console.error('[custom-design/webhook] Verification threw error:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  if (!verifyResult.valid || !verifyResult.event) {
    console.warn('[custom-design/webhook] Invalid PayPal webhook signature rejected.');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = verifyResult.event;
  if (!event || !event.id) {
    return NextResponse.json({ error: 'Missing event payload or event ID' }, { status: 400 });
  }

  const eventType = event.event_type;
  console.log(`[custom-design/webhook] Processing verified event: ${eventType} (ID: ${event.id})`);

  const eventRef = adminDb.collection('webhook_events').doc(event.id);

  // 2. Handle PAYMENT.CAPTURE.COMPLETED with atomic transaction
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const capture = event.resource;
    const captureId = capture?.id;
    const amountVal = parseFloat(capture?.amount?.value || '0');
    const currencyCode = capture?.amount?.currency_code || 'USD';
    const paypalOrderId = capture?.supplementary_data?.related_ids?.order_id;

    if (paypalOrderId) {
      const snap = await adminDb
        .collection('customDesignRequests')
        .where('paypalOrderId', '==', paypalOrderId)
        .limit(1)
        .get();

      if (!snap.empty) {
        const reqDocRef = snap.docs[0].ref;
        let isWinner = false;
        let notificationPayload: any = null;

        try {
          await adminDb.runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (eventDoc.exists) {
              isWinner = false;
              return;
            }

            const reqDoc = await transaction.get(reqDocRef);
            if (!reqDoc.exists) {
              transaction.set(eventRef, {
                eventId: event.id,
                eventType,
                processedAt: new Date().toISOString(),
                status: 'request_not_found',
              });
              isWinner = false;
              return;
            }

            const reqData = reqDoc.data()!;
            const now = new Date().toISOString();

            // Atomically claim the webhook event
            transaction.set(eventRef, {
              eventId: event.id,
              eventType,
              processedAt: now,
              requestId: reqDoc.id,
            });
            isWinner = true;

            // Only transition and notify if not already paid/submitted
            if (reqData.paymentStatus !== 'paid' && reqData.status !== 'SUBMITTED') {
              const expectedAmount = Number(reqData.prepaymentAmount);
              const amountMismatch = amountVal > 0 && Math.abs(amountVal - expectedAmount) > 0.05;
              const currencyMismatch = currencyCode !== 'USD';

              if (amountMismatch || currencyMismatch) {
                const mismatchReason = amountMismatch
                  ? `Webhook amount mismatch: received $${amountVal} vs expected $${expectedAmount}`
                  : `Webhook currency mismatch: received ${currencyCode} vs expected USD`;

                console.error(`[custom-design/webhook] Flagging request ${reqDoc.id} for MANUAL_REVIEW: ${mismatchReason}`);
                transaction.update(reqDocRef, {
                  status: 'MANUAL_REVIEW',
                  paymentStatus: 'review_required',
                  paymentReference: captureId,
                  capturedAmount: amountVal,
                  capturedCurrency: currencyCode,
                  reconciliationRequired: true,
                  reconciliationReason: mismatchReason,
                  updatedAt: now,
                  statusHistory: [
                    ...(reqData.statusHistory || []),
                    {
                      from: reqData.status,
                      to: 'MANUAL_REVIEW',
                      actor: 'system',
                      timestamp: now,
                      reason: `${mismatchReason} via PayPal webhook ${event.id}`,
                    },
                  ],
                });
              } else {
                transaction.update(reqDocRef, {
                  paymentStatus: 'paid',
                  paymentReference: captureId,
                  status: 'SUBMITTED',
                  updatedAt: now,
                  statusHistory: [
                    ...(reqData.statusHistory || []),
                    {
                      from: reqData.status,
                      to: 'SUBMITTED',
                      actor: 'system',
                      timestamp: now,
                      reason: `Payment verified via PayPal webhook ${event.id}`,
                    },
                  ],
                });

                notificationPayload = {
                  type: 'request_submitted',
                  requestId: reqDoc.id,
                  requestNumber: reqData.requestId,
                  customerEmail: reqData.customerEmail,
                  customerName: reqData.customerName,
                  productType: reqData.productType,
                  plan: reqData.plan,
                  prepaymentAmount: reqData.prepaymentAmount,
                  description: reqData.description,
                  preferredSize: reqData.preferredSize,
                  preferredColor: reqData.preferredColor,
                  productPreference: reqData.productPreference,
                  additionalNotes: reqData.additionalNotes,
                  uploads: reqData.uploads,
                  paymentReference: captureId,
                };
              }
            }
          });
        } catch (err: any) {
          console.error('[custom-design/webhook] Transaction error:', err);
          return NextResponse.json({ error: 'Webhook processing transaction failed' }, { status: 500 });
        }

        if (!isWinner) {
          console.log(`[custom-design/webhook] Concurrent duplicate webhook event ${event.id} already processed.`);
          return NextResponse.json({ status: 'ok', message: 'Event already processed' });
        }

        // Only the winning transaction executes side effects
        if (notificationPayload) {
          try {
            await sendCustomDesignNotification(notificationPayload);
          } catch (err) {
            console.error('[custom-design/webhook] Non-fatal notification error:', err);
          }
        }

        return NextResponse.json({ status: 'ok', received: true });
      }
    }
  }

  // 3. Atomically record any unhandled or non-matching event
  let claimed = false;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      if (eventDoc.exists) {
        claimed = false;
        return;
      }
      transaction.set(eventRef, {
        eventId: event.id,
        eventType,
        processedAt: new Date().toISOString(),
      });
      claimed = true;
    });
  } catch (err) {
    console.error('[custom-design/webhook] Transaction error on event claim:', err);
    return NextResponse.json({ error: 'Internal failure' }, { status: 500 });
  }

  if (!claimed) {
    console.log(`[custom-design/webhook] Duplicate event ${event.id} already claimed.`);
    return NextResponse.json({ status: 'ok', message: 'Event already processed' });
  }

  return NextResponse.json({ status: 'ok', received: true });
}
