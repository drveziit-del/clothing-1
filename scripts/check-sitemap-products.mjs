import { adminDb } from '../src/lib/firebase/admin.js';

async function checkProducts() {
  const snapshot = await adminDb.collection('products').get();
  console.log(`Total products in Firestore: ${snapshot.size}`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  Title: ${data.title}`);
    console.log(`  Slug: ${data.slug}`);
    console.log(`  Section: ${data.section}`);
    console.log(`  isPublished: ${data.isPublished}`);
    console.log(`  Images: ${Array.isArray(data.images) ? data.images.length : 0}`);
  }
}

checkProducts().catch(console.error);
