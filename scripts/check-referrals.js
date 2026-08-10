const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load environment variables manually
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

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    }),
    projectId
  });
}

const db = admin.firestore();

async function check() {
  // 1. Get recent orders
  const ordersSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(5).get();
  console.log(`\n=== RECENT ORDERS (${ordersSnap.size}) ===`);
  ordersSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: "${doc.id}" | Status: "${data.status}" | Total: $${data.total} | RefCode: "${data.referralCode}" | PrintifyID: "${data.printifyOrderId}" | Items count: ${data.items?.length}`);
  });

  // 2. Get referrals
  const referralsSnap = await db.collection('referrals').orderBy('createdAt', 'desc').limit(5).get();
  console.log(`\n=== RECENT REFERRALS (${referralsSnap.size}) ===`);
  referralsSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: "${doc.id}" | AffiliateCode: "${data.affiliateCode}" | OrderValue: $${data.orderValue} | Commission: $${data.commission} | Status: "${data.status}"`);
  });

  // 3. Get users
  const usersSnap = await db.collection('users').get();
  console.log(`\n=== ALL USERS (${usersSnap.size}) ===`);
  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`UID: "${doc.id}" | Email: "${data.email}" | Name: "${data.displayName}" | Code: "${data.referralCode}" | RefCount: ${data.referralCount}`);
  });

  console.log('====================================\n');
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
