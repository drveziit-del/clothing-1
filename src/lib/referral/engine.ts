import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order, Referral } from '@/types';

const MIN_ORDER_FOR_REFERRAL = 100; // USD
const COMMISSION_PER_10_REFERRALS = 100; // USD
const MILESTONE_CUSTOMER = 100000;
const MILESTONE_REWARD = 100000; // USD

export async function processReferral(order: Order): Promise<void> {
  // 1. Validate order value
  if (order.total < MIN_ORDER_FOR_REFERRAL) return;
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

  // 3. Block self-referral
  if (affiliateUid === order.userId) return;

  // 4. Idempotency check — prevent duplicate referral creation for the same order
  const existingRefSnap = await adminDb
    .collection('referrals')
    .where('orderId', '==', order.id)
    .limit(1)
    .get();

  if (!existingRefSnap.empty) return;

  // 5. Determine commission
  const currentCount: number = affiliateDoc.data().referralCount ?? 0;
  const newCount = currentCount + 1;
  const commission = newCount % 10 === 0 ? COMMISSION_PER_10_REFERRALS : 0;

  // 6. Write referral event
  const referralData: Omit<Referral, 'id'> = {
    affiliateUid,
    affiliateCode: order.referralCode,
    referredUid: order.userId,
    orderId: order.id,
    orderValue: order.total,
    commission,
    status: commission > 0 ? 'eligible_for_claim' : 'pending',
    createdAt: new Date(),
  };

  const batch = adminDb.batch();

  // Write referral
  const referralRef = adminDb.collection('referrals').doc();
  batch.set(referralRef, {
    ...referralData,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update affiliate stats (totalEarnings increment is deferred until manual claim)
  batch.update(affiliateDoc.ref, {
    referralCount: FieldValue.increment(1),
  });


  // 7. Update global referral counter
  const settingsRef = adminDb.collection('settings').doc('global');
  batch.update(settingsRef, {
    globalReferralCount: FieldValue.increment(1),
    totalCustomers: FieldValue.increment(1),
  });

  await batch.commit();

  // 8. Check for 10,000th customer milestone
  const settingsSnap = await settingsRef.get();
  const globalCount: number = settingsSnap.data()?.globalReferralCount ?? 0;

  if (globalCount === MILESTONE_CUSTOMER) {
    await triggerMilestoneReward(affiliateUid, order.id);
  }
}

async function triggerMilestoneReward(
  affiliateUid: string,
  orderId: string
): Promise<void> {
  await adminDb.collection('milestones').add({
    affiliateUid,
    orderId,
    reward: MILESTONE_REWARD,
    type: '100000th_customer',
    status: 'pending_review',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update affiliate with mega-reward flag
  await adminDb.collection('users').doc(affiliateUid).update({
    milestoneReward: MILESTONE_REWARD,
    milestoneAchieved: true,
    totalEarnings: FieldValue.increment(MILESTONE_REWARD),
  });
}
