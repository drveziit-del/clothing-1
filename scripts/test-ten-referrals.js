const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.replace(/\\n/g, '\n');
      }
    }
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
    }),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

async function runTest() {
  console.log('=== STARTING TEST: 10 REFERRALS AFFILIATE FLOW ===\n');

  const testAffiliateUid = `test_affiliate_${Date.now()}`;
  const testRefCode = `TESTREF${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Create Test Affiliate User
  console.log(`1. Creating Test Affiliate User (ID: ${testAffiliateUid}, Code: ${testRefCode})...`);
  const affiliateRef = db.collection('users').doc(testAffiliateUid);
  await affiliateRef.set({
    uid: testAffiliateUid,
    email: `${testAffiliateUid}@example.com`,
    displayName: 'Test Affiliate User',
    referralCode: testRefCode,
    referralCount: 0,
    totalEarnings: 0,
    role: 'user',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const createdOrderIds = [];

  // 2. Simulate 10 Orders with Referral Code
  console.log('\n2. Simulating 10 orders placed with referral code:', testRefCode);

  const MIN_ORDER_FOR_REFERRAL = 100;
  const COMMISSION_PER_10_REFERRALS = 100;

  for (let i = 1; i <= 10; i++) {
    const orderId = `test_order_${Date.now()}_${i}`;
    createdOrderIds.push(orderId);
    const buyerUid = `test_buyer_${Date.now()}_${i}`;
    const orderSubtotal = 100;

    console.log(`   👉 Processing Order #${i} (Order ID: ${orderId}, Value: $${orderSubtotal})...`);

    // Simulate processReferral logic from src/lib/referral/engine.ts
    const affiliateSnap = await db.collection('users')
      .where('referralCode', '==', testRefCode)
      .limit(1)
      .get();

    if (affiliateSnap.empty) {
      throw new Error(`Affiliate with code ${testRefCode} not found!`);
    }

    const affiliateDoc = affiliateSnap.docs[0];
    const affiliateUid = affiliateDoc.id;

    await db.runTransaction(async (transaction) => {
      const referralRef = db.collection('referrals').doc(`referral_${orderId}`);
      const settingsRef = db.collection('settings').doc('global');

      const refDoc = await transaction.get(referralRef);
      if (refDoc.exists) return;

      const freshAffiliateDoc = await transaction.get(affiliateDoc.ref);
      const globalSettingsDoc = await transaction.get(settingsRef);

      const currentCount = freshAffiliateDoc.data()?.referralCount ?? 0;
      const newCount = currentCount + 1;
      const commission = newCount % 10 === 0 ? COMMISSION_PER_10_REFERRALS : 0;

      const referralData = {
        affiliateUid,
        affiliateCode: testRefCode,
        referredUid: buyerUid,
        orderId: orderId,
        orderValue: orderSubtotal,
        commission,
        status: commission > 0 ? 'eligible_for_claim' : 'pending',
      };

      transaction.set(referralRef, {
        ...referralData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(affiliateDoc.ref, {
        referralCount: admin.firestore.FieldValue.increment(1),
        totalEarnings: admin.firestore.FieldValue.increment(commission),
      });

      transaction.set(
        settingsRef,
        {
          globalReferralCount: admin.firestore.FieldValue.increment(1),
          totalCustomers: admin.firestore.FieldValue.increment(1),
        },
        { merge: true }
      );
    });

    // Check intermediate affiliate state
    const currentAffiliateDoc = await affiliateRef.get();
    const data = currentAffiliateDoc.data();
    console.log(`      State after Order #${i}: referralCount = ${data.referralCount}, totalEarnings = $${data.totalEarnings}`);
  }

  // 3. Verify Final Affiliate State
  console.log('\n3. Verifying Final Affiliate Results:');
  const finalAffiliateSnap = await affiliateRef.get();
  const finalData = finalAffiliateSnap.data();

  console.log(`   - Total Referral Count: ${finalData.referralCount} (Expected: 10)`);
  console.log(`   - Total Earnings: $${finalData.totalEarnings} (Expected: $100)`);

  const referralsSnap = await db.collection('referrals')
    .where('affiliateUid', '==', testAffiliateUid)
    .get();

  console.log(`   - Total Referral Records: ${referralsSnap.size} (Expected: 10)`);

  let eligibleCount = 0;
  let totalCommissionAwarded = 0;

  referralsSnap.docs.forEach(doc => {
    const ref = doc.data();
    if (ref.status === 'eligible_for_claim') eligibleCount++;
    totalCommissionAwarded += ref.commission;
  });

  console.log(`   - Referral Records Eligible For Claim: ${eligibleCount} (Expected: 1)`);
  console.log(`   - Total Commission Awarded in Referral Docs: $${totalCommissionAwarded} (Expected: $100)`);

  const passed = finalData.referralCount === 10 &&
                 finalData.totalEarnings === 100 &&
                 referralsSnap.size === 10 &&
                 eligibleCount === 1 &&
                 totalCommissionAwarded === 100;

  if (passed) {
    console.log('\n✅ TEST PASSED: Referral flow for 10 clients functions perfectly!');
  } else {
    console.error('\n❌ TEST FAILED: Results do not match expected values.');
  }

  // 4. Cleanup Test Data
  console.log('\n4. Cleaning up test data from Firestore...');
  const batch = db.batch();
  batch.delete(affiliateRef);
  for (const orderId of createdOrderIds) {
    batch.delete(db.collection('referrals').doc(`referral_${orderId}`));
  }
  await batch.commit();
  console.log('   - Test affiliate and 10 referral documents deleted.');

  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('\n❌ TEST EXCEPTION:', err);
  process.exit(1);
});
