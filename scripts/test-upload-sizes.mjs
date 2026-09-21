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
      timeout: 30000,
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
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'TIMEOUT' });
    });
    req.write(bodyBuffer);
    req.end();
  });
}

// Create a valid JPEG buffer of given size
function createJpegBuffer(targetSizeBytes) {
  // JPEG header: FF D8 FF E0 00 10 4A 46 49 46 00 01 01 00 00 01 00 01 00 00
  const header = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
  ]);
  const filler = Buffer.alloc(Math.max(0, targetSizeBytes - header.length - 2), 0xaa);
  const eoi = Buffer.from([0xff, 0xd9]); // EOI
  return Buffer.concat([header, filler, eoi]);
}

async function runTests() {
  const testEmail = 'custom-design-tester@gerkink.shop';
  const testUser = await auth.getUserByEmail(testEmail);
  const customToken = await auth.createCustomToken(testUser.uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const idTokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const idTokenData = await idTokenRes.json();
  const sessionCookie = await auth.createSessionCookie(idTokenData.idToken, { expiresIn: 24 * 60 * 60 * 1000 });

  const testSizes = [
    { name: '50KB JPEG', size: 50 * 1024 },
    { name: '500KB JPEG', size: 500 * 1024 },
    { name: '2MB JPEG', size: 2 * 1024 * 1024 },
    { name: '5MB JPEG', size: 5 * 1024 * 1024 },
    { name: '10MB JPEG', size: 10 * 1024 * 1024 },
    { name: '15MB JPEG', size: 15 * 1024 * 1024 },
    { name: '20MB JPEG', size: 20 * 1024 * 1024 },
  ];

  for (const t of testSizes) {
    console.log(`\nTesting upload of ${t.name} (${t.size} bytes)...`);
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const fileBuf = createJpegBuffer(t.size);
    const body = buildMultipartBody(boundary, 'file', `artwork-${t.size}.jpg`, 'image/jpeg', fileBuf);

    const start = Date.now();
    const res = await sendUpload('https://gerkink.shop/api/custom-design/upload', sessionCookie, body, boundary);
    const duration = Date.now() - start;

    console.log(`Result for ${t.name}: Status=${res.status} in ${duration}ms`);
    if (res.status !== 200) {
      console.log('Error Body:', res.body);
      console.log('Headers:', res.headers);
      break; // Stop at first failed size!
    } else {
      console.log('Success! Body snippet:', res.body.slice(0, 100));
    }
  }
}

runTests().catch(console.error);
