import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/types';

const MIN_ORDER_FOR_REFERRAL = 100; // USD
const COMMISSION_PER_10_REFERRALS = 100; // USD
const MILESTONE_CUSTOMER = 100000;
const MILESTONE_REWARD = 100000; // USD

export interface ProcessReferralResult {
  processed: boolean;
  milestoneAwarded: boolean;
  commission: number;
  globalCount?: number;
}

export async function processReferral(order: Order): Promise<ProcessReferralResult> {
  // 1. Validate order value (check subtotal to support coupon deductions and test amounts)
  const orderValue = order.subtotal || order.total || 0;
  if (orderValue < MIN_ORDER_FOR_REFERRAL) {
    return { processed: false, milestoneAwarded: false, commission: 0 };
  }
  if (!order.referralCode) {
    return { processed: false, milestoneAwarded: false, commission: 0 };
  }

  const uppercaseCode = order.referralCode.trim().toUpperCase();

  // 2. Find affiliate by referral code across users, referral_codes, and orders
  let affiliateRef: FirebaseFirestore.DocumentReference | null = null;
  let affiliateUid: string | null = null;

  const affiliateSnap = await adminDb
    .collection('users')
    .where('referralCode', '==', uppercaseCode)
    .limit(1)
    .get();

  if (!affiliateSnap.empty) {
    affiliateRef = affiliateSnap.docs[0].ref;
    affiliateUid = affiliateSnap.docs[0].id;
  } else {
    // Check referral_codes collection
    const codeDoc = await adminDb.collection('referral_codes').doc(uppercaseCode).get();
    if (codeDoc.exists) {
      const codeData = codeDoc.data() || {};
      if (codeData.userId && !codeData.userId.startsWith('guest_')) {
        affiliateUid = codeData.userId;
        affiliateRef = adminDb.collection('users').doc(codeData.userId);
      } else if (codeData.orderId) {
        const oDoc = await adminDb.collection('orders').doc(codeData.orderId).get();
        if (oDoc.exists) {
          const oData = oDoc.data() || {};
          if (oData.userId && !oData.userId.startsWith('guest_')) {
            affiliateUid = oData.userId;
            affiliateRef = adminDb.collection('users').doc(oData.userId);
          }
        }
      }
    }
  }

  if (!affiliateRef) {
    // Check orders collection
    const orderSnap = await adminDb
      .collection('orders')
      .where('userReferralCode', '==', uppercaseCode)
      .limit(1)
      .get();
    if (!orderSnap.empty) {
      const oData = orderSnap.docs[0].data() || {};
      if (oData.userId && !oData.userId.startsWith('guest_')) {
        affiliateUid = oData.userId;
        affiliateRef = adminDb.collection('users').doc(oData.userId);
      }
    }
  }

  if (!affiliateRef || !affiliateUid) {
    return { processed: false, milestoneAwarded: false, commission: 0 };
  }

  // 3. Run checking, writes, increments, and milestone checks inside transaction
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const referralRef = adminDb.collection('referrals').doc(`referral_${order.id}`);
      const settingsRef = adminDb.collection('settings').doc('global');

      // CRITICAL: ALL READS MUST OCCUR BEFORE ANY WRITES IN FIRESTORE TRANSACTIONS
      const refDoc = await transaction.get(referralRef);
      if (refDoc.exists) {
        return { processed: false, milestoneAwarded: false, commission: 0 }; // Idempotency check
      }

      const freshAffiliateDoc = await transaction.get(affiliateRef!);
      const globalSettingsDoc = await transaction.get(settingsRef);

      // Pre-read the milestone doc (must happen before any writes)
      const milestoneRef = adminDb.collection('milestones').doc(`milestone_${MILESTONE_CUSTOMER}`);
      const existingMilestone = await transaction.get(milestoneRef);

      // Calculations
      const currentCount: number = freshAffiliateDoc.data()?.referralCount ?? 0;
      const newCount = currentCount + 1;
      const commission = newCount % 10 === 0 ? COMMISSION_PER_10_REFERRALS : 0;

      const prevCount = globalSettingsDoc.data()?.globalReferralCount ?? 0;
      const newGlobalCount = prevCount + 1;

      const referralData = {
        affiliateUid,
        affiliateCode: uppercaseCode,
        referredUid: order.userId,
        orderId: order.id,
        orderValue: orderValue,
        commission,
        isSelfReferral: order.userId === affiliateUid,
        status: commission > 0 ? 'eligible_for_claim' : 'pending',
      };

      // ALL WRITES AFTER READS
      // 1. Write referral event
      transaction.set(referralRef, {
        ...referralData,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 2. Update affiliate stats
      transaction.set(affiliateRef!, {
        referralCount: newCount,
        totalEarnings: FieldValue.increment(commission),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // 3. Update global referral counter authoritatively
      transaction.set(
        settingsRef,
        {
          globalReferralCount: newGlobalCount,
          totalCustomers: newGlobalCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Check for 100,000th customer milestone reward.
      // Strictly triggers ONLY on the exact intended global count (=== MILESTONE_CUSTOMER)
      // or if admin milestone bypass is explicitly requested.
      const hasAdminBypass = Boolean((order as any).adminMilestoneBypass);
      const isExactMilestone = (newGlobalCount === MILESTONE_CUSTOMER || hasAdminBypass);
      let milestoneAwarded = false;

      if (isExactMilestone && !existingMilestone.exists) {
        milestoneAwarded = true;
        transaction.set(milestoneRef, {
          affiliateUid,
          orderId: order.id,
          reward: MILESTONE_REWARD,
          type: '100000th_customer',
          status: 'pending_review',
          awardedAtCount: newGlobalCount,
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.set(affiliateRef!, {
          milestoneReward: MILESTONE_REWARD,
          milestoneAchieved: true,
          totalEarnings: FieldValue.increment(MILESTONE_REWARD),
        }, { merge: true });
      }

      return {
        processed: true,
        milestoneAwarded,
        commission,
        globalCount: newGlobalCount,
      };
    });
  } catch (err) {
    console.error('Referral processing transaction failed:', err);
    return { processed: false, milestoneAwarded: false, commission: 0 };
  }
}
