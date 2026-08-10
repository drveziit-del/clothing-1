const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

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

async function testRun() {
  const orderId = "fRMEZoAHfrHI7EFrBPIW";
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) {
    console.log("Order not found!");
    process.exit(1);
  }

  const orderData = doc.data();
  const order = {
    id: doc.id,
    ...orderData,
    status: 'paid',
    createdAt: orderData.createdAt?.toDate?.() ?? new Date(),
  };

  const MIN_ORDER_FOR_REFERRAL = 100;
  const COMMISSION_PER_10_REFERRALS = 100;
  const MILESTONE_CUSTOMER = 100000;
  const MILESTONE_REWARD = 100000;

  const orderValue = order.subtotal || order.total || 0;
  if (orderValue < MIN_ORDER_FOR_REFERRAL || !order.referralCode) return;

  const affiliateSnap = await db
    .collection('users')
    .where('referralCode', '==', order.referralCode)
    .limit(1)
    .get();

  if (affiliateSnap.empty) return;

  const affiliateDoc = affiliateSnap.docs[0];
  const affiliateUid = affiliateDoc.id;

  try {
    await db.runTransaction(async (transaction) => {
      const referralRef = db.collection('referrals').doc(`referral_${order.id}`);
      const settingsRef = db.collection('settings').doc('global');

      // 1. ALL READS FIRST
      const refDoc = await transaction.get(referralRef);
      if (refDoc.exists) {
        console.log("Transaction: referral document already exists!");
        return;
      }

      const freshAffiliateDoc = await transaction.get(affiliateDoc.ref);
      const globalSettingsDoc = await transaction.get(settingsRef);

      // Calculations
      const currentCount = freshAffiliateDoc.data()?.referralCount ?? 0;
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

      // 2. ALL WRITES AFTER READS
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

    console.log("SUCCESSFULLY PROCESSED REFERRAL!");
  } catch (err) {
    console.error("TRANSACTION ERROR:", err);
  }

  process.exit(0);
}

testRun().catch(err => {
  console.error("OUTER ERROR:", err);
  process.exit(1);
});
