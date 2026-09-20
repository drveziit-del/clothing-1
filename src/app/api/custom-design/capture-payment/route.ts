import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { paypalGateway } from '@/lib/paypal/client';
import { sendCustomDesignNotification } from '@/lib/email/sender';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const captureSchema = z.object({
  requestId: z.string().min(1),
  paypalOrderId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'custom_design_capture', { limit: 15, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many capture requests. Please wait.' }, { status: 429 });
  }

  // 1. Authenticate user
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = captureSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
  }

  const { requestId, paypalOrderId } = result.data;

  // 3. Fetch custom request document & check ownership
  const reqRef = adminDb.collection('customDesignRequests').doc(requestId);
  const reqDoc = await reqRef.get();

  if (!reqDoc.exists) {
    return NextResponse.json({ error: 'Custom design request not found' }, { status: 404 });
  }

  const reqData = reqDoc.data()!;

  // IDOR Guard: Only the request owner can capture payment
  if (reqData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden: You do not own this custom request' }, { status: 403 });
  }

  // Binding Guard: Check that the provided PayPal order matches the one stored on the request
  if (!reqData.paypalOrderId || reqData.paypalOrderId !== paypalOrderId) {
    console.error(`[custom-design/capture] PayPal order ID mismatch: stored ${reqData.paypalOrderId} vs received ${paypalOrderId}`);
    return NextResponse.json({ error: 'PayPal order ID mismatch' }, { status: 403 });
  }

  // Idempotency Guard: If already captured or paid, return success immediately
  if (reqData.paymentStatus === 'paid' || reqData.status === 'SUBMITTED') {
    return NextResponse.json({
      success: true,
      requestId,
      requestNumber: reqData.requestId,
      status: reqData.status,
      message: 'Payment already verified and captured',
    });
  }

  const now = new Date().toISOString();

  // 4. Move state to PAYMENT_PROCESSING (only if not already in PAYMENT_PROCESSING)
  if (reqData.status !== 'PAYMENT_PROCESSING') {
    await reqRef.update({
      status: 'PAYMENT_PROCESSING',
      paymentStatus: 'processing',
      updatedAt: now,
      statusHistory: [
        ...(reqData.statusHistory || []),
        {
          from: reqData.status,
          to: 'PAYMENT_PROCESSING',
          actor: 'system',
          timestamp: now,
          reason: 'Payment capture initiated',
        },
      ],
    });
  }

  // 5. Authoritatively capture order via PayPal REST API
  let captureResult: { captureId: string; status: string; amountValue?: number; currency?: string };
  try {
    captureResult = await paypalGateway.captureOrder(paypalOrderId);
  } catch (err: any) {
    console.error(`[custom-design/capture] PayPal capture failed for ${paypalOrderId}:`, err);
    // Mark as PAYMENT_FAILED so customer can retry
    await reqRef.update({
      status: 'PAYMENT_FAILED',
      paymentStatus: 'failed',
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(reqData.statusHistory || []),
        {
          from: 'PAYMENT_PROCESSING',
          to: 'PAYMENT_FAILED',
          actor: 'system',
          timestamp: new Date().toISOString(),
          reason: err?.message || 'PayPal capture authorization failed',
        },
      ],
    });

    return NextResponse.json(
      { error: 'Payment capture failed. Your request is saved and you can try again.' },
      { status: 400 }
    );
  }

  if (captureResult.status !== 'COMPLETED') {
    const isPendingReview = captureResult.status === 'PENDING';
    const nextStatus = isPendingReview ? 'MANUAL_REVIEW' : 'PAYMENT_FAILED';
    const nextPaymentStatus = isPendingReview ? 'review_required' : 'failed';
    const updateTime = new Date().toISOString();

    await reqRef.update({
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      paymentReference: captureResult.captureId || null,
      reconciliationRequired: isPendingReview,
      reconciliationReason: isPendingReview ? `PayPal capture status: ${captureResult.status}` : undefined,
      updatedAt: updateTime,
      statusHistory: [
        ...(reqData.statusHistory || []),
        {
          from: 'PAYMENT_PROCESSING',
          to: nextStatus,
          actor: 'system',
          timestamp: updateTime,
          reason: `PayPal capture provider status: ${captureResult.status}`,
        },
      ],
    });

    return NextResponse.json(
      {
        error: isPendingReview
          ? 'Payment is pending review with PayPal. Our team will verify it shortly.'
          : `Payment not completed by provider (status: ${captureResult.status})`,
        status: nextStatus,
        captureId: captureResult.captureId,
      },
      { status: 400 }
    );
  }

  // 6. Amount & Currency Integrity Guard: verify captured amount matches server-authoritative prepayment amount ($15 or $20)
  const expectedAmount = Number(reqData.prepaymentAmount);
  const amountMismatch =
    typeof captureResult.amountValue === 'number' &&
    Math.abs(captureResult.amountValue - expectedAmount) > 0.05;
  const currencyMismatch =
    Boolean(captureResult.currency && captureResult.currency !== 'USD');

  if (amountMismatch || currencyMismatch) {
    const mismatchReason = amountMismatch
      ? `Captured amount mismatch ($${captureResult.amountValue} vs expected $${expectedAmount})`
      : `Captured currency mismatch (${captureResult.currency} vs expected USD)`;

    console.error(
      `[custom-design/capture] Reconciliation Alert: ${mismatchReason}. Persisting capture evidence ${captureResult.captureId} for manual review.`
    );

    const reviewTimestamp = new Date().toISOString();
    await reqRef.update({
      status: 'MANUAL_REVIEW',
      paymentStatus: 'review_required',
      paymentReference: captureResult.captureId,
      capturedAmount: captureResult.amountValue ?? null,
      capturedCurrency: captureResult.currency ?? null,
      reconciliationRequired: true,
      reconciliationReason: mismatchReason,
      updatedAt: reviewTimestamp,
      statusHistory: [
        ...(reqData.statusHistory || []),
        {
          from: 'PAYMENT_PROCESSING',
          to: 'MANUAL_REVIEW',
          actor: 'system',
          timestamp: reviewTimestamp,
          reason: `${mismatchReason}. PayPal capture ${captureResult.captureId} saved for manual reconciliation.`,
        },
      ],
    });

    return NextResponse.json(
      {
        error: 'Payment captured but flagged for manual review due to discrepancy. Our studio will review and confirm your request.',
        status: 'MANUAL_REVIEW',
        requestId,
        captureId: captureResult.captureId,
      },
      { status: 422 }
    );
  }

  // 7. Transactionally update request to PAID and SUBMITTED
  const finalTimestamp = new Date().toISOString();
  await adminDb.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(reqRef);
    if (!currentSnap.exists) throw new Error('Request not found during transaction');
    const currentData = currentSnap.data()!;

    if (currentData.paymentStatus === 'paid') return; // idempotent

    const updatedHistory = [...(currentData.statusHistory || [])];
    // Finding 4.3: Accurately record real transition from PAYMENT_PROCESSING to SUBMITTED
    updatedHistory.push({
      from: currentData.status,
      to: 'SUBMITTED',
      actor: 'system',
      timestamp: finalTimestamp,
      reason: `PayPal capture ${captureResult.captureId} completed and request officially submitted for review`,
    });

    transaction.update(reqRef, {
      paymentStatus: 'paid',
      paymentReference: captureResult.captureId,
      status: 'SUBMITTED',
      updatedAt: finalTimestamp,
      statusHistory: updatedHistory,
    });
  });

  // 8. Send Confirmation & Admin Notification
  try {
    await sendCustomDesignNotification({
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
      paymentReference: captureResult.captureId,
    });
  } catch (emailErr) {
    console.warn('[custom-design/capture] Email notification failed non-fatally:', emailErr);
  }

  return NextResponse.json({
    success: true,
    requestId,
    requestNumber: reqData.requestId,
    status: 'SUBMITTED',
    paymentStatus: 'paid',
    paymentReference: captureResult.captureId,
  });
}
