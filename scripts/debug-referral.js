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

async function debug() {
  // Get the most recent order with referral code
  const ordersSnap = await db.collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  console.log('\n=== DETAILED ORDER INSPECTION ===\n');
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    console.log(`Order ID: ${doc.id}`);
    console.log(`  status: ${data.status}`);
    console.log(`  userId: ${data.userId}`);
    console.log(`  userEmail: ${data.userEmail}`);
    console.log(`  referralCode: ${JSON.stringify(data.referralCode)}`);
    console.log(`  subtotal: ${JSON.stringify(data.subtotal)} (type: ${typeof data.subtotal})`);
    console.log(`  tax: ${JSON.stringify(data.tax)}`);
    console.log(`  discount: ${JSON.stringify(data.discount)}`);
    console.log(`  total: ${JSON.stringify(data.total)} (type: ${typeof data.total})`);
    console.log(`  couponCode: ${JSON.stringify(data.couponCode)}`);
    console.log(`  items count: ${data.items?.length}`);
    if (data.items?.length > 0) {
      console.log(`  item[0].price: ${data.items[0].price}`);
      console.log(`  item[0].quantity: ${data.items[0].quantity}`);
    }
    console.log(`  printifyOrderId: ${data.printifyOrderId}`);
    console.log(`  createdAt: ${data.createdAt?.toDate?.()}`);
    console.log('');
  }

  // Check settings doc for globalReferralCount
  const settingsDoc = await db.collection('settings').doc('global').get();
  if (settingsDoc.exists) {
    const s = settingsDoc.data();
    console.log(`=== GLOBAL SETTINGS ===`);
    console.log(`  globalReferralCount: ${s.globalReferralCount}`);
    console.log(`  totalCustomers: ${s.totalCustomers}`);
  } else {
    console.log('!!! settings/global document DOES NOT EXIST !!!');
    console.log('This would cause processReferral to CRASH in the transaction!');
  }

  process.exit(0);
}

debug().catch(err => {
  console.error(err);
  process.exit(1);
});
