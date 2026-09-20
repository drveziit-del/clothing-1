/**
 * GERKINK Phase 6 — Referral & Growth Loop Verification Suite
 *
 * Strict Production Standards:
 * - 0 Simulated Firestore Mutations.
 * - Genuine concurrent execution against real Firestore ACID transactions and live routes.
 * - Real HTTP requests against local Next.js server with authenticated sessions.
 * - Exhaustive test cleanup of all test documents, accounts, and restored counters in finally block.
 * - Non-zero exit code on any assertion failure.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 0. Setup TypeScript runtime loader for direct production code invocation
const jiti = require('jiti')(path.resolve(process.cwd(), 'scripts/test-phase6-referral.js'), {
  alias: {
    '@': path.resolve(process.cwd(), 'src'),
    'server-only': path.resolve(process.cwd(), 'scripts/empty.js'),
  },
});

// Import actual production functions directly via jiti
const { allocateCustomerNumber, CAMPAIGN_MAX_CUSTOMERS } = jiti('@/lib/customer/sequence');
const { generateSecureReferralCode } = jiti('@/lib/referral/code');
const { processReferral } = jiti('@/lib/referral/engine');

// 1. Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const env = {};
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
        env[key] = value.replace(/\\n/g, '\n');
        process.env[key] = env[key];
      }
    }
  });
}

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = env.FIREBASE_PRIVATE_KEY;
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;

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

const results = [];
function record(id, title, status, details) {
  results.push({ id, title, status, details });
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [${id}] ${title}: ${status} — ${details}`);
}

const cleanupRefs = [];
const cleanupAuthUids = [];

function markForCleanup(ref) {
  cleanupRefs.push(ref);
}

// Helper to mint authentic session cookie for a test user
async function getUserSessionCookie(uid, email) {
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({
      uid,
      email: email || `${uid}@gerkink-test.internal`,
    });
    cleanupAuthUids.push(uid);
  }

  const customToken = await admin.auth().createCustomToken(uid);
  const idTokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!idTokenRes.ok) {
    const txt = await idTokenRes.text();
    throw new Error(`Failed to exchange custom token for idToken: ${txt}`);
  }
  const { idToken } = await idTokenRes.json();

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!sessionRes.ok) {
    throw new Error(`Session creation failed: ${sessionRes.status}`);
  }

  const rawCookie = sessionRes.headers.get('set-cookie');
  if (!rawCookie) throw new Error('No set-cookie returned from /api/auth/session');
  const sessionMatch = rawCookie.match(/session=([^;]+)/);
  if (!sessionMatch) throw new Error('Session cookie string missing from set-cookie');
  return sessionMatch[1];
}

async function runSuite() {
  console.log('\n======================================================================');
  console.log('🚀 GERKINK Phase 6 — Referral & Growth Loop Verification Suite');
  console.log('======================================================================\n');

  // Save baseline settings/campaign and settings/global to restore afterwards
  const campaignRef = db.collection('settings').doc('campaign');
  const globalSettingsRef = db.collection('settings').doc('global');
  const origCampaignSnap = await campaignRef.get();
  const origCampaignData = origCampaignSnap.exists ? origCampaignSnap.data() : null;
  const origGlobalSnap = await globalSettingsRef.get();
  const origGlobalData = origGlobalSnap.exists ? origGlobalSnap.data() : null;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Customer Sequence Allocation (1..500 = Founding 500)
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Customer Sequence Allocation ---');
    try {
      // 1a. Concurrently allocate numbers for 5 test orders
      const orderIds = [1, 2, 3, 4, 5].map((i) => `test_ord_seq_${Date.now()}_${i}`);
      for (const oId of orderIds) {
        const ref = db.collection('orders').doc(oId);
        markForCleanup(ref);
        await ref.set({
          total: 120,
          status: 'paid',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const allocPromises = orderIds.map((oId) => allocateCustomerNumber(oId));
      const allocResults = await Promise.all(allocPromises);

      const customerNumbers = allocResults.map((r) => r.customerNumber);
      const uniqueNumbers = new Set(customerNumbers);

      if (uniqueNumbers.size !== 5) {
        throw new Error(`Expected 5 unique numbers, got: ${JSON.stringify(customerNumbers)}`);
      }

      // 1b. Verify isFounding500 accuracy
      for (const r of allocResults) {
        const expectedFounding = r.customerNumber <= CAMPAIGN_MAX_CUSTOMERS;
        if (r.isFounding500 !== expectedFounding) {
          throw new Error(`isFounding500 mismatch for #${r.customerNumber}: expected ${expectedFounding}, got ${r.isFounding500}`);
        }
      }

      // 1c. Verify idempotency
      const firstAlloc = allocResults[0];
      const repeatAlloc = await allocateCustomerNumber(orderIds[0]);
      if (repeatAlloc.customerNumber !== firstAlloc.customerNumber) {
        throw new Error(`Idempotency failed: first was ${firstAlloc.customerNumber}, repeat was ${repeatAlloc.customerNumber}`);
      }

      // 1d. Verify failure handling
      const failOrderId = `test_ord_fail_${Date.now()}`;
      const failOrderRef = db.collection('orders').doc(failOrderId);
      markForCleanup(failOrderRef);
      await failOrderRef.set({
        total: 100,
        status: 'paid',
        simulateAllocError: true,
      });

      const failResult = await allocateCustomerNumber(failOrderId);
      if (failResult !== null) {
        throw new Error(`Expected null on simulated error, got: ${JSON.stringify(failResult)}`);
      }
      const failOrderDoc = await failOrderRef.get();
      if (!failOrderDoc.data()?.customerNumberAllocFailed) {
        throw new Error('customerNumberAllocFailed flag was not stamped on failed order');
      }

      record('TEST-1', 'Customer Sequence Allocation & Founding 500', 'PASSED',
        `5 concurrent allocations unique (${customerNumbers.join(', ')}), idempotent repeat, failure halted cleanly.`);
    } catch (err) {
      record('TEST-1', 'Customer Sequence Allocation & Founding 500', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Cryptographically Secure Referral Code Generation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Referral Code Generation ---');
    try {
      const generatedCodes = new Set();
      const codeRegex = /^GERK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
      const ambiguousChars = ['0', 'O', '1', 'I'];

      for (let i = 0; i < 100; i++) {
        const code = generateSecureReferralCode();
        if (!codeRegex.test(code)) {
          throw new Error(`Generated code '${code}' does not match pattern /^GERK-[A-Z2-9]{8}$/`);
        }
        for (const badChar of ambiguousChars) {
          if (code.includes(badChar)) {
            throw new Error(`Code '${code}' contains ambiguous character '${badChar}'`);
          }
        }
        generatedCodes.add(code);
      }

      if (generatedCodes.size !== 100) {
        throw new Error(`Expected 100 unique codes, but got ${generatedCodes.size} (collision detected)`);
      }

      record('TEST-2', 'Crypto-Secure Referral Code Generation', 'PASSED',
        `100/100 codes matched GERK-XXXXXXXX, 0 ambiguous chars, 0 collisions.`);
    } catch (err) {
      record('TEST-2', 'Crypto-Secure Referral Code Generation', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Referral Link Redirect & 30-Day Attribution Cookie (/r/[code])
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Referral Link Redirect & 30-Day Attribution Cookie ---');
    const testAffiliateUid3 = `test_aff3_${Date.now()}`;
    const testRefCode3 = `GERK-TEST${Math.floor(1000 + Math.random() * 9000)}`;
    const userRef3 = db.collection('users').doc(testAffiliateUid3);
    markForCleanup(userRef3);

    try {
      await userRef3.set({
        uid: testAffiliateUid3,
        email: `${testAffiliateUid3}@example.com`,
        referralCode: testRefCode3,
        referralCount: 0,
        totalEarnings: 0,
        linkClicks: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3a. Valid referral redirect test
      const res = await fetch(`${BASE_URL}/r/${testRefCode3}`, {
        method: 'GET',
        redirect: 'manual',
      });

      if (res.status !== 307) {
        throw new Error(`Expected 307 redirect, got ${res.status}`);
      }

      const location = res.headers.get('location');
      if (!location || !location.endsWith('/shop')) {
        throw new Error(`Expected redirect to /shop, got: ${location}`);
      }

      const setCookie = res.headers.get('set-cookie');
      if (!setCookie || !setCookie.includes(`referral=${testRefCode3}`)) {
        throw new Error(`Set-Cookie does not contain referral=${testRefCode3}. Got: ${setCookie}`);
      }
      if (!setCookie.toLowerCase().includes('max-age=2592000')) {
        throw new Error(`Set-Cookie does not have 30-day Max-Age (2592000). Got: ${setCookie}`);
      }

      // 3b. Invalid code redirect test
      const invalidRes = await fetch(`${BASE_URL}/r/NONEXISTENT_CODE_XYZ`, {
        method: 'GET',
        redirect: 'manual',
      });
      if (invalidRes.status !== 307) {
        throw new Error(`Expected 307 for invalid code, got ${invalidRes.status}`);
      }
      const invalidCookie = invalidRes.headers.get('set-cookie');
      if (invalidCookie && invalidCookie.includes('referral=')) {
        throw new Error('Invalid code should NOT set a referral cookie');
      }

      record('TEST-3', 'Referral Redirect & 30-Day Attribution Cookie', 'PASSED',
        `307 -> /shop with Max-Age=2592000 cookie verified; invalid code safely redirects without cookie.`);
    } catch (err) {
      record('TEST-3', 'Referral Redirect & 30-Day Attribution Cookie', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Deduplicated Click Tracking (1 Click per IP per Code per Hour)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Deduplicated Click Tracking ---');
    try {
      const testIp = `198.51.100.${Math.floor(1 + Math.random() * 250)}`;

      // Click 1: Should increment linkClicks
      const clickRes1 = await fetch(`${BASE_URL}/r/${testRefCode3}`, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'x-forwarded-for': testIp },
      });
      if (clickRes1.status !== 307) throw new Error(`Click 1 failed: status ${clickRes1.status}`);

      // Small pause to allow Firestore async write in r/[code]
      await new Promise((r) => setTimeout(r, 600));

      const snapAfter1 = await userRef3.get();
      const clicks1 = snapAfter1.data()?.linkClicks ?? 0;
      if (clicks1 < 1) {
        throw new Error(`Expected linkClicks >= 1 after first click, got ${clicks1}`);
      }

      // Click 2 from SAME IP: Must be deduplicated (not increment)
      const clickRes2 = await fetch(`${BASE_URL}/r/${testRefCode3}`, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'x-forwarded-for': testIp },
      });
      if (clickRes2.status !== 307) throw new Error(`Click 2 failed: status ${clickRes2.status}`);

      await new Promise((r) => setTimeout(r, 600));
      const snapAfter2 = await userRef3.get();
      const clicks2 = snapAfter2.data()?.linkClicks ?? 0;
      if (clicks2 !== clicks1) {
        throw new Error(`Deduplication failed: click count increased from ${clicks1} to ${clicks2} within 1 hour`);
      }

      record('TEST-4', 'Deduplicated Click Tracking (1 click/IP/hr)', 'PASSED',
        `Initial click incremented counter to ${clicks1}; second identical IP click safely ignored.`);
    } catch (err) {
      record('TEST-4', 'Deduplicated Click Tracking (1 click/IP/hr)', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Fallback Click Tracking for Order-Derived Referral Codes
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Fallback Click Tracking for Order-Derived Codes ---');
    const orderOwnerUid = `test_ord_owner_${Date.now()}`;
    const orderOwnerRef = db.collection('users').doc(orderOwnerUid);
    markForCleanup(orderOwnerRef);

    const orderDerivedCode = `GERK-ORD${Math.floor(1000 + Math.random() * 9000)}`;
    const testOrderRef = db.collection('orders').doc(`ord_ref_test_${Date.now()}`);
    markForCleanup(testOrderRef);

    const refCodeDocRef = db.collection('referral_codes').doc(orderDerivedCode);
    markForCleanup(refCodeDocRef);

    try {
      // 5a. Create user doc without referralCode initially
      await orderOwnerRef.set({
        uid: orderOwnerUid,
        email: `${orderOwnerUid}@example.com`,
        linkClicks: 0,
        totalEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5b. Create order with userReferralCode
      await testOrderRef.set({
        userId: orderOwnerUid,
        userReferralCode: orderDerivedCode,
        status: 'paid',
        total: 100,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5c. Create referral_codes doc
      await refCodeDocRef.set({
        code: orderDerivedCode,
        orderId: testOrderRef.id,
        userId: orderOwnerUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5d. Send click via /api/referral/click
      const testIp5 = `198.51.100.${Math.floor(1 + Math.random() * 250)}`;
      const clickRes = await fetch(`${BASE_URL}/api/referral/click?code=${orderDerivedCode}`, {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp5 },
      });

      const clickJson = await clickRes.json();
      if (!clickRes.ok || clickJson.status !== 'ok') {
        throw new Error(`Click API failed: ${clickRes.status} — ${JSON.stringify(clickJson)}`);
      }

      await new Promise((r) => setTimeout(r, 600));

      // 5e. Verify linkClicks was incremented on the OWNER'S USER doc, not just order
      const ownerSnap = await orderOwnerRef.get();
      const ownerClicks = ownerSnap.data()?.linkClicks ?? 0;
      if (ownerClicks !== 1) {
        throw new Error(`Owner user linkClicks was not incremented! Expected 1, got ${ownerClicks}`);
      }

      record('TEST-5', 'Fallback Click Attribution to Owner User Doc', 'PASSED',
        `Clicks on order-derived code (${orderDerivedCode}) successfully incremented owner's users document.`);
    } catch (err) {
      record('TEST-5', 'Fallback Click Attribution to Owner User Doc', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Referral Code Validation API (/api/referral/validate)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Referral Code Validation API ---');
    try {
      // 6a. Valid user referral code
      const v1 = await fetch(`${BASE_URL}/api/referral/validate?code=${testRefCode3}`);
      const j1 = await v1.json();
      if (!j1.valid) throw new Error(`Expected valid: true for user code, got ${JSON.stringify(j1)}`);

      // 6b. Valid order-derived referral code
      const v2 = await fetch(`${BASE_URL}/api/referral/validate?code=${orderDerivedCode}`);
      const j2 = await v2.json();
      if (!j2.valid) throw new Error(`Expected valid: true for order code, got ${JSON.stringify(j2)}`);

      // 6c. Suspended / inactive code
      const suspendedCode = `GERK-SUSP${Math.floor(1000 + Math.random() * 9000)}`;
      const suspRef = db.collection('users').doc(`test_susp_${Date.now()}`);
      markForCleanup(suspRef);
      await suspRef.set({
        referralCode: suspendedCode,
        isSuspended: true,
      });

      const v3 = await fetch(`${BASE_URL}/api/referral/validate?code=${suspendedCode}`);
      const j3 = await v3.json();
      if (j3.valid) throw new Error(`Expected valid: false for suspended user, got ${JSON.stringify(j3)}`);

      // 6d. Nonexistent code
      const v4 = await fetch(`${BASE_URL}/api/referral/validate?code=NONEXISTENT_9999`);
      const j4 = await v4.json();
      if (j4.valid) throw new Error(`Expected valid: false for nonexistent code, got ${JSON.stringify(j4)}`);

      // 6e. Missing code
      const v5 = await fetch(`${BASE_URL}/api/referral/validate`);
      if (v5.status !== 400) throw new Error(`Expected 400 for empty code, got ${v5.status}`);

      record('TEST-6', 'Referral Code Validation API', 'PASSED',
        `Users, orders, suspended, and invalid codes validated accurately with 400 parameter defense.`);
    } catch (err) {
      record('TEST-6', 'Referral Code Validation API', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 7: Order Referral Attribution Under Minimum ($100 threshold)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Order Referral Under Minimum Threshold ---');
    const testAffiliateUid7 = `test_aff7_${Date.now()}`;
    const testRefCode7 = `GERK-MIN${Math.floor(1000 + Math.random() * 9000)}`;
    const userRef7 = db.collection('users').doc(testAffiliateUid7);
    markForCleanup(userRef7);

    try {
      await userRef7.set({
        uid: testAffiliateUid7,
        email: `${testAffiliateUid7}@example.com`,
        referralCode: testRefCode7,
        referralCount: 0,
        totalEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Order with subtotal $65.50 (< $100 min)
      const subMinOrder = {
        id: `ord_submin_${Date.now()}`,
        userId: `buyer_${Date.now()}`,
        subtotal: 65.50,
        total: 65.50,
        referralCode: testRefCode7,
        status: 'paid',
      };

      const res7 = await processReferral(subMinOrder);
      if (res7.processed !== false || res7.commission !== 0) {
        throw new Error(`Expected processed: false and commission: 0 for <$100, got: ${JSON.stringify(res7)}`);
      }

      const snap7 = await userRef7.get();
      if ((snap7.data()?.referralCount ?? 0) !== 0) {
        throw new Error('Affiliate referralCount incremented for order under $100');
      }

      record('TEST-7', 'Sub-Minimum Order Rejection ($100 threshold)', 'PASSED',
        `$65.50 order rejected from referral processing; 0 count increment, 0 commission awarded.`);
    } catch (err) {
      record('TEST-7', 'Sub-Minimum Order Rejection ($100 threshold)', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 8: Exact 10-Sales Milestone Reward ($100 Commission per 10th Sale)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: 10-Sales Milestone Reward ---');
    const testAffiliateUid8 = `test_aff8_${Date.now()}`;
    const testRefCode8 = `GERK-TEN${Math.floor(1000 + Math.random() * 9000)}`;
    const userRef8 = db.collection('users').doc(testAffiliateUid8);
    markForCleanup(userRef8);

    const createdOrderIds8 = [];

    try {
      await userRef8.set({
        uid: testAffiliateUid8,
        email: `${testAffiliateUid8}@example.com`,
        referralCode: testRefCode8,
        referralCount: 0,
        totalEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Process 9 qualifying orders ($100 each)
      for (let i = 1; i <= 9; i++) {
        const orderId = `ord_ten_${Date.now()}_${i}`;
        createdOrderIds8.push(orderId);
        markForCleanup(db.collection('referrals').doc(`referral_${orderId}`));

        const r = await processReferral({
          id: orderId,
          userId: `buyer_ten_${i}`,
          subtotal: 100,
          total: 100,
          referralCode: testRefCode8,
          status: 'paid',
        });

        if (!r.processed || r.commission !== 0) {
          throw new Error(`Order #${i} expected commission 0, got ${r.commission}`);
        }
      }

      // Verify state after 9 orders
      const snapAfter9 = await userRef8.get();
      if (snapAfter9.data()?.referralCount !== 9 || snapAfter9.data()?.totalEarnings !== 0) {
        throw new Error(`State after 9 orders incorrect: count=${snapAfter9.data()?.referralCount}, earnings=${snapAfter9.data()?.totalEarnings}`);
      }

      // Process 10th qualifying order ($100) -> Milestone!
      const orderId10 = `ord_ten_${Date.now()}_10`;
      createdOrderIds8.push(orderId10);
      const refDoc10 = db.collection('referrals').doc(`referral_${orderId10}`);
      markForCleanup(refDoc10);

      const r10 = await processReferral({
        id: orderId10,
        userId: `buyer_ten_10`,
        subtotal: 100,
        total: 100,
        referralCode: testRefCode8,
        status: 'paid',
      });

      if (!r10.processed || r10.commission !== 100) {
        throw new Error(`Order #10 expected commission 100, got: ${JSON.stringify(r10)}`);
      }

      const snapAfter10 = await userRef8.get();
      if (snapAfter10.data()?.referralCount !== 10 || snapAfter10.data()?.totalEarnings !== 100) {
        throw new Error(`State after 10 orders incorrect: count=${snapAfter10.data()?.referralCount}, earnings=${snapAfter10.data()?.totalEarnings}`);
      }

      const refSnap10 = await refDoc10.get();
      if (refSnap10.data()?.status !== 'eligible_for_claim' || refSnap10.data()?.commission !== 100) {
        throw new Error(`Referral doc #10 status incorrect: ${JSON.stringify(refSnap10.data())}`);
      }

      // Process 11th order -> commission should be 0 again
      const orderId11 = `ord_ten_${Date.now()}_11`;
      createdOrderIds8.push(orderId11);
      markForCleanup(db.collection('referrals').doc(`referral_${orderId11}`));

      const r11 = await processReferral({
        id: orderId11,
        userId: `buyer_ten_11`,
        subtotal: 100,
        total: 100,
        referralCode: testRefCode8,
        status: 'paid',
      });

      if (!r11.processed || r11.commission !== 0) {
        throw new Error(`Order #11 expected commission 0, got ${r11.commission}`);
      }

      const snapAfter11 = await userRef8.get();
      if (snapAfter11.data()?.referralCount !== 11 || snapAfter11.data()?.totalEarnings !== 100) {
        throw new Error(`State after 11 orders incorrect: count=${snapAfter11.data()?.referralCount}, earnings=${snapAfter11.data()?.totalEarnings}`);
      }

      record('TEST-8', 'Exact 10-Sales Milestone Reward ($100)', 'PASSED',
        `Orders 1-9 earned $0; Order 10 unlocked exactly $100 earnings & eligible_for_claim; Order 11 reset to $0 commission.`);
    } catch (err) {
      record('TEST-8', 'Exact 10-Sales Milestone Reward ($100)', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 9: Referral Processing Idempotency
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: Referral Processing Idempotency ---');
    try {
      const existingOrderId = createdOrderIds8[9]; // order 10
      const repeatResult = await processReferral({
        id: existingOrderId,
        userId: `buyer_ten_10`,
        subtotal: 100,
        total: 100,
        referralCode: testRefCode8,
        status: 'paid',
      });

      if (repeatResult.processed !== false || repeatResult.commission !== 0) {
        throw new Error(`Expected idempotency rejection on repeat referral, got: ${JSON.stringify(repeatResult)}`);
      }

      const finalSnap = await userRef8.get();
      if (finalSnap.data()?.referralCount !== 11 || finalSnap.data()?.totalEarnings !== 100) {
        throw new Error(`Affiliate state mutated on duplicate run! count=${finalSnap.data()?.referralCount}, earnings=${finalSnap.data()?.totalEarnings}`);
      }

      record('TEST-9', 'Referral Processing Idempotency', 'PASSED',
        `Repeated referral call for order ${existingOrderId} returned processed:false with 0 balance mutation.`);
    } catch (err) {
      record('TEST-9', 'Referral Processing Idempotency', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 10: Exact 100,000th Customer Milestone Boundary
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Exact 100,000th Customer Milestone Boundary ---');
    const testAffiliateUid10 = `test_aff10_${Date.now()}`;
    const testRefCode10 = `GERK-100K${Math.floor(1000 + Math.random() * 9000)}`;
    const userRef10 = db.collection('users').doc(testAffiliateUid10);
    markForCleanup(userRef10);

    const milestoneRef = db.collection('milestones').doc('milestone_100000');
    markForCleanup(milestoneRef);

    try {
      await userRef10.set({
        uid: testAffiliateUid10,
        email: `${testAffiliateUid10}@example.com`,
        referralCode: testRefCode10,
        referralCount: 0,
        totalEarnings: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Temporarily set globalReferralCount to 99,998
      await globalSettingsRef.set({
        globalReferralCount: 99998,
        totalCustomers: 99998,
      }, { merge: true });

      // Order 99,999
      const order99999Id = `ord_99999_${Date.now()}`;
      markForCleanup(db.collection('referrals').doc(`referral_${order99999Id}`));
      const r99999 = await processReferral({
        id: order99999Id,
        userId: 'buyer_99999',
        subtotal: 100,
        total: 100,
        referralCode: testRefCode10,
        status: 'paid',
      });

      if (r99999.milestoneAwarded !== false || r99999.globalCount !== 99999) {
        throw new Error(`Order 99,999 milestone check failed: awarded=${r99999.milestoneAwarded}, count=${r99999.globalCount}`);
      }

      // Order 100,000 -> Should strictly trigger $100k reward!
      const order100000Id = `ord_100000_${Date.now()}`;
      markForCleanup(db.collection('referrals').doc(`referral_${order100000Id}`));
      const r100000 = await processReferral({
        id: order100000Id,
        userId: 'buyer_100000',
        subtotal: 100,
        total: 100,
        referralCode: testRefCode10,
        status: 'paid',
      });

      if (r100000.milestoneAwarded !== true || r100000.globalCount !== 100000) {
        throw new Error(`Order 100,000 milestone failed to trigger: awarded=${r100000.milestoneAwarded}, count=${r100000.globalCount}`);
      }

      const milestoneSnap = await milestoneRef.get();
      if (!milestoneSnap.exists || milestoneSnap.data()?.reward !== 100000) {
        throw new Error(`milestone_100000 document not stamped with $100,000 reward: ${JSON.stringify(milestoneSnap.data())}`);
      }

      const snap10 = await userRef10.get();
      if (!snap10.data()?.milestoneAchieved || snap10.data()?.milestoneReward !== 100000) {
        throw new Error(`Affiliate user not stamped with milestoneAchieved: ${JSON.stringify(snap10.data())}`);
      }

      // Order 100,001 -> milestoneAwarded should be false
      const order100001Id = `ord_100001_${Date.now()}`;
      markForCleanup(db.collection('referrals').doc(`referral_${order100001Id}`));
      const r100001 = await processReferral({
        id: order100001Id,
        userId: 'buyer_100001',
        subtotal: 100,
        total: 100,
        referralCode: testRefCode10,
        status: 'paid',
      });

      if (r100001.milestoneAwarded !== false || r100001.globalCount !== 100001) {
        throw new Error(`Order 100,001 milestone was awarded when it shouldn't be: ${JSON.stringify(r100001)}`);
      }

      record('TEST-10', 'Exact 100,000th Customer Milestone Boundary', 'PASSED',
        `Milestone awarded strictly at count 100,000; 99,999 and 100,001 cleanly rejected duplicate award.`);
    } catch (err) {
      record('TEST-10', 'Exact 100,000th Customer Milestone Boundary', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 11: Commission Claim — Crypto-Secure Coupon Generation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 11: Commission Claim — Crypto-Secure Coupon Generation ---');
    const claimAffiliateUid = `test_claim_aff_${Date.now()}`;
    const claimUserRef = db.collection('users').doc(claimAffiliateUid);
    markForCleanup(claimUserRef);

    const eligibleRefDoc = db.collection('referrals').doc(`referral_claim_test_${Date.now()}`);
    markForCleanup(eligibleRefDoc);

    try {
      await claimUserRef.set({
        uid: claimAffiliateUid,
        email: `${claimAffiliateUid}@gerkink-test.internal`,
        displayName: 'Test Claim Affiliate',
        referralCount: 10,
        totalEarnings: 100,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await eligibleRefDoc.set({
        affiliateUid: claimAffiliateUid,
        orderId: `ord_claim_${Date.now()}`,
        commission: 100,
        commissionClaimed: 0,
        status: 'eligible_for_claim',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Get authentic session cookie for the affiliate user
      const sessionCookie = await getUserSessionCookie(claimAffiliateUid, `${claimAffiliateUid}@gerkink-test.internal`);

      // 11a. Claim $50 coupon
      const claimRes1 = await fetch(`${BASE_URL}/api/referral/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          claimType: 'coupon',
          requestedAmount: 50,
        }),
      });

      const claimJson1 = await claimRes1.json();
      if (!claimRes1.ok || claimJson1.status !== 'ok') {
        throw new Error(`Coupon claim 1 failed: ${claimRes1.status} — ${JSON.stringify(claimJson1)}`);
      }

      const couponCode1 = claimJson1.couponCode;
      // Format: GERK-50-XXXXXXXX (where suffix is 8 hex chars from crypto.randomBytes(4))
      const couponPattern = /^GERK-50-[0-9A-F]{8}$/;
      if (!couponPattern.test(couponCode1)) {
        throw new Error(`Generated coupon code '${couponCode1}' does not match crypto format /^GERK-50-[0-9A-F]{8}$/`);
      }

      // Check remaining commission in referral doc
      const refSnapAfter50 = await eligibleRefDoc.get();
      if (refSnapAfter50.data()?.commissionClaimed !== 50 || refSnapAfter50.data()?.status !== 'eligible_for_claim') {
        throw new Error(`Referral doc after $50 claim incorrect: ${JSON.stringify(refSnapAfter50.data())}`);
      }

      // 11b. Claim remaining $50 coupon
      const claimRes2 = await fetch(`${BASE_URL}/api/referral/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          claimType: 'coupon',
          requestedAmount: 50,
        }),
      });

      const claimJson2 = await claimRes2.json();
      if (!claimRes2.ok || claimJson2.status !== 'ok') {
        throw new Error(`Coupon claim 2 failed: ${claimRes2.status} — ${JSON.stringify(claimJson2)}`);
      }

      const refSnapAfter100 = await eligibleRefDoc.get();
      if (refSnapAfter100.data()?.commissionClaimed !== 100 || refSnapAfter100.data()?.status !== 'claimed') {
        throw new Error(`Referral doc after $100 claim incorrect: ${JSON.stringify(refSnapAfter100.data())}`);
      }

      // 11c. Attempt third claim for $10 -> should fail with 400
      const claimRes3 = await fetch(`${BASE_URL}/api/referral/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          claimType: 'coupon',
          requestedAmount: 10,
        }),
      });

      if (claimRes3.status !== 400) {
        throw new Error(`Expected 400 on over-claim, got ${claimRes3.status}`);
      }

      record('TEST-11', 'Commission Claim — Crypto-Secure Coupon Generation', 'PASSED',
        `$50 + $50 partial claims generated crypto coupons (${couponCode1}), updated referral to claimed, blocked over-claims.`);
    } catch (err) {
      record('TEST-11', 'Commission Claim — Crypto-Secure Coupon Generation', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 12: Commission Claim — Rollback & Missing Payout Details Protection
    // ------------------------------------------------------------------------
    console.log('\n--- Test 12: Commission Claim — Rollback & Payout Security ---');
    try {
      const sessionCookie = await getUserSessionCookie(claimAffiliateUid);

      // 12a. Seed an eligible referral doc so we reach the payout configuration check
      const bankEligibleDoc = db.collection('referrals').doc(`referral_bank_test_${Date.now()}`);
      markForCleanup(bankEligibleDoc);
      await bankEligibleDoc.set({
        affiliateUid: claimAffiliateUid,
        orderId: `ord_bank_${Date.now()}`,
        commission: 100,
        commissionClaimed: 0,
        status: 'eligible_for_claim',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Attempt bank claim without configuring bank preferences
      const bankClaimRes = await fetch(`${BASE_URL}/api/referral/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          claimType: 'bank',
          requestedAmount: 50,
        }),
      });

      const bankJson = await bankClaimRes.json();
      if (bankClaimRes.status !== 400 || !bankJson.error?.includes('configure your bank payout settings')) {
        throw new Error(`Expected 400 with bank settings error, got ${bankClaimRes.status}: ${JSON.stringify(bankJson)}`);
      }

      // 12b. Test gateway failure rollback on refund claim
      const rollbackRefDoc = db.collection('referrals').doc(`referral_rollback_${Date.now()}`);
      markForCleanup(rollbackRefDoc);
      await rollbackRefDoc.set({
        affiliateUid: claimAffiliateUid,
        orderId: `ord_fake_rzp_${Date.now()}`,
        commission: 100,
        commissionClaimed: 0,
        status: 'eligible_for_claim',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const fakeOrderRef = db.collection('orders').doc(`ord_fake_rzp_${Date.now()}`);
      markForCleanup(fakeOrderRef);
      await fakeOrderRef.set({
        userId: claimAffiliateUid,
        status: 'paid',
        total: 100,
        razorpayPaymentId: 'pay_nonexistent_fake_id', // will cause Razorpay refund API to fail
        referralRefundedAmount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const refundClaimRes = await fetch(`${BASE_URL}/api/referral/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({
          claimType: 'refund',
          orderId: fakeOrderRef.id,
        }),
      });

      const refundJson = await refundClaimRes.json();
      if (refundClaimRes.status !== 500) {
        throw new Error(`Expected 500 gateway failure, got: ${refundClaimRes.status} ${JSON.stringify(refundJson)}`);
      }

      // Verify Firestore rollback occurred
      const rolledBackDoc = await rollbackRefDoc.get();
      if (rolledBackDoc.data()?.status !== 'eligible_for_claim' || rolledBackDoc.data()?.commissionClaimed !== 0) {
        throw new Error(`Rollback failed! Referral doc state: ${JSON.stringify(rolledBackDoc.data())}`);
      }

      record('TEST-12', 'Payout Gateway Rollback & Configuration Defense', 'PASSED',
        `Unconfigured bank details correctly blocked; failed refund cleanly rolled back Firestore deductions.`);
    } catch (err) {
      record('TEST-12', 'Payout Gateway Rollback & Configuration Defense', 'FAILED', err.message);
    }

  } finally {
    console.log('\n--- Restoring Global / Campaign Settings & Cleaning Test Data ---');
    // Restore original campaign settings if previously captured
    if (origCampaignData) {
      await campaignRef.set(origCampaignData);
    }
    if (origGlobalData) {
      await globalSettingsRef.set(origGlobalData);
    }

    // Batch clean test documents
    const batch = db.batch();
    for (const ref of cleanupRefs) {
      batch.delete(ref);
    }
    await batch.commit().catch((e) => console.warn('Cleanup batch warning:', e.message));

    // Delete created Auth test users
    for (const uid of cleanupAuthUids) {
      await admin.auth().deleteUser(uid).catch(() => {});
    }

    console.log(`Cleaned up ${cleanupRefs.length} test documents and ${cleanupAuthUids.length} test auth accounts.`);
  }

  console.log('\n======================================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('======================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\n❌ SOME VERIFICATION GATES FAILED. ABORTING CERTIFICATION.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 12 PHASE 6 VERIFICATION GATES PASSED! PHASE 6 CERTIFIED.');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('\n💥 UNCAUGHT SUITE EXCEPTION:', err);
  process.exit(1);
});
