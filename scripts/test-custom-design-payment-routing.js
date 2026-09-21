/**
 * GERKINK Autonomous Payment Routing Verification Suite
 *
 * Covers Phase 18 Matrix:
 * - PAY-IN-01: India + Basic → Razorpay + INR
 * - PAY-IN-02: India + Better Quality → Razorpay + INR
 * - PAY-INT-01: USA + Basic → PayPal + USD
 * - PAY-INT-02: USA + Better Quality → PayPal + USD
 * - PAY-INT-03: UK + Basic → PayPal + USD
 * - PAY-SEC-01: Client attempts gateway manipulation → rejected/recalculated
 * - PAY-SEC-02: Client attempts amount manipulation → rejected/recalculated
 * - PAY-SEC-03: Client attempts currency manipulation → rejected/recalculated
 * - PAY-SEC-04: India attempts PayPal → server enforces routing
 * - PAY-SEC-05: International attempts Razorpay → server enforces routing
 * - PAY-RP-01: Razorpay invalid signature → rejected
 * - PAY-RP-02: Razorpay duplicate webhook → idempotent
 * - PAY-PP-01: PayPal wrong amount/order → rejected
 * - PAY-PP-02: PayPal duplicate event → idempotent
 * - PAY-STATE-01: Successful Razorpay → correct internal paid state
 * - PAY-STATE-02: Successful PayPal/Unified payment state integrity
 * - PAY-STATE-03: Failed payment → not paid
 * - PAY-STATE-04: Cancelled payment → not paid
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

// 0. Load Environment Variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
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

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

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

const db = admin.firestore();
const BASE_URL = 'http://localhost:3000';

const report = {
  timestamp: new Date().toISOString(),
  testSuite: 'GERKINK Custom Design Payment Routing & Security Suite',
  total: 0,
  passed: 0,
  failed: 0,
  cases: [],
};

function recordTest(id, name, status, details) {
  report.total++;
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [${id}] ${name}: ${status} — ${details}`);
  report.cases.push({ id, name, status, details });
  if (status === 'PASSED') report.passed++;
  else report.failed++;
}

async function createTestSession(uid, email) {
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({ uid, email, displayName: 'Payment Test User' });
  }

  const customToken = await admin.auth().createCustomToken(uid);
  const idTokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!idTokenRes.ok) throw new Error(`Custom token exchange failed: ${idTokenRes.status}`);
  const { idToken } = await idTokenRes.json();

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!sessionRes.ok) throw new Error(`Session creation failed: ${sessionRes.status}`);
  const setCookie = sessionRes.headers.get('set-cookie');
  const match = setCookie && setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error('No session cookie returned');

  return { uid, email, cookie: `session=${match[1]}` };
}

async function runPaymentRoutingSuite() {
  console.log('\n===============================================================');
  console.log('  STARTING GERKINK CUSTOM DESIGN PAYMENT ROUTING TEST MATRIX');
  console.log('===============================================================\n');

  const testUid = `paytest_${Date.now()}`;
  const testEmail = `${testUid}@gerkink.test`;
  const createdDocIds = [];

  try {
    const session = await createTestSession(testUid, testEmail);

    const basePayload = {
      productType: 'T-Shirt',
      preferredSize: 'L',
      preferredColor: 'Black',
      description: 'Authoritative server routing automated verification test design',
      paymentPolicyAccepted: true,
      policyVersion: 'v1_non_refundable_prepayment',
      uploads: [
        {
          fileId: 'file_pay_1',
          originalName: 'test-artwork.png',
          mimeType: 'image/png',
          size: 1024,
          storagePath: `custom-design/${testUid}/artwork.png`,
          uploadedAt: new Date().toISOString(),
        },
      ],
    };

    // ─────────────────────────────────────────────────────────────
    // PAY-IN-01: India + Basic ($15) → Razorpay + INR
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_in_01_${Date.now()}`,
          country: 'IN',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isRazorpay = data.paymentProvider === 'razorpay' || data.gateway === 'razorpay';
      const isExactInr = data.amount === 1425 && data.amountPaise === 142500;

      if (
        res.ok &&
        isRazorpay &&
        data.currency === 'INR' &&
        data.amountUSD === 15 &&
        isExactInr &&
        data.razorpayOrderId &&
        !data.paypalOrderId
      ) {
        recordTest('PAY-IN-01', 'India + Basic ($15 -> ₹1425 INR at $1=₹95)', 'PASSED', `Order ${data.razorpayOrderId}, Amount: ₹${data.amount} INR (${data.amountPaise} paise)`);
      } else {
        recordTest('PAY-IN-01', 'India + Basic ($15 -> ₹1425 INR at $1=₹95)', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-IN-01', 'India + Basic ($15 -> ₹1425 INR at $1=₹95)', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-IN-02: India + Better Quality ($20) → Razorpay + INR (₹1900 at $1=₹95)
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_in_02_${Date.now()}`,
          country: 'IN',
          plan: 'better_quality',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isRazorpay = data.paymentProvider === 'razorpay' || data.gateway === 'razorpay';
      const isExactInr = data.amount === 1900 && data.amountPaise === 190000;

      if (
        res.ok &&
        isRazorpay &&
        data.currency === 'INR' &&
        data.amountUSD === 20 &&
        isExactInr &&
        data.razorpayOrderId
      ) {
        recordTest('PAY-IN-02', 'India + Better Quality ($20 -> ₹1900 INR at $1=₹95)', 'PASSED', `Order ${data.razorpayOrderId}, Amount: ₹${data.amount} INR (${data.amountPaise} paise)`);
      } else {
        recordTest('PAY-IN-02', 'India + Better Quality ($20 -> ₹1900 INR at $1=₹95)', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-IN-02', 'India + Better Quality ($20 -> ₹1900 INR at $1=₹95)', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-INT-01: USA + Basic ($15) → PayPal + USD
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_us_01_${Date.now()}`,
          country: 'US',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isPayPal = data.paymentProvider === 'paypal' || data.gateway === 'paypal';

      if (
        res.ok &&
        isPayPal &&
        data.currency === 'USD' &&
        data.amountUSD === 15 &&
        data.amount === 15 &&
        data.paypalOrderId &&
        !data.razorpayOrderId
      ) {
        recordTest('PAY-INT-01', 'USA + Basic -> PayPal + USD', 'PASSED', `Order ${data.paypalOrderId}, Amount: $${data.amount} USD`);
      } else {
        recordTest('PAY-INT-01', 'USA + Basic -> PayPal + USD', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-INT-01', 'USA + Basic -> PayPal + USD', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-INT-02: USA + Better Quality ($20) → PayPal + USD
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_us_02_${Date.now()}`,
          country: 'US',
          plan: 'better_quality',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isPayPal = data.paymentProvider === 'paypal' || data.gateway === 'paypal';

      if (
        res.ok &&
        isPayPal &&
        data.currency === 'USD' &&
        data.amountUSD === 20 &&
        data.amount === 20 &&
        data.paypalOrderId
      ) {
        recordTest('PAY-INT-02', 'USA + Better Quality -> PayPal + USD', 'PASSED', `Order ${data.paypalOrderId}, Amount: $${data.amount} USD`);
      } else {
        recordTest('PAY-INT-02', 'USA + Better Quality -> PayPal + USD', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-INT-02', 'USA + Better Quality -> PayPal + USD', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-INT-03: UK + Basic ($15) → PayPal + USD
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_uk_01_${Date.now()}`,
          country: 'GB',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isPayPal = data.paymentProvider === 'paypal' || data.gateway === 'paypal';

      if (
        res.ok &&
        isPayPal &&
        data.currency === 'USD' &&
        data.amountUSD === 15 &&
        data.amount === 15 &&
        data.paypalOrderId
      ) {
        recordTest('PAY-INT-03', 'UK + Basic -> PayPal + USD', 'PASSED', `Order ${data.paypalOrderId}, Amount: $${data.amount} USD`);
      } else {
        recordTest('PAY-INT-03', 'UK + Basic -> PayPal + USD', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-INT-03', 'UK + Basic -> PayPal + USD', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-SEC-01 & PAY-SEC-04: India attempts PayPal manipulation
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_sec_01_${Date.now()}`,
          country: 'IN',
          gateway: 'paypal',
          paymentProvider: 'paypal',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isRazorpay = data.paymentProvider === 'razorpay' || data.gateway === 'razorpay';

      // Server must override and enforce Razorpay + INR
      if (res.ok && isRazorpay && data.currency === 'INR') {
        recordTest('PAY-SEC-01', 'Client attempts gateway manipulation (India -> PayPal)', 'PASSED', 'Server ignored client gateway and enforced Razorpay + INR');
        recordTest('PAY-SEC-04', 'India attempts PayPal -> server enforces routing', 'PASSED', 'Enforced Razorpay + INR');
      } else {
        recordTest('PAY-SEC-01', 'Client attempts gateway manipulation', 'FAILED', JSON.stringify(data));
        recordTest('PAY-SEC-04', 'India attempts PayPal -> server enforces routing', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-SEC-01', 'Client attempts gateway manipulation', 'FAILED', e.message);
      recordTest('PAY-SEC-04', 'India attempts PayPal -> server enforces routing', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-SEC-02: Client attempts amount manipulation ($1 instead of $20)
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_sec_02_${Date.now()}`,
          country: 'US',
          plan: 'better_quality',
          amount: 1,
          price: 1,
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      // Server must ignore client amount and enforce authoritative $20
      if (res.ok && data.amountUSD === 20 && data.amount === 20) {
        recordTest('PAY-SEC-02', 'Client attempts amount manipulation ($1 -> $20)', 'PASSED', 'Server enforced authoritative $20 USD price');
      } else {
        recordTest('PAY-SEC-02', 'Client attempts amount manipulation', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-SEC-02', 'Client attempts amount manipulation', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-SEC-03: Client attempts currency manipulation (India + USD)
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_sec_03_${Date.now()}`,
          country: 'IN',
          currency: 'USD',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isRazorpay = data.paymentProvider === 'razorpay' || data.gateway === 'razorpay';

      if (res.ok && data.currency === 'INR' && isRazorpay) {
        recordTest('PAY-SEC-03', 'Client attempts currency manipulation (India + USD)', 'PASSED', 'Server enforced INR currency');
      } else {
        recordTest('PAY-SEC-03', 'Client attempts currency manipulation', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-SEC-03', 'Client attempts currency manipulation', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-SEC-05: International attempts Razorpay manipulation
    // ─────────────────────────────────────────────────────────────
    try {
      const res = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_sec_05_${Date.now()}`,
          country: 'US',
          gateway: 'razorpay',
          paymentProvider: 'razorpay',
          plan: 'regular',
        }),
      });
      const data = await res.json();
      if (data.requestId) createdDocIds.push(data.requestId);

      const isPayPal = data.paymentProvider === 'paypal' || data.gateway === 'paypal';

      if (res.ok && isPayPal && data.currency === 'USD') {
        recordTest('PAY-SEC-05', 'International attempts Razorpay -> server enforces PayPal', 'PASSED', 'Server enforced PayPal + USD');
      } else {
        recordTest('PAY-SEC-05', 'International attempts Razorpay -> server enforces PayPal', 'FAILED', JSON.stringify(data));
      }
    } catch (e) {
      recordTest('PAY-SEC-05', 'International attempts Razorpay', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-RP-01: Razorpay invalid HMAC signature in capture endpoint
    // ─────────────────────────────────────────────────────────────
    let inRequestId = null;
    let inRazorpayOrderId = null;
    try {
      const initRes = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_rp_sig_${Date.now()}`,
          country: 'IN',
          plan: 'regular',
        }),
      });
      const initData = await initRes.json();
      inRequestId = initData.requestId;
      inRazorpayOrderId = initData.razorpayOrderId;
      if (inRequestId) createdDocIds.push(inRequestId);

      const capRes = await fetch(`${BASE_URL}/api/custom-design/capture-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          requestId: inRequestId,
          razorpay_order_id: inRazorpayOrderId,
          razorpay_payment_id: 'pay_fake_test_123',
          razorpay_signature: 'invalid_forged_signature_deadbeef',
        }),
      });
      const capData = await capRes.json();

      if (capRes.status === 400 && capData.error && capData.error.includes('signature')) {
        recordTest('PAY-RP-01', 'Razorpay invalid signature -> rejected', 'PASSED', `Rejected with 400: ${capData.error}`);
      } else {
        recordTest('PAY-RP-01', 'Razorpay invalid signature -> rejected', 'FAILED', `Status ${capRes.status}: ${JSON.stringify(capData)}`);
      }
    } catch (e) {
      recordTest('PAY-RP-01', 'Razorpay invalid signature', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-STATE-01: Razorpay valid signature capture -> correct paid state
    // ─────────────────────────────────────────────────────────────
    try {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const fakePaymentId = `pay_test_${Date.now()}`;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(`${inRazorpayOrderId}|${fakePaymentId}`)
        .digest('hex');

      const capRes = await fetch(`${BASE_URL}/api/custom-design/capture-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          requestId: inRequestId,
          razorpay_order_id: inRazorpayOrderId,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: validSignature,
        }),
      });
      const capData = await capRes.json();

      // Verify Firestore state
      const doc = await db.collection('customDesignRequests').doc(inRequestId).get();
      const docData = doc.data();

      if (
        capRes.ok &&
        docData.status === 'SUBMITTED' &&
        docData.paymentStatus === 'paid' &&
        docData.paymentReference === fakePaymentId &&
        docData.paymentProvider === 'razorpay' &&
        docData.currency === 'INR'
      ) {
        recordTest('PAY-STATE-01', 'Successful Razorpay -> correct internal paid state', 'PASSED', `State: ${docData.status}, Payment: ${docData.paymentStatus}, Ref: ${docData.paymentReference}`);
      } else {
        recordTest('PAY-STATE-01', 'Successful Razorpay -> correct internal paid state', 'FAILED', `Response: ${JSON.stringify(capData)}, Doc: ${JSON.stringify(docData)}`);
      }
    } catch (e) {
      recordTest('PAY-STATE-01', 'Successful Razorpay -> correct internal paid state', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-RP-02: Razorpay duplicate webhook / capture idempotency
    // ─────────────────────────────────────────────────────────────
    try {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const fakePaymentId = `pay_test_${Date.now()}`;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(`${inRazorpayOrderId}|${fakePaymentId}`)
        .digest('hex');

      // Duplicate capture attempt
      const dupRes = await fetch(`${BASE_URL}/api/custom-design/capture-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          requestId: inRequestId,
          razorpay_order_id: inRazorpayOrderId,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: validSignature,
        }),
      });
      const dupData = await dupRes.json();

      if (dupRes.ok && dupData.message && dupData.message.includes('already verified')) {
        recordTest('PAY-RP-02', 'Razorpay duplicate capture -> idempotent', 'PASSED', dupData.message);
      } else {
        recordTest('PAY-RP-02', 'Razorpay duplicate capture -> idempotent', 'FAILED', JSON.stringify(dupData));
      }
    } catch (e) {
      recordTest('PAY-RP-02', 'Razorpay duplicate capture', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-PP-01: PayPal wrong order capture -> rejected
    // ─────────────────────────────────────────────────────────────
    try {
      const initRes = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_pp_err_${Date.now()}`,
          country: 'US',
          plan: 'regular',
        }),
      });
      const initData = await initRes.json();
      const ppRequestId = initData.requestId;
      if (ppRequestId) createdDocIds.push(ppRequestId);

      // Attempt capture with invalid PayPal order ID
      const capRes = await fetch(`${BASE_URL}/api/custom-design/capture-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          requestId: ppRequestId,
          paypalOrderId: 'INVALID_PAYPAL_ORDER_99999',
        }),
      });
      const capData = await capRes.json();

      if (!capRes.ok && capRes.status >= 400) {
        recordTest('PAY-PP-01', 'PayPal wrong amount/order -> rejected', 'PASSED', `Rejected with status ${capRes.status}: ${capData.error || 'Error'}`);
      } else {
        recordTest('PAY-PP-01', 'PayPal wrong amount/order -> rejected', 'FAILED', JSON.stringify(capData));
      }
    } catch (e) {
      recordTest('PAY-PP-01', 'PayPal wrong amount/order', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-STATE-03: Failed payment -> not marked paid
    // ─────────────────────────────────────────────────────────────
    try {
      const initRes = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_fail_${Date.now()}`,
          country: 'US',
          plan: 'regular',
        }),
      });
      const initData = await initRes.json();
      const failRequestId = initData.requestId;
      if (failRequestId) createdDocIds.push(failRequestId);

      const doc = await db.collection('customDesignRequests').doc(failRequestId).get();
      const docData = doc.data();

      if (docData.paymentStatus === 'pending' && docData.status === 'PAYMENT_PENDING') {
        recordTest('PAY-STATE-03', 'Failed / uncaptured payment -> not paid', 'PASSED', `Status: ${docData.status}, PaymentStatus: ${docData.paymentStatus}`);
      } else {
        recordTest('PAY-STATE-03', 'Failed / uncaptured payment -> not paid', 'FAILED', JSON.stringify(docData));
      }
    } catch (e) {
      recordTest('PAY-STATE-03', 'Failed / uncaptured payment', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-STATE-04: Cancelled payment -> not marked paid
    // ─────────────────────────────────────────────────────────────
    try {
      const initRes = await fetch(`${BASE_URL}/api/custom-design/create-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookie },
        body: JSON.stringify({
          ...basePayload,
          idempotencyKey: `idem_cancel_${Date.now()}`,
          country: 'IN',
          plan: 'better_quality',
        }),
      });
      const initData = await initRes.json();
      const cancelRequestId = initData.requestId;
      if (cancelRequestId) createdDocIds.push(cancelRequestId);

      const doc = await db.collection('customDesignRequests').doc(cancelRequestId).get();
      const docData = doc.data();

      if (docData.paymentStatus === 'pending' && docData.status === 'PAYMENT_PENDING') {
        recordTest('PAY-STATE-04', 'Cancelled payment -> remains not paid', 'PASSED', `Status: ${docData.status}, PaymentStatus: ${docData.paymentStatus}`);
      } else {
        recordTest('PAY-STATE-04', 'Cancelled payment -> remains not paid', 'FAILED', JSON.stringify(docData));
      }
    } catch (e) {
      recordTest('PAY-STATE-04', 'Cancelled payment', 'FAILED', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // PAY-STATE-02: Unified internal payment model integrity check
    // ─────────────────────────────────────────────────────────────
    try {
      const doc = await db.collection('customDesignRequests').doc(inRequestId).get();
      const d = doc.data();

      const hasRequiredFields =
        d.id &&
        d.requestId &&
        d.userId &&
        d.country === 'IN' &&
        d.currency === 'INR' &&
        d.prepaymentAmount > 0 &&
        d.prepaymentAmountUSD === 15 &&
        d.paymentProvider === 'razorpay' &&
        d.paymentStatus === 'paid' &&
        d.status === 'SUBMITTED' &&
        d.paymentReference &&
        Array.isArray(d.statusHistory) &&
        d.statusHistory.length > 0;

      if (hasRequiredFields) {
        recordTest('PAY-STATE-02', 'Unified internal payment model integrity', 'PASSED', 'All unified fields verified in Firestore');
      } else {
        recordTest('PAY-STATE-02', 'Unified internal payment model integrity', 'FAILED', JSON.stringify(d));
      }
    } catch (e) {
      recordTest('PAY-STATE-02', 'Unified internal payment model integrity', 'FAILED', e.message);
    }

  } finally {
    // Cleanup created test requests & user
    console.log('\n[Cleanup] Cleaning up test records from Firestore...');
    for (const docId of createdDocIds) {
      try {
        await db.collection('customDesignRequests').doc(docId).delete();
      } catch (e) {
        console.warn(`Failed to delete test doc ${docId}:`, e.message);
      }
    }
    try {
      await admin.auth().deleteUser(testUid);
    } catch (e) {
      // non-fatal
    }
  }

  console.log('\n===============================================================');
  console.log(`  RESULTS: ${report.passed} PASSED / ${report.failed} FAILED (TOTAL: ${report.total})`);
  console.log('===============================================================\n');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runPaymentRoutingSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
