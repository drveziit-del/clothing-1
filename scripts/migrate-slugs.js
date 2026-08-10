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
        // Remove surrounding quotes if any
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.replace(/\\n/g, '\n'); // Handle multi-line private keys
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

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/&/g, '-and-')         // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
};

async function migrate() {
  const snap = await db.collection('products').get();
  console.log(`Found ${snap.size} products. Populating slugs...`);

  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.slug) {
      let slug = slugify(data.title || 'product');
      // Ensure uniqueness
      let uniqueSlug = slug;
      let suffix = 1;
      let isUnique = false;

      while (!isUnique) {
        const dupSnap = await db.collection('products')
          .where('slug', '==', uniqueSlug)
          .limit(1)
          .get();

        if (dupSnap.empty) {
          isUnique = true;
        } else {
          if (dupSnap.docs[0].id === doc.id) {
            isUnique = true;
          } else {
            uniqueSlug = `${slug}-${suffix}`;
            suffix++;
          }
        }
      }

      await doc.ref.update({
        slug: uniqueSlug,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Updated product "${data.title}" -> slug: "${uniqueSlug}"`);
      count++;
    } else {
      console.log(`Product "${data.title}" already has slug: "${data.slug}"`);
    }
  }

  console.log(`Migration finished. Populated slugs for ${count} products.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
