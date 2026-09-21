import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import https from 'https';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const auth = getAuth(app);

// Simple 1x1 valid PNG image buffer (68 bytes)
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND
  0x42, 0x60, 0x82
]);

function buildMultipartBody(boundary, fieldName, filename, contentType, fileBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

function sendUpload(url, sessionCookie, bodyBuffer, boundary) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Cookie': `session=${sessionCookie}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', err => resolve({ status: 0, error: err.message }));
    req.write(bodyBuffer);
    req.end();
  });
}

async function test() {
  console.log('--- Creating test customer session ---');
  let testUser;
  const testEmail = 'custom-design-tester@gerkink.shop';
  try {
    testUser = await auth.getUserByEmail(testEmail);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      testUser = await auth.createUser({
        email: testEmail,
        password: 'TestPassword123!@#',
        displayName: 'Custom Design Tester',
      });
    } else {
      throw err;
    }
  }

  console.log('Test User UID:', testUser.uid);

  // Mint a custom token and exchange for session cookie
  // Since createSessionCookie requires an ID token, we can get an ID token via Firebase Auth REST API using API Key:
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const customToken = await auth.createCustomToken(testUser.uid);

  // Exchange custom token for ID token
  const idTokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const idTokenData = await idTokenRes.json();
  if (!idTokenData.idToken) {
    throw new Error(`Failed to get ID token: ${JSON.stringify(idTokenData)}`);
  }

  // Create session cookie (5 days)
  const sessionCookie = await auth.createSessionCookie(idTokenData.idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
  console.log('Successfully minted session cookie for test user!');

  // Now test LIVE upload
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const body = buildMultipartBody(boundary, 'file', 'test-design.png', 'image/png', validPngBuffer);

  console.log('\n--- Sending upload to https://gerkink.shop/api/custom-design/upload ---');
  const uploadRes = await sendUpload('https://gerkink.shop/api/custom-design/upload', sessionCookie, body, boundary);
  console.log('Status:', uploadRes.status);
  console.log('Headers:', uploadRes.headers);
  console.log('Body:', uploadRes.body);

  // If upload succeeded, test media endpoint
  try {
    const json = JSON.parse(uploadRes.body);
    if (json.storagePath) {
      console.log('\n--- Testing media retrieval from https://gerkink.shop/api/custom-design/media ---');
      const mediaUrl = `https://gerkink.shop/api/custom-design/media?path=${encodeURIComponent(json.storagePath)}`;
      const mediaRes = await new Promise((resolve) => {
        const parsed = new URL(mediaUrl);
        https.get({
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: { 'Cookie': `session=${sessionCookie}` },
        }, (res) => {
          let d = [];
          res.on('data', c => d.push(c));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              length: Buffer.concat(d).length,
            });
          });
        }).on('error', err => resolve({ status: 0, error: err.message }));
      });
      console.log('Media status:', mediaRes.status);
      console.log('Media headers:', mediaRes.headers);
      console.log('Media body length:', mediaRes.length);
    }
  } catch (_) {}
}

test().catch(console.error);
