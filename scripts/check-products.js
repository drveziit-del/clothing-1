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

async function check() {
  const snap = await db.collection('products').get();
  console.log(`\n=== PRODUCTS IN FIRESTORE (${snap.size}) ===`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: "${doc.id}" | Title: "${data.title}" | Slug: "${data.slug}"`);
  });
  console.log('====================================\n');
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
