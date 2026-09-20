const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();

async function fixReviewMedia() {
  console.log('Updating review cqfEoUJPnAHjtsR161Xc with complete valid video URL...');
  const ref = db.collection('reviews').doc('cqfEoUJPnAHjtsR161Xc');
  const doc = await ref.get();
  if (doc.exists) {
    const data = doc.data();
    const media = data.media || [];
    if (media.length > 0) {
      media[0].url = '/api/reviews/media?path=reviews%2F1787988519328-64ae003e.mp4';
      await ref.update({ media });
      console.log('Successfully updated review cqfEoUJPnAHjtsR161Xc with complete valid video URL!');
    }
  }
}

fixReviewMedia().catch(console.error);
