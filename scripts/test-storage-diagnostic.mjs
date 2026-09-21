import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';


const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('Project ID:', projectId);
console.log('Client Email:', clientEmail);
console.log('Private Key exists:', !!privateKey);

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

const storage = getStorage(app);

async function testBuckets() {
  const bucketsToTest = [
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    `${projectId}.appspot.com`,
    `${projectId}.firebasestorage.app`,
  ].filter(Boolean);

  const uniqueBuckets = [...new Set(bucketsToTest)];

  for (const bName of uniqueBuckets) {
    console.log(`\nTesting bucket: "${bName}"...`);
    try {
      const bucket = storage.bucket(bName);
      const [exists] = await bucket.exists();
      console.log(`Bucket exists: ${exists}`);

      if (exists) {
        const testFile = bucket.file(`diagnostic-test-${Date.now()}.txt`);
        await testFile.save('diagnostic test content', {
          metadata: { contentType: 'text/plain' },
        });
        console.log(`Successfully wrote test file: ${testFile.name}`);

        const [content] = await testFile.download();
        console.log(`Successfully downloaded test file content: "${content.toString()}"`);

        await testFile.delete();
        console.log(`Successfully deleted test file`);
      }
    } catch (err) {
      console.error(`Error with bucket "${bName}":`, err.message);
      if (err.errors) console.error('Details:', err.errors);
    }
  }
}

testBuckets().catch(console.error);
