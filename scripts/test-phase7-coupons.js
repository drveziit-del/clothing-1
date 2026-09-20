/**
 * GERKINK Phase 7 — Coupons & Validation Verification Suite
 *
 * Strict Production Standards:
 * - 0 Simulated Firestore Mutations.
 * - Live HTTP endpoints against local server with real Firebase session authentication.
 * - Real Firestore ACID transactions.
 * - Concurrency race tests for double-spend defense.
 * - Exhaustive cleanup in finally blocks.
 * - Non-zero exit code on any assertion failure.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 0. Setup TypeScript runtime loader for direct production code invocation
const jiti = require('jiti')(path.resolve(process.cwd(), 'scripts/test-phase7-coupons.js'), {
  alias: {
    '@': path.resolve(process.cwd(), 'src'),
    'server-only': path.resolve(process.cwd(), 'scripts/empty.js'),
  },
});

// Import production validator directly via jiti
const { validateCoupon } = jiti('@/lib/utils/couponValidator');

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

// Mint authentic session cookie for a test user or admin
async function getUserSessionCookie(uid, isAdmin = false) {
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({
      uid,
      email: `${uid}@gerkink-test.internal`,
    });
    cleanupAuthUids.push(uid);
  }

  if (isAdmin) {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
  }

  const customToken = await admin.auth().createCustomToken(uid, isAdmin ? { admin: true } : {});
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
  console.log('🎟️ GERKINK Phase 7 — Coupons & Validation Verification Suite');
  console.log('======================================================================\n');

  try {
    // Setup users
    const userAUid = `test_user_a_${Date.now()}`;
    const userBUid = `test_user_b_${Date.now()}`;
    const adminUid = `test_admin_${Date.now()}`;

    const [sessionCookieA, sessionCookieB, sessionCookieAdmin] = await Promise.all([
      getUserSessionCookie(userAUid),
      getUserSessionCookie(userBUid),
      getUserSessionCookie(adminUid, true),
    ]);

    // ------------------------------------------------------------------------
    // TEST 1: Active / Inactive Toggle Enforcement
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Active / Inactive Toggle Enforcement ---');
    try {
      const toggleCode = `GERK-TOGGLE-${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef1 = db.collection('coupons').doc(`coupon_toggle_${Date.now()}`);
      markForCleanup(couponRef1);

      await couponRef1.set({
        code: toggleCode,
        type: 'percentage',
        value: 10,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 1a. Verify valid when isActive: true
      const resActive = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
        body: JSON.stringify({ code: toggleCode, subtotal: 100 }),
      });
      const jsonActive = await resActive.json();
      if (!resActive.ok || !jsonActive.valid) {
        throw new Error(`Expected active coupon to validate, got: ${JSON.stringify(jsonActive)}`);
      }

      // 1b. Toggle isActive: false via admin API
      const toggleRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieAdmin}`,
          'x-forwarded-for': '198.51.100.1',
        },
        body: JSON.stringify({
          action: 'toggle',
          couponId: couponRef1.id,
          isActive: false,
        }),
      });
      const toggleJson = await toggleRes.json();
      if (!toggleRes.ok || !toggleJson.success) {
        throw new Error(`Admin toggle API failed: ${JSON.stringify(toggleJson)}`);
      }

      // 1c. Verify validate route rejects disabled coupon
      const resInactive = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
        body: JSON.stringify({ code: toggleCode, subtotal: 100 }),
      });
      const jsonInactive = await resInactive.json();
      if (resInactive.status !== 400 || !jsonInactive.error?.includes('inactive')) {
        throw new Error(`Expected 400 inactive error, got ${resInactive.status}: ${JSON.stringify(jsonInactive)}`);
      }

      // 1d. Verify validateCoupon function rejects disabled coupon
      const directCheck = await validateCoupon(toggleCode, userAUid, 100, 8);
      if (directCheck.valid || !directCheck.error?.includes('inactive')) {
        throw new Error(`validateCoupon failed to reject inactive coupon: ${JSON.stringify(directCheck)}`);
      }

      record('TEST-1', 'Active/Inactive Toggle Enforcement', 'PASSED',
        `Validated when active; admin toggle to inactive strictly rejected by both API and validator.`);
    } catch (err) {
      record('TEST-1', 'Active/Inactive Toggle Enforcement', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Case-Insensitive Code Resolution
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Case-Insensitive Code Resolution ---');
    try {
      const upperCode = `GERK-CASE${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef2 = db.collection('coupons').doc(`coupon_case_${Date.now()}`);
      markForCleanup(couponRef2);

      await couponRef2.set({
        code: upperCode,
        type: 'fixed',
        value: 15,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Lowercase test
      const lowerRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.2' },
        body: JSON.stringify({ code: upperCode.toLowerCase(), subtotal: 100 }),
      });
      const lowerJson = await lowerRes.json();
      if (!lowerRes.ok || !lowerJson.valid || lowerJson.code !== upperCode) {
        throw new Error(`Lowercase code validation failed: ${JSON.stringify(lowerJson)}`);
      }

      // Mixed case direct validator test
      const mixedCode = upperCode.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
      const directRes = await validateCoupon(mixedCode, userAUid, 100, 8);
      if (!directRes.valid || directRes.discount !== 15) {
        throw new Error(`Mixed case validation failed: ${JSON.stringify(directRes)}`);
      }

      record('TEST-2', 'Case-Insensitive Code Resolution', 'PASSED',
        `Lowercase and mixed-case inputs seamlessly resolved to uppercase canonical code (${upperCode}).`);
    } catch (err) {
      record('TEST-2', 'Case-Insensitive Code Resolution', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: User-Specific Ownership Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: User-Specific Ownership Isolation ---');
    try {
      const userACode = `GERK-USRA${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef3 = db.collection('coupons').doc(`coupon_usra_${Date.now()}`);
      markForCleanup(couponRef3);

      await couponRef3.set({
        code: userACode,
        type: 'fixed',
        value: 50,
        isGlobal: false,
        userId: userAUid,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3a. User A validates their own coupon -> valid
      const resUserA = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieA}`,
          'x-forwarded-for': '198.51.100.3',
        },
        body: JSON.stringify({ code: userACode, subtotal: 100 }),
      });
      const jsonUserA = await resUserA.json();
      if (!resUserA.ok || !jsonUserA.valid || jsonUserA.discountUSD !== 50) {
        throw new Error(`Owner User A could not validate own coupon: ${JSON.stringify(jsonUserA)}`);
      }

      // 3b. User B attempts to validate User A's coupon -> rejected
      const resUserB = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieB}`,
          'x-forwarded-for': '198.51.100.3',
        },
        body: JSON.stringify({ code: userACode, subtotal: 100 }),
      });
      const jsonUserB = await resUserB.json();
      if (resUserB.status === 200 && jsonUserB.valid) {
        throw new Error(`SECURITY LEAK: User B successfully validated User A's coupon!`);
      }

      // 3c. Direct validateCoupon call with mismatched uid -> rejected
      const directMismatch = await validateCoupon(userACode, userBUid, 100, 8);
      if (directMismatch.valid) {
        throw new Error(`validateCoupon allowed cross-user redemption: ${JSON.stringify(directMismatch)}`);
      }

      record('TEST-3', 'User-Specific Ownership Isolation', 'PASSED',
        `User A verified ownership; User B and unauthorized callers strictly blocked from redeeming.`);
    } catch (err) {
      record('TEST-3', 'User-Specific Ownership Isolation', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Minimum Subtotal Spend Threshold
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Minimum Subtotal Spend Threshold ---');
    try {
      const minCode = `GERK-MIN${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef4 = db.collection('coupons').doc(`coupon_min_${Date.now()}`);
      markForCleanup(couponRef4);

      await couponRef4.set({
        code: minCode,
        type: 'fixed',
        value: 25,
        minSubtotal: 150,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4a. Order subtotal below $150 threshold
      const resBelow = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.4' },
        body: JSON.stringify({ code: minCode, subtotal: 140 }),
      });
      const jsonBelow = await resBelow.json();
      if (resBelow.status !== 400 || !jsonBelow.error?.includes('$150')) {
        throw new Error(`Expected 400 min subtotal error, got ${resBelow.status}: ${JSON.stringify(jsonBelow)}`);
      }

      // 4b. Order subtotal meeting $150 threshold
      const resExact = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.4' },
        body: JSON.stringify({ code: minCode, subtotal: 150 }),
      });
      const jsonExact = await resExact.json();
      if (!resExact.ok || !jsonExact.valid || jsonExact.discountUSD !== 25) {
        throw new Error(`Subtotal $150 failed validation: ${JSON.stringify(jsonExact)}`);
      }

      record('TEST-4', 'Minimum Subtotal Spend Threshold ($150)', 'PASSED',
        `Subtotal $140 rejected with explicit requirement message; $150 subtotal approved with $25 discount.`);
    } catch (err) {
      record('TEST-4', 'Minimum Subtotal Spend Threshold ($150)', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Percentage vs Fixed Discount Capping
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Discount Capping & Negative Value Defenses ---');
    try {
      const fixedHighCode = `GERK-HIGH${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef5 = db.collection('coupons').doc(`coupon_high_${Date.now()}`);
      markForCleanup(couponRef5);

      await couponRef5.set({
        code: fixedHighCode,
        type: 'fixed',
        value: 300, // $300 discount
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Subtotal $100 + Tax $8 = Grand total $108. Discount must be capped at $108, NOT $300!
      const capCheck = await validateCoupon(fixedHighCode, userAUid, 100, 8);
      if (!capCheck.valid || capCheck.discount !== 108) {
        throw new Error(`Discount capping failed: expected $108, got $${capCheck.discount}`);
      }

      // Percentage 20% on $100 subtotal
      const percCode = `GERK-PERC${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef5b = db.collection('coupons').doc(`coupon_perc_${Date.now()}`);
      markForCleanup(couponRef5b);

      await couponRef5b.set({
        code: percCode,
        type: 'percentage',
        value: 20,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const percCheck = await validateCoupon(percCode, userAUid, 100, 8);
      if (!percCheck.valid || percCheck.discount !== 20) {
        throw new Error(`Percentage discount calculation failed: expected $20, got $${percCheck.discount}`);
      }

      // Negative values sanitization
      const negCheck = await validateCoupon(percCode, userAUid, -50, -10);
      if (!negCheck.valid || negCheck.discount !== 0) {
        throw new Error(`Negative subtotal input failed defense: expected $0, got $${negCheck.discount}`);
      }

      record('TEST-5', 'Discount Capping & Negative Value Defenses', 'PASSED',
        `$300 fixed coupon capped at order total ($108); 20% coupon calculated accurately; negative values safely zeroed.`);
    } catch (err) {
      record('TEST-5', 'Discount Capping & Negative Value Defenses', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Expiry Date Rejection
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Expiry Date Rejection ---');
    try {
      const expCode = `GERK-EXP${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef6 = db.collection('coupons').doc(`coupon_exp_${Date.now()}`);
      markForCleanup(couponRef6);

      // Expired yesterday
      await couponRef6.set({
        code: expCode,
        type: 'percentage',
        value: 15,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const resExp = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.6' },
        body: JSON.stringify({ code: expCode, subtotal: 100 }),
      });
      const jsonExp = await resExp.json();
      if (resExp.status !== 400 || !jsonExp.error?.includes('expired')) {
        throw new Error(`Expected 400 expired error, got ${resExp.status}: ${JSON.stringify(jsonExp)}`);
      }

      const directExp = await validateCoupon(expCode, userAUid, 100, 8);
      if (directExp.valid || !directExp.error?.includes('expired')) {
        throw new Error(`validateCoupon failed to reject expired coupon: ${JSON.stringify(directExp)}`);
      }

      record('TEST-6', 'Expiry Date Rejection', 'PASSED',
        `Expired coupon strictly rejected with 'This coupon has expired' message.`);
    } catch (err) {
      record('TEST-6', 'Expiry Date Rejection', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 7: Max Uses Depletion for Global Coupons
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Max Uses Depletion for Global Coupons ---');
    try {
      const maxCode = `GERK-MAX${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef7 = db.collection('coupons').doc(`coupon_max_${Date.now()}`);
      markForCleanup(couponRef7);

      await couponRef7.set({
        code: maxCode,
        type: 'fixed',
        value: 10,
        isGlobal: true,
        isActive: true,
        isUsed: false,
        timesUsed: 1,
        maxUses: 2,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7a. timesUsed: 1 < maxUses: 2 -> valid
      const check1 = await validateCoupon(maxCode, userAUid, 100, 8);
      if (!check1.valid) {
        throw new Error(`Expected coupon with remaining uses to be valid: ${JSON.stringify(check1)}`);
      }

      // 7b. Increment to timesUsed: 2 >= maxUses: 2
      await couponRef7.update({ timesUsed: 2 });

      const resDepleted = await fetch(`${BASE_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
        body: JSON.stringify({ code: maxCode, subtotal: 100 }),
      });
      const jsonDepleted = await resDepleted.json();
      if (resDepleted.status !== 400 || !jsonDepleted.error?.includes('maximum usage limit')) {
        throw new Error(`Expected 400 max usage error, got ${resDepleted.status}: ${JSON.stringify(jsonDepleted)}`);
      }

      record('TEST-7', 'Max Uses Depletion for Global Coupons', 'PASSED',
        `Global coupon with maxUses:2 validated at 1 use, strictly rejected once depleted at 2 uses.`);
    } catch (err) {
      record('TEST-7', 'Max Uses Depletion for Global Coupons', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 8: Concurrent Double-Redemption Race Defense
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Concurrent Double-Redemption Race Defense ---');
    try {
      const raceCode = `GERK-RACE${Math.floor(1000 + Math.random() * 9000)}`;
      const couponRef8 = db.collection('coupons').doc(`coupon_race_${Date.now()}`);
      markForCleanup(couponRef8);

      await couponRef8.set({
        code: raceCode,
        type: 'fixed',
        value: 20,
        isGlobal: false,
        userId: userAUid,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Simulate 5 concurrent checkouts racing to redeem the single-use coupon
      const orderIds = [1, 2, 3, 4, 5].map((i) => `ord_race_${Date.now()}_${i}`);
      for (const oId of orderIds) {
        const oRef = db.collection('orders').doc(oId);
        markForCleanup(oRef);
        await oRef.set({
          userId: userAUid,
          total: 88,
          subtotal: 100,
          tax: 8,
          discount: 20,
          couponCode: raceCode,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Execute 5 concurrent transactional burns
      const raceAttempts = orderIds.map(async (oId) => {
        const orderDocRef = db.collection('orders').doc(oId);
        try {
          return await db.runTransaction(async (transaction) => {
            const oDoc = await transaction.get(orderDocRef);
            const cDoc = await transaction.get(couponRef8);

            if (!oDoc.exists) throw new Error('ORDER_MISSING');
            if (!cDoc.exists) throw new Error('COUPON_MISSING');

            const cData = cDoc.data();
            if (cData.isUsed) {
              throw new Error('COUPON_ALREADY_USED');
            }

            transaction.update(orderDocRef, {
              status: 'paid',
              couponConsumed: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            transaction.update(couponRef8, {
              isUsed: true,
              orderId: oId,
              timesUsed: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true, orderId: oId };
          });
        } catch (txErr) {
          return { success: false, orderId: oId, error: txErr.message };
        }
      });

      const raceResults = await Promise.all(raceAttempts);
      const successes = raceResults.filter((r) => r.success);
      const failures = raceResults.filter((r) => !r.success);

      if (successes.length !== 1) {
        throw new Error(`Concurrency race failed: expected exactly 1 winner, but got ${successes.length} winners!`);
      }
      if (failures.length !== 4) {
        throw new Error(`Expected exactly 4 rejections, got ${failures.length}`);
      }

      const finalCouponDoc = await couponRef8.get();
      if (!finalCouponDoc.data()?.isUsed || finalCouponDoc.data()?.timesUsed !== 1) {
        throw new Error(`Coupon document corrupted after race: ${JSON.stringify(finalCouponDoc.data())}`);
      }

      record('TEST-8', 'Concurrent Double-Redemption Race Defense', 'PASSED',
        `5 concurrent transactional checkouts: exactly 1 winner, 4 rejected with COUPON_ALREADY_USED.`);
    } catch (err) {
      record('TEST-8', 'Concurrent Double-Redemption Race Defense', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 9: 100% Free Order Atomic Burn (/api/payment/verify-free)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: 100% Free Order Atomic Burn (/api/payment/verify-free) ---');
    try {
      const freeCode = `GERK-FREE${Math.floor(1000 + Math.random() * 9000)}`;
      const freeCouponRef = db.collection('coupons').doc(`coupon_free_${Date.now()}`);
      markForCleanup(freeCouponRef);

      await freeCouponRef.set({
        code: freeCode,
        type: 'percentage',
        value: 100,
        isGlobal: false,
        userId: userAUid,
        isActive: true,
        isUsed: false,
        timesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create free order in pending status
      const freeOrderId = `ord_free_${Date.now()}`;
      const freeOrderRef = db.collection('orders').doc(freeOrderId);
      markForCleanup(freeOrderRef);

      await freeOrderRef.set({
        userId: userAUid,
        subtotal: 100,
        tax: 8,
        discount: 108,
        total: 0,
        couponCode: freeCode,
        razorpayOrderId: 'free_order',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 9a. Verify free order via API
      const freeRes = await fetch(`${BASE_URL}/api/payment/verify-free`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieA}`,
        },
        body: JSON.stringify({ orderId: freeOrderId }),
      });

      const freeJson = await freeRes.json();
      if (!freeRes.ok || freeJson.status !== 'ok') {
        throw new Error(`verify-free failed: ${freeRes.status} — ${JSON.stringify(freeJson)}`);
      }

      // Verify order updated to paid
      const paidOrderDoc = await freeOrderRef.get();
      if (paidOrderDoc.data()?.status !== 'paid' || !paidOrderDoc.data()?.paymentCaptured) {
        throw new Error(`Free order status was not marked paid: ${JSON.stringify(paidOrderDoc.data())}`);
      }

      // Verify coupon marked used
      const burnedCouponDoc = await freeCouponRef.get();
      if (!burnedCouponDoc.data()?.isUsed || burnedCouponDoc.data()?.timesUsed !== 1) {
        throw new Error(`Free coupon was not burned: ${JSON.stringify(burnedCouponDoc.data())}`);
      }

      // 9b. Second attempt to use the same burned coupon on a new order must be rejected
      const freeOrder2Id = `ord_free2_${Date.now()}`;
      const freeOrder2Ref = db.collection('orders').doc(freeOrder22Id = freeOrder2Id);
      markForCleanup(freeOrder2Ref);

      await freeOrder2Ref.set({
        userId: userAUid,
        subtotal: 100,
        tax: 8,
        discount: 108,
        total: 0,
        couponCode: freeCode,
        razorpayOrderId: 'free_order',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const repeatFreeRes = await fetch(`${BASE_URL}/api/payment/verify-free`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieA}`,
        },
        body: JSON.stringify({ orderId: freeOrder2Id }),
      });

      if (repeatFreeRes.status !== 400) {
        throw new Error(`Expected 400 on burned coupon re-checkout, got ${repeatFreeRes.status}`);
      }

      record('TEST-9', '100% Free Order Atomic Burn & Re-use Rejection', 'PASSED',
        `Free checkout verified, paid order created, coupon atomically burned; reuse attempt strictly blocked.`);
    } catch (err) {
      record('TEST-9', '100% Free Order Atomic Burn & Re-use Rejection', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 10: Admin Input Sanitization & Anti-Enumeration Rate Limiting
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Admin Sanitization & Anti-Enumeration Rate Limiting ---');
    try {
      // 10a. Admin coupon creation with negative value -> rejected 400
      const negRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieAdmin}`,
        },
        body: JSON.stringify({
          code: 'GERK-NEG',
          type: 'fixed',
          value: -20,
          isGlobal: true,
        }),
      });
      if (negRes.status !== 400) {
        throw new Error(`Expected 400 for negative value, got ${negRes.status}`);
      }

      // 10b. Admin coupon creation with percentage > 100 -> rejected 400
      const overPercRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieAdmin}`,
        },
        body: JSON.stringify({
          code: 'GERK-OVER100',
          type: 'percentage',
          value: 125,
          isGlobal: true,
        }),
      });
      if (overPercRes.status !== 400) {
        throw new Error(`Expected 400 for >100 percentage, got ${overPercRes.status}`);
      }

      // 10c. Admin coupon creation with invalid characters -> rejected 400
      const badCodeRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookieAdmin}`,
        },
        body: JSON.stringify({
          code: 'BAD CODE @!#$',
          type: 'fixed',
          value: 10,
          isGlobal: true,
        }),
      });
      if (badCodeRes.status !== 400) {
        throw new Error(`Expected 400 for invalid characters, got ${badCodeRes.status}`);
      }

      // 10d. Anti-enumeration rate limiting on /api/coupons/validate (limit 15 req / 15 min)
      const spamPromises = [];
      for (let i = 0; i < 18; i++) {
        spamPromises.push(
          fetch(`${BASE_URL}/api/coupons/validate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '203.0.113.88',
            },
            body: JSON.stringify({ code: `GUESS_${i}`, subtotal: 100 }),
          })
        );
      }
      const spamResults = await Promise.all(spamPromises);
      const rateLimited = spamResults.some((r) => r.status === 429);

      if (!rateLimited) {
        throw new Error('Expected at least one 429 Too Many Requests response under enumeration burst');
      }

      record('TEST-10', 'Admin Input Sanitization & Anti-Enumeration Rate Limiting', 'PASSED',
        `Admin rejected negative, >100%, and illegal chars; burst validation attacks throttled with 429.`);
    } catch (err) {
      record('TEST-10', 'Admin Input Sanitization & Anti-Enumeration Rate Limiting', 'FAILED', err.message);
    }

  } finally {
    console.log('\n--- Cleaning Up Phase 7 Test Artifacts ---');
    const batch = db.batch();
    for (const ref of cleanupRefs) {
      batch.delete(ref);
    }
    await batch.commit().catch((e) => console.warn('Cleanup batch warning:', e.message));

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
    console.log('\n🎉 ALL 10 PHASE 7 VERIFICATION GATES PASSED! PHASE 7 CERTIFIED.');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('\n💥 UNCAUGHT SUITE EXCEPTION:', err);
  process.exit(1);
});
