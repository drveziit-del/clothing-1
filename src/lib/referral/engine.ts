import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/types';

const MIN_ORDER_FOR_REFERRAL = 100; // USD
const COMMISSION_PER_10_REFERRALS = 100; // USD
const MILESTONE_CUSTOMER = 100000;
const MILESTONE_REWARD = 100000; // USD

export async function processReferral(order: Order): Promise<void> {
  // 1. Validate order value (check subtotal to support coupon deductions and test amounts)
  const orderValue = order.subtotal || order.total || 0;
  if (orderValue < MIN_ORDER_FOR_REFERRAL) return;
  if (!order.referralCode) return;

  // 2. Find affiliate by referral code
  const affiliateSnap = await adminDb
    .collection('users')
    .where('referralCode', '==', order.referralCode)
    .limit(1)
    .get();

  if (affiliateSnap.empty) return;

  const affiliateDoc = affiliateSnap.docs[0];
  const affiliateUid = affiliateDoc.id;

  // 3. Run checking, writes, increments, and milestone checks inside transaction
  try {
    await adminDb.runTransaction(async (transaction) => {
      const referralRef = adminDb.collection('referrals').doc(`referral_${order.id}`);
      const settingsRef = adminDb.collection('settings').doc('global');

      // CRITICAL: ALL READS MUST OCCUR BEFORE ANY WRITES IN FIRESTORE TRANSACTIONS
      const refDoc = await transaction.get(referralRef);
      if (refDoc.exists) return; // Idempotency check

      const freshAffiliateDoc = await transaction.get(affiliateDoc.ref);
      const globalSettingsDoc = await transaction.get(settingsRef);

      // Calculations
      const currentCount: number = freshAffiliateDoc.data()?.referralCount ?? 0;
      const newCount = currentCount + 1;
      const commission = newCount % 10 === 0 ? COMMISSION_PER_10_REFERRALS : 0;

      const prevCount = globalSettingsDoc.data()?.globalReferralCount ?? 0;
      const newGlobalCount = prevCount + 1;

      const referralData = {
        affiliateUid,
        affiliateCode: order.referralCode,
        referredUid: order.userId,
        orderId: order.id,
        orderValue: orderValue,
        commission,
        status: commission > 0 ? 'eligible_for_claim' : 'pending',
      };

      // ALL WRITES AFTER READS
      // 1. Write referral event
      transaction.set(referralRef, {
        ...referralData,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 2. Update affiliate stats
      transaction.update(affiliateDoc.ref, {
        referralCount: FieldValue.increment(1),
        totalEarnings: FieldValue.increment(commission),
      });

      // 3. Update global referral counter
      transaction.set(
        settingsRef,
        {
          globalReferralCount: FieldValue.increment(1),
          totalCustomers: FieldValue.increment(1),
        },
        { merge: true }
      );

      // 4. Check for 100,000th customer milestone reward
      if (newGlobalCount === MILESTONE_CUSTOMER) {
        const milestoneRef = adminDb.collection('milestones').doc(`milestone_${MILESTONE_CUSTOMER}`);
        transaction.set(milestoneRef, {
          affiliateUid,
          orderId: order.id,
          reward: MILESTONE_REWARD,
          type: '100000th_customer',
          status: 'pending_review',
          createdAt: FieldValue.serverTimestamp(),
        });

        transaction.update(affiliateDoc.ref, {
          milestoneReward: MILESTONE_REWARD,
          milestoneAchieved: true,
          totalEarnings: FieldValue.increment(MILESTONE_REWARD),
        });
      }
    });
  } catch (err) {
    console.error('Referral processing transaction failed:', err);
  }
}
