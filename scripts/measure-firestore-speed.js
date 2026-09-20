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

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

async function measure() {
  console.log('--- Measuring Firestore Query Times ---');

  // Cold query
  const t0 = Date.now();
  const snap1 = await db.collection('products')
    .where('section', '==', 'society_fuckers')
    .where('isPublished', '==', true)
    .get();
  const t1 = Date.now();
  console.log(`Society Fuckers (Cold): ${t1 - t0} ms, found ${snap1.size} docs`);

  // Warm query 1
  const t2 = Date.now();
  const snap2 = await db.collection('products')
    .where('section', '==', 'valueless_bitches')
    .where('isPublished', '==', true)
    .get();
  const t3 = Date.now();
  console.log(`Valueless Bitches (Warm 1): ${t3 - t2} ms, found ${snap2.size} docs`);

  // Warm query 2
  const t4 = Date.now();
  const snap3 = await db.collection('products')
    .where('section', '==', 'society_fuckers')
    .where('isPublished', '==', true)
    .get();
  const t5 = Date.now();
  console.log(`Society Fuckers (Warm 2): ${t5 - t4} ms, found ${snap3.size} docs`);

  process.exit(0);
}

measure().catch(err => {
  console.error(err);
  process.exit(1);
});
