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

  const eligibleRefs = referralsSnap.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    ...(doc.data() as any)
  }));

  // Calculate available balance summing (commission - commissionClaimed)
  const availableBalance = eligibleRefs.reduce((sum, ref) => {
    const remaining = ref.commission - (ref.commissionClaimed || 0);
    return sum + (remaining > 0 ? remaining : 0);
  }, 0);

  if (availableBalance <= 0) {
    return NextResponse.json({ error: 'No rewards eligible for claim' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(uid);

  // Validate claimAmount for non-refund methods
  let claimAmount = 0;
  const deductions: Array<{ ref: any; updates: any }> = [];

  if (claimType !== 'refund') {
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Valid claim amount is required' }, { status: 400 });
    }
    claimAmount = Math.round(requestedAmount * 100) / 100;

    // Security Measure: Prevent claiming more than available balance
    if (claimAmount > availableBalance) {
      return NextResponse.json({
        error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${claimAmount.toFixed(2)}`
      }, { status: 400 });
    }

    // Allocate deductions from oldest referrals first
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

      deductions.push({
        ref: ref.ref,
        updates: {
          commissionClaimed: newClaimed,
          status: isFullyClaimed ? 'claimed' : 'eligible_for_claim',
          payoutMethod: claimType,
          updatedAt: FieldValue.serverTimestamp(),
        }
      });
    }
  }

  // 4. Handle Refund
  if (claimType === 'refund') {
    const orderRef = adminDb.collection('orders').doc(orderId!);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data()!;
    if (orderData.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!['paid', 'in_production', 'shipped', 'delivered'].includes(orderData.status)) {
      return NextResponse.json({ error: 'Order is not in a paid state' }, { status: 400 });
    }

    if (!orderData.razorpayPaymentId) {
      return NextResponse.json({ error: 'Order does not have a payment reference' }, { status: 400 });
    }

    const currentRefunded = orderData.referralRefundedAmount ?? 0;
    const remainingRefundable = orderData.total - currentRefunded;

    if (remainingRefundable <= 0) {
      return NextResponse.json({ error: 'This order has no remaining refundable balance' }, { status: 400 });
    }

    // Refund up to available balance
    const refundAmount = Math.round(Math.min(availableBalance, remainingRefundable) * 100) / 100;
    if (refundAmount <= 0) {
      return NextResponse.json({ error: 'No refundable balance eligible' }, { status: 400 });
    }

    claimAmount = refundAmount;

    // Allocate deductions from oldest referrals first
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

      deductions.push({
        ref: ref.ref,
        updates: {
          commissionClaimed: newClaimed,
          status: isFullyClaimed ? 'claimed' : 'eligible_for_claim',
          payoutMethod: 'refund',
          updatedAt: FieldValue.serverTimestamp(),
        }
      });
    }

    try {
      // Execute Razorpay refund
      const rzpRefund = await refundRazorpayPayment(orderData.razorpayPaymentId, refundAmount);

      const batch = adminDb.batch();

      // Update order refunded amount
      batch.update(orderRef, {
        referralRefundedAmount: FieldValue.increment(refundAmount),
      });

      // Update referrals
      for (const item of deductions) {
        batch.update(item.ref, {
          ...item.updates,
          payoutDetail: rzpRefund.id,
        });
      }

      // Update user total earnings
      batch.update(userRef, {
        totalEarnings: FieldValue.increment(refundAmount),
      });

      await batch.commit();

      return NextResponse.json({
        status: 'ok',
        method: 'refund',
        refundId: rzpRefund.id,
        refundAmount,
      });

    } catch (err: any) {
      console.error('Razorpay Refund API error:', err);
      return NextResponse.json({ error: err.message || 'Refund processing failed on payment gateway' }, { status: 500 });
    }
  }

  // 5. Handle Coupon
  if (claimType === 'coupon') {
    const couponCode = `GERK-${Math.round(claimAmount)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const batch = adminDb.batch();

    // Create coupon document
    const couponRef = adminDb.collection('coupons').doc();
    batch.set(couponRef, {
      code: couponCode,
      value: claimAmount,
      userId: uid,
      isUsed: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update referrals
    for (const item of deductions) {
      batch.update(item.ref, {
        ...item.updates,
        payoutDetail: couponCode,
      });
    }

    // Update user earnings
    batch.update(userRef, {
      totalEarnings: FieldValue.increment(claimAmount),
    });

    await batch.commit();

    return NextResponse.json({
      status: 'ok',
      method: 'coupon',
      couponCode,
      amount: claimAmount,
    });
  }

  // 6. Handle Manual Payouts (Wise / PayPal / Bank)
  if (['wise', 'paypal', 'bank'].includes(claimType)) {
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
      const batch = adminDb.batch();

      // Create payout request
      batch.set(payoutRef, {
        userId: uid,
        userName: userData.displayName || 'Affiliate User',
        userEmail: userData.email || 'No email',
        amount: claimAmount,
        method: claimType,
        payoutDetails: payoutDetailsMasked, // Store masked version in DB
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update referrals
      for (const item of deductions) {
        batch.update(item.ref, {
          ...item.updates,
          payoutDetail: payoutRef.id,
        });
      }

      // Update user earnings
      batch.update(userRef, {
        totalEarnings: FieldValue.increment(claimAmount),
      });

      await batch.commit();

      // Trigger Admin Email Alert in background (does not block API response)
      sendAdminPayoutAlert({
        userName: userData.displayName || 'Affiliate User',
        userEmail: userData.email || 'No email',
        method: claimType,
        amount: claimAmount,
        payoutDetails: payoutDetailsRaw, // Send full unmasked details in email
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
      return NextResponse.json({ error: err.message || 'Failed to submit payout request' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
