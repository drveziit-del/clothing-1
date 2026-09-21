const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load environment variables manually from .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
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
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

const adminDb = admin.firestore();

// Test product IDs identified in forensic audit:
const TEST_PRODUCT_IDS = [
  'UxBBwLkgRcaV7i39nOfH', // tset2
  'VPDRlneQyh1ltw73jxzW', // test3
  'iDsnMJDCnByoW37okays', // test4
  'zr1fO8bdsRfDacad5xyI', // test
  'YQwTbbG6ery53s4a2G4F', // bhjb
  'jhTgAHkkSCAHD7vDJY3f', // god's plan ($10M joke product)
];

async function archiveTestProducts() {
  console.log('====================================================');
  console.log('  AUTHORITATIVE CATALOG CLEANUP — ARCHIVE TEST PRODS ');
  console.log('====================================================\n');

  for (const prodId of TEST_PRODUCT_IDS) {
    const docRef = adminDb.collection('products').doc(prodId);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`⚠️ Product ${prodId} not found in Firestore.`);
      continue;
    }
    const data = doc.data();
    console.log(`Archiving product: [${prodId}] Title: "${data.title}", Slug: "${data.slug}", Was isPublished: ${data.isPublished}`);
    await docRef.update({
      isPublished: false,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      archivedReason: 'Forensic cleanup of test products before production launch',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ Successfully set isPublished: false for [${prodId}]\n`);
  }

  // Check gods-plan
  const godsPlanDoc = await adminDb.collection('products').doc('jhTgAHkkSCAHD7vDJY3f').get();
  if (godsPlanDoc.exists) {
    const gData = godsPlanDoc.data();
    console.log('--- Checking "gods-plan" ---');
    console.log(`ID: jhTgAHkkSCAHD7vDJY3f, Title: "${gData.title}", Price: $${gData.price}, Variants: ${gData.variants?.length || 0}`);
    console.log('Description:', gData.description);
    console.log('Category:', gData.category);
    console.log('isPublished:', gData.isPublished);
  }

  console.log('\n====================================================');
  console.log('  CURRENT PUBLISHED PRODUCTS IN PRODUCTION:          ');
  console.log('====================================================');
  const pubSnapshot = await adminDb.collection('products').where('isPublished', '==', true).get();
  console.log(`Total Published Products: ${pubSnapshot.docs.length}`);
  pubSnapshot.docs.forEach((doc) => {
    const d = doc.data();
    console.log(`- [${doc.id}] "${d.title}" (${d.slug}) — Category: ${d.category}, Price: $${d.price}, Variants: ${d.variants?.length || 0}`);
  });
}

archiveTestProducts().catch(console.error);
