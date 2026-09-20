import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyPaymentSchema } from '@/lib/utils/validation';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { sendAdminPrebookNotification } from '@/lib/email/sender';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { enqueueOrderProcessing, appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import { validateCoupon } from '@/lib/utils/couponValidator';
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
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

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

  // 4. Preflight (non-transactional): fetch order, verify ownership & binding, resolve coupon
  const orderRef = adminDb.collection('orders').doc(orderId);
  const preflight = await orderRef.get();

  if (!preflight.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const preData = preflight.data()!;
  if (preData.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (preData.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: 'Order ID mismatch' }, { status: 400 });
  }

  // Resolve coupon BEFORE the transaction — validateCoupon runs its own non-transactional reads.
  let couponRef: DocumentReference | null = null;
  let couponIsGlobal = false;
  if (preData.couponCode && preData.status === 'pending') {
    const couponResult = await validateCoupon(preData.couponCode, uid, preData.subtotal, preData.tax);
    if (couponResult.valid && couponResult.couponRef) {
      couponRef = couponResult.couponRef;
      couponIsGlobal = !!couponResult.couponData.isGlobal;
    }
  }

  // 5. Atomic commit: re-read order inside a transaction, flip status, consume coupon.
  //    Prevents TOCTOU double-processing when this route races the payment webhook.
  let orderData: any = null;
  let alreadyProcessed = false;

  try {
    await adminDb.runTransaction(async (transaction) => {
      // 1. All reads must occur before any writes
      const snap = await transaction.get(orderRef);
      if (!snap.exists) throw new Error('ORDER_MISSING');

      orderData = snap.data()!;

      // Authoritative re-checks inside the transaction
      if (orderData.userId !== uid || orderData.razorpayOrderId !== razorpay_order_id) {
        throw new Error('ORDER_MISMATCH');
      }

      // Idempotency: skip double processing
      if (orderData.status === 'paid' || orderData.status === 'in_production' || orderData.paymentCaptured) {
        alreadyProcessed = true;
        return;
      }

      let couponDocSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (couponRef) {
        couponDocSnap = await transaction.get(couponRef);
      }

      // 2. Validate coupon state inside the transaction
      let couponValidInsideTx = false;
      let couponConflictReason: string | null = null;

      if (couponDocSnap && couponDocSnap.exists) {
        const cData = couponDocSnap.data()!;
        const isGlobal = !!cData.isGlobal;
        const timesUsed = cData.timesUsed || 0;
        const maxUses = cData.maxUses;

        if (!isGlobal && cData.isUsed) {
          couponConflictReason = 'Single-use coupon was already used';
        } else if (isGlobal && typeof maxUses === 'number' && timesUsed >= maxUses) {
          couponConflictReason = 'Global coupon reached maximum usage limit';
        } else if (cData.isActive === false) {
          couponConflictReason = 'Coupon is inactive';
        } else if (cData.expiresAt) {
          const expiryDate = typeof cData.expiresAt?.toDate === 'function'
            ? cData.expiresAt.toDate()
            : new Date(cData.expiresAt);
          if (Number.isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
            couponConflictReason = 'Coupon has expired';
          } else {
            couponValidInsideTx = true;
          }
        } else {
          couponValidInsideTx = true;
        }
      } else if (couponRef) {
        couponConflictReason = 'Coupon document not found during transaction';
      }

      // 3. Writes: Record payment. If coupon was exhausted concurrently,
      //    the captured payment MUST still be recorded on the order with a conflict flag.
      const orderUpdates: Record<string, any> = {
        status:             'paid',
        paymentCaptured:    true,
        razorpayPaymentId:  razorpay_payment_id,
        updatedAt:          FieldValue.serverTimestamp(),
      };

      if (couponRef) {
        if (couponValidInsideTx) {
          orderUpdates.couponConsumed = true;
          if (couponIsGlobal) {
            transaction.update(couponRef, {
              timesUsed: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            });
          } else {
            transaction.update(couponRef, {
              isUsed: true,
              usedAt: FieldValue.serverTimestamp(),
              orderId: orderId,
              timesUsed: FieldValue.increment(1),
            });
          }
        } else {
          orderUpdates.couponConflict = true;
          orderUpdates.couponConflictReason = couponConflictReason;
        }
      }

      transaction.update(orderRef, orderUpdates);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ORDER_MISSING') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (msg === 'ORDER_MISMATCH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw err;
  }

  if (alreadyProcessed) {
    return NextResponse.json({ status: 'ok', orderId, message: 'Order already verified' });
  }

  await appendOrderHistory(orderId, 'razorpay_payment_verified', 'customer', { razorpay_payment_id });

  if (orderData.isPrebooking) {
    try {
      await sendAdminPrebookNotification({
        userName: orderData.prebookName || 'Anonymous User',
        userEmail: orderData.prebookEmail || orderData.userEmail,
        productTitle: orderData.items?.[0]?.title || 'Luxury Product',
        prebookingPricePaid: orderData.total,
        message: orderData.prebookMessage || '',
      });
    } catch (err) {
      console.error('Failed to send admin prebook email:', err);
    }
    return NextResponse.json({ status: 'ok', orderId });
  }

  // 6. Delegate background processing (referral, email, Printify) to orchestrator
  await enqueueOrderProcessing(orderId);

  return NextResponse.json({ status: 'ok', orderId });
}
