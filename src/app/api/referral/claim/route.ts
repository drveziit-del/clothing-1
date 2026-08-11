import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { refundRazorpayPayment } from '@/lib/razorpay/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { decrypt } from '@/lib/utils/encryption';
import { sendAdminPayoutAlert } from '@/lib/email/sender';

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
  let body: { claimType?: 'refund' | 'coupon' | 'wise' | 'paypal' | 'bank'; orderId?: string; requestedAmount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { claimType, orderId, requestedAmount } = body;
  if (!claimType || !['refund', 'coupon', 'wise', 'paypal', 'bank'].includes(claimType)) {
    return NextResponse.json({ error: 'Invalid claim type' }, { status: 400 });
  }

  if (claimType === 'refund' && !orderId) {
    return NextResponse.json({ error: 'Order ID is required for refunds' }, { status: 400 });
  }

  // 3. Find eligible referrals with remaining commissions
  const referralsSnap = await adminDb.collection('referrals')
    .where('affiliateUid', '==', uid)
    .where('status', '==', 'eligible_for_claim')
    .get();

  if (referralsSnap.empty) {
    return NextResponse.json({ error: 'No rewards eligible for claim' }, { status: 400 });
  }

  const docRefs = referralsSnap.docs.map(doc => doc.ref);
  const userRef = adminDb.collection('users').doc(uid);

  // 4. Handle Refund
  if (claimType === 'refund') {
    const orderRef = adminDb.collection('orders').doc(orderId!);
    let refundAmount = 0;
    let razorpayPaymentId = '';
    let deductions: Array<{ ref: any; previousClaimed: number; deductAmount: number; isFullyClaimed: boolean }> = [];

    try {
      await adminDb.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) {
          throw new Error('Order not found');
        }

        const orderData = orderDoc.data()!;
        if (orderData.userId !== uid) {
          throw new Error('Forbidden');
        }

        if (!['paid', 'in_production', 'shipped', 'delivered'].includes(orderData.status)) {
          throw new Error('Order is not in a paid state');
        }

        if (!orderData.razorpayPaymentId) {
          throw new Error('Order does not have a payment reference');
        }

        razorpayPaymentId = orderData.razorpayPaymentId;

        const docs = await Promise.all(docRefs.map(ref => transaction.get(ref)));
        const eligibleRefs = docs.map(doc => ({
          id: doc.id,
          ref: doc.ref,
          ...(doc.data() as any)
        }));

        const availableBalance = eligibleRefs.reduce((sum, ref) => {
          const remaining = ref.commission - (ref.commissionClaimed || 0);
          return sum + (remaining > 0 ? remaining : 0);
        }, 0);

        if (availableBalance <= 0) {
          throw new Error('No rewards eligible for claim');
        }

        const currentRefunded = orderData.referralRefundedAmount ?? 0;
        const remainingRefundable = orderData.total - currentRefunded;

        if (remainingRefundable <= 0) {
          throw new Error('This order has no remaining refundable balance');
        }

        refundAmount = Math.round(Math.min(availableBalance, remainingRefundable) * 100) / 100;
        if (refundAmount <= 0) {
          throw new Error('No refundable balance eligible');
        }

        // Allocate deductions from oldest referrals first
        eligibleRefs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let remainingToDeduct = refundAmount;
        deductions = [];

        for (const ref of eligibleRefs) {
          if (remainingToDeduct <= 0) break;
          const remainingCommission = ref.commission - (ref.commissionClaimed || 0);
          if (remainingCommission <= 0) continue;

          const deductFromThisRef = Math.min(remainingToDeduct, remainingCommission);
          const newClaimed = (ref.commissionClaimed || 0) + deductFromThisRef;
          remainingToDeduct = Math.round((remainingToDeduct - deductFromThisRef) * 100) / 100;

          const isFullyClaimed = newClaimed >= ref.commission;

          deductions.push({
            ref: ref.ref,
            previousClaimed: ref.commissionClaimed || 0,
            deductAmount: deductFromThisRef,
            isFullyClaimed
          });

          transaction.update(ref.ref, {
            commissionClaimed: newClaimed,
            status: isFullyClaimed ? 'claimed' : 'eligible_for_claim',
            payoutMethod: 'refund',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        transaction.update(orderRef, {
          referralRefundedAmount: FieldValue.increment(refundAmount),
        });

        transaction.update(userRef, {
          totalEarnings: FieldValue.increment(refundAmount),
        });
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
    }

    // Execute Razorpay refund outer transaction
    try {
      const rzpRefund = await refundRazorpayPayment(razorpayPaymentId, refundAmount);

      // Save refund ID to referrals
      const batch = adminDb.batch();
      for (const item of deductions) {
        batch.update(item.ref, {
          payoutDetail: rzpRefund.id,
        });
      }
      await batch.commit();

      return NextResponse.json({
        status: 'ok',
        method: 'refund',
        refundId: rzpRefund.id,
        refundAmount,
      });
    } catch (err: any) {
      console.error('Razorpay Refund API error, performing rollback:', err);
      // Rollback database changes atomically
      try {
        await adminDb.runTransaction(async (transaction) => {
          for (const item of deductions) {
            transaction.update(item.ref, {
              commissionClaimed: item.previousClaimed,
              status: 'eligible_for_claim',
              payoutMethod: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          transaction.update(orderRef, {
            referralRefundedAmount: FieldValue.increment(-refundAmount),
          });
          transaction.update(userRef, {
            totalEarnings: FieldValue.increment(-refundAmount),
          });
        });
      } catch (rollbackErr) {
        console.error('CRITICAL: Rollback failed for refund:', rollbackErr);
      }

      return NextResponse.json({ error: 'Refund processing failed on payment gateway' }, { status: 500 });
    }
  }

  // 5. Handle Coupon
  if (claimType === 'coupon') {
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Valid claim amount is required' }, { status: 400 });
    }
    const claimAmount = Math.round(requestedAmount * 100) / 100;
    const couponCode = `GERK-${Math.round(claimAmount)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const docs = await Promise.all(docRefs.map(ref => transaction.get(ref)));
        const eligibleRefs = docs.map(doc => ({
          id: doc.id,
          ref: doc.ref,
          ...(doc.data() as any)
        }));

        const availableBalance = eligibleRefs.reduce((sum, ref) => {
          const remaining = ref.commission - (ref.commissionClaimed || 0);
          return sum + (remaining > 0 ? remaining : 0);
        }, 0);

        if (availableBalance <= 0) {
          throw new Error('No rewards eligible for claim');
        }

        if (claimAmount > availableBalance) {
          throw new Error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${claimAmount.toFixed(2)}`);
        }

        eligibleRefs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let remainingToDeduct = claimAmount;

        for (const ref of eligibleRefs) {
          if (remainingToDeduct <= 0) break;
          const remainingCommission = ref.commission - (ref.commissionClaimed || 0);
          if (remainingCommission <= 0) continue;

          const deductFromThisRef = Math.min(remainingToDeduct, remainingCommission);
          const newClaimed = (ref.commissionClaimed || 0) + deductFromThisRef;
          remainingToDeduct = Math.round((remainingToDeduct - deductFromThisRef) * 100) / 100;

          const isFullyClaimed = newClaimed >= ref.commission;

          transaction.update(ref.ref, {
            commissionClaimed: newClaimed,
            status: isFullyClaimed ? 'claimed' : 'eligible_for_claim',
            payoutMethod: 'coupon',
            payoutDetail: couponCode,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        const couponRef = adminDb.collection('coupons').doc();
        transaction.set(couponRef, {
          code: couponCode,
          value: claimAmount,
          userId: uid,
          isUsed: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.update(userRef, {
          totalEarnings: FieldValue.increment(claimAmount),
        });
      });

      return NextResponse.json({
        status: 'ok',
        method: 'coupon',
        couponCode,
        amount: claimAmount,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
    }
  }

  // 6. Handle Manual Payouts (Wise / PayPal / Bank)
  if (['wise', 'paypal', 'bank'].includes(claimType)) {
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Valid claim amount is required' }, { status: 400 });
    }
    const claimAmount = Math.round(requestedAmount * 100) / 100;

    try {
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      const userData = userDoc.data() || {};
      const securePayoutDoc = await userRef.collection('secure_payout_details').doc('payout').get();
      const prefs = securePayoutDoc.exists ? securePayoutDoc.data()?.payoutPreferences : null;

      if (!prefs || prefs.method !== claimType) {
        return NextResponse.json({ error: `Please configure your ${claimType} payout settings before claiming.` }, { status: 400 });
      }

      let payoutDetailsRaw = '';
      let payoutDetailsMasked = '';

      if (claimType === 'wise' || claimType === 'paypal') {
        payoutDetailsRaw = `Email: ${prefs.email}`;
        payoutDetailsMasked = `Email: ${prefs.email}`;
      } else if (claimType === 'bank' && prefs.bankDetails) {
        const decryptedNumber = decrypt(prefs.bankDetails.accountNumber);
        const decryptedRouting = decrypt(prefs.bankDetails.routingNumber);
        const maskedNumber = decryptedNumber.slice(0, -4).replace(/./g, '*') + decryptedNumber.slice(-4);

        payoutDetailsRaw = `Account Name: ${prefs.bankDetails.accountHolderName}\nAccount Type: ${prefs.bankDetails.accountType}\nRouting Number: ${decryptedRouting}\nAccount Number: ${decryptedNumber}\nEmail: ${prefs.bankDetails.email || 'N/A'}\nAddress: ${prefs.bankDetails.streetAddress}, ${prefs.bankDetails.city}, ${prefs.bankDetails.state} ${prefs.bankDetails.zipCode}, ${prefs.bankDetails.country}`;
        payoutDetailsMasked = `Account Name: ${prefs.bankDetails.accountHolderName}\nAccount Type: ${prefs.bankDetails.accountType}\nRouting Number: ${decryptedRouting}\nAccount Number: ${maskedNumber}\nEmail: ${prefs.bankDetails.email || 'N/A'}\nAddress: ${prefs.bankDetails.streetAddress}, ${prefs.bankDetails.city}, ${prefs.bankDetails.state} ${prefs.bankDetails.zipCode}, ${prefs.bankDetails.country}`;
      }

      const payoutRef = adminDb.collection('payout_requests').doc();

      await adminDb.runTransaction(async (transaction) => {
        const docs = await Promise.all(docRefs.map(ref => transaction.get(ref)));
        const eligibleRefs = docs.map(doc => ({
          id: doc.id,
          ref: doc.ref,
          ...(doc.data() as any)
        }));

        const availableBalance = eligibleRefs.reduce((sum, ref) => {
          const remaining = ref.commission - (ref.commissionClaimed || 0);
          return sum + (remaining > 0 ? remaining : 0);
        }, 0);

        if (availableBalance <= 0) {
          throw new Error('No rewards eligible for claim');
        }

        if (claimAmount > availableBalance) {
          throw new Error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${claimAmount.toFixed(2)}`);
        }

        eligibleRefs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let remainingToDeduct = claimAmount;

        for (const ref of eligibleRefs) {
          if (remainingToDeduct <= 0) break;
          const remainingCommission = ref.commission - (ref.commissionClaimed || 0);
          if (remainingCommission <= 0) continue;

          const deductFromThisRef = Math.min(remainingToDeduct, remainingCommission);
          const newClaimed = (ref.commissionClaimed || 0) + deductFromThisRef;
          remainingToDeduct = Math.round((remainingToDeduct - deductFromThisRef) * 100) / 100;

          const isFullyClaimed = newClaimed >= ref.commission;

          transaction.update(ref.ref, {
            commissionClaimed: newClaimed,
            status: isFullyClaimed ? 'claimed' : 'eligible_for_claim',
            payoutMethod: claimType,
            payoutDetail: payoutRef.id,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        transaction.set(payoutRef, {
          userId: uid,
          userName: userData.displayName || 'Affiliate User',
          userEmail: userData.email || 'No email',
          amount: claimAmount,
          method: claimType,
          payoutDetails: payoutDetailsMasked,
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.update(userRef, {
          totalEarnings: FieldValue.increment(claimAmount),
        });
      });

      // Trigger Admin Email Alert in background (does not block API response)
      sendAdminPayoutAlert({
        userName: userData.displayName || 'Affiliate User',
        userEmail: userData.email || 'No email',
        method: claimType,
        amount: claimAmount,
        payoutDetails: payoutDetailsRaw,
      }).catch(err => {
        console.error('Background alert email failure:', err);
      });

      return NextResponse.json({
        status: 'ok',
        method: claimType,
        payoutRequestId: payoutRef.id,
        amount: claimAmount,
      });

    } catch (err: any) {
      console.error('Manual payout creation error:', err);
      return NextResponse.json({ error: err.message || 'Failed to submit payout request' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
