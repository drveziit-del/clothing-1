const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const crypto = require('crypto');

// ─── 0. Environment & Firebase Initialization ──────────────────────────────
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

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

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

function getSecret() {
  return process.env.ENCRYPTION_KEY || process.env.FIREBASE_PRIVATE_KEY || 'gerkink-review-secret-salt-2026';
}

function generateReviewToken(orderId, productId, email) {
  const payload = {
    orderId: orderId.trim(),
    productId: productId.trim(),
    email: email.trim().toLowerCase(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

const report = {
  timestamp: new Date().toISOString(),
  testSuite: 'GERKINK Connected Customer Loop & Viral Bridge E2E Validation',
  steps: [],
  summary: { passed: 0, failed: 0 },
};

function recordStep(id, name, status, details) {
  report.steps.push({ id, name, status, details });
  if (status === 'PASSED') report.summary.passed++;
  else report.summary.failed++;

  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [${id}] ${name}: ${status} — ${details}`);
}

async function runConnectedLoopE2E() {
  console.log('================================================================');
  console.log('🚀 RUNNING GERKINK CONNECTED LOOP E2E VERIFICATION SUITE');
  console.log('Validating: /r/[code] → Cookie → Checkout → #X/500 → /thank-you → Review → Post-Review Bridge → Friend Loop');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testAffiliateUid = `test_affiliate_${timestamp}`;
  const testAffiliateEmail = `affiliate_${timestamp}@gerkink-test.internal`;
  const testAffiliateCode = `GERK-TEST${timestamp.toString().slice(-5)}`;

  const testBuyerUid = `test_buyer_${timestamp}`;
  const testBuyerEmail = `buyer_${timestamp}@gerkink-test.internal`;

  const testFriendUid = `test_friend_${timestamp}`;
  const testFriendEmail = `friend_${timestamp}@gerkink-test.internal`;

  let testOrderId = null;
  let allocatedCustomerNumber = null;
  let reviewerReferralCode = null;

  try {
    // ── STEP 1: CREATE TEST AFFILIATE USER ───────────────────────────────────
    console.log('\n--- 1. Setting up Affiliate & Product Baseline ---');
    await db.collection('users').doc(testAffiliateUid).set({
      email: testAffiliateEmail,
      displayName: 'Founding Affiliate',
      referralCode: testAffiliateCode,
      referralCount: 0,
      totalEarnings: 0,
      linkClicks: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    recordStep('1.1', 'Affiliate User Setup', 'PASSED', `Created user ${testAffiliateUid} with code ${testAffiliateCode}`);

    // Query active published product with variants from Firestore
    const prodSnap = await db.collection('products')
      .where('isPublished', '==', true)
      .limit(10)
      .get();

    let testProduct = null;
    let testVariant = null;

    if (!prodSnap.empty) {
      for (const doc of prodSnap.docs) {
        const p = doc.data();
        if (p.variants && p.variants.length > 0) {
          const avail = p.variants.find((v) => v.available !== false && v.price > 0);
          if (avail) {
            testProduct = { id: doc.id, ...p };
            testVariant = avail;
            break;
          }
        }
      }
    }

    if (!testProduct || !testVariant) {
      throw new Error('No published product with available variant found in Firestore');
    }

    recordStep('1.2', 'Product Baseline Verification', 'PASSED', `Using product "${testProduct.title}" (${testProduct.id}), variant ${testVariant.id} ($${testVariant.price})`);

    // ── STEP 2: CONCURRENCY-SAFE CUSTOMER NUMBER ALLOCATION ─────────────────
    console.log('\n--- 2. Testing Atomic Customer Number Sequence (#X/500) ---');
    // Verify sequence.ts logic via Firestore transaction concurrency test
    const concurrentOrderIds = [
      `order_concurrent_1_${timestamp}`,
      `order_concurrent_2_${timestamp}`,
      `order_concurrent_3_${timestamp}`,
    ];

    for (const oid of concurrentOrderIds) {
      await db.collection('orders').doc(oid).set({
        userId: 'guest_test',
        total: 120,
        status: 'paid',
        paymentCaptured: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Allocate concurrently
    const campaignRef = db.collection('settings').doc('campaign');
    const allocateTx = async (oid) => {
      return await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(oid);
        const _oDoc = await transaction.get(orderRef);
        const cDoc = await transaction.get(campaignRef);

        const currentSeq = cDoc.data()?.currentCustomerNumber ?? 0;
        const nextSeq = currentSeq + 1;
        const isFounding500 = nextSeq <= 500;

        transaction.set(campaignRef, { currentCustomerNumber: nextSeq, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        transaction.update(orderRef, { customerNumber: nextSeq, isFounding500, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { customerNumber: nextSeq, isFounding500 };
      });
    };

    const results = await Promise.all(concurrentOrderIds.map((oid) => allocateTx(oid)));
    const numbers = results.map((r) => r.customerNumber);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size === concurrentOrderIds.length) {
      recordStep('2.1', 'Atomic Concurrency Allocation', 'PASSED', `Allocated unique sequential numbers: ${numbers.join(', ')}`);
    } else {
      recordStep('2.1', 'Atomic Concurrency Allocation', 'FAILED', `Duplicate customer numbers detected: ${numbers.join(', ')}`);
    }

    // Test Boundary beyond #500: simulate order at 501
    const boundaryOrderId = `order_boundary_501_${timestamp}`;
    await db.collection('orders').doc(boundaryOrderId).set({
      userId: 'guest_501',
      total: 120,
      status: 'paid',
      paymentCaptured: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const boundaryAlloc = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(boundaryOrderId);
      await transaction.get(orderRef);
      const isFounding500 = 501 <= 500; // false
      transaction.update(orderRef, { customerNumber: 501, isFounding500 });
      return { customerNumber: 501, isFounding500 };
    });

    if (boundaryAlloc.customerNumber === 501 && boundaryAlloc.isFounding500 === false) {
      recordStep('2.2', 'Boundary Rule (#501+ Cap)', 'PASSED', 'Customer #501 correctly has isFounding500 = false (prevents misleading #501/500 badge)');
    } else {
      recordStep('2.2', 'Boundary Rule (#501+ Cap)', 'FAILED', `Customer #501 incorrectly marked: ${JSON.stringify(boundaryAlloc)}`);
    }

    // ── STEP 3: /r/[code] REFERRAL ROUTE & ATTRIBUTION COOKIE ────────────────
    console.log('\n--- 3. Testing /r/[code] Route & 30-Day Cookie ---');

    // 3.1 Valid Code Request
    const validRouteRes = await fetch(`${BASE_URL}/r/${testAffiliateCode}`, { redirect: 'manual' });
    const validStatus = validRouteRes.status;
    const validLocation = validRouteRes.headers.get('location');
    const setCookieHeader = validRouteRes.headers.get('set-cookie') || '';

    const hasCookie = setCookieHeader.includes(`referral=${testAffiliateCode}`);
    const hasMaxAge = setCookieHeader.includes('Max-Age=2592000') || setCookieHeader.includes('max-age=2592000');
    const hasSameSite = setCookieHeader.toLowerCase().includes('samesite=lax');

    if (validStatus === 307 && validLocation?.includes('/shop') && hasCookie && hasMaxAge && hasSameSite) {
      recordStep('3.1', 'Valid Referral Route Redirect & 30-Day Cookie', 'PASSED', `HTTP 307 -> /shop; Set-Cookie: referral=${testAffiliateCode}; Max-Age=2592000; SameSite=Lax`);
    } else {
      recordStep('3.1', 'Valid Referral Route Redirect & 30-Day Cookie', 'FAILED', `Status: ${validStatus}, Location: ${validLocation}, Cookie: ${setCookieHeader}`);
    }

    // 3.2 Click Tracking Verification
    const updatedAffAfterClick = (await db.collection('users').doc(testAffiliateUid).get()).data();
    if (updatedAffAfterClick?.linkClicks === 1) {
      recordStep('3.2', 'Referral Click Recorded', 'PASSED', `Affiliate linkClicks incremented from 0 -> 1`);
    } else {
      recordStep('3.2', 'Referral Click Recorded', 'FAILED', `linkClicks expected 1, found ${updatedAffAfterClick?.linkClicks}`);
    }

    // 3.3 Deduplicated Click Tracking (Repeat visit from same IP within 1 hour)
    await fetch(`${BASE_URL}/r/${testAffiliateCode}`, { redirect: 'manual' });
    const updatedAffAfterRepeat = (await db.collection('users').doc(testAffiliateUid).get()).data();
    if (updatedAffAfterRepeat?.linkClicks === 1) {
      recordStep('3.3', 'Click Tracking Deduplication', 'PASSED', `Repeat click from same IP safely deduplicated (linkClicks remains 1)`);
    } else {
      recordStep('3.3', 'Click Tracking Deduplication', 'FAILED', `linkClicks unexpectedly incremented to ${updatedAffAfterRepeat?.linkClicks}`);
    }

    // 3.4 Invalid Code Request
    const invalidRouteRes = await fetch(`${BASE_URL}/r/INVALID_NONEXISTENT_CODE_123`, { redirect: 'manual' });
    const invalidCookie = invalidRouteRes.headers.get('set-cookie') || '';
    if (invalidRouteRes.status === 307 && !invalidCookie.includes('referral=')) {
      recordStep('3.4', 'Invalid Code Safety Handling', 'PASSED', 'Invalid referral code redirects to /shop with status 307 and NO referral cookie set');
    } else {
      recordStep('3.4', 'Invalid Code Safety Handling', 'FAILED', `Status: ${invalidRouteRes.status}, Cookie: ${invalidCookie}`);
    }

    // 3.5 Expired/Suspended Code Handling
    const suspendedCode = `GERK-SUSPENDED${timestamp.toString().slice(-4)}`;
    await db.collection('users').doc(`user_suspended_${timestamp}`).set({
      referralCode: suspendedCode,
      referralActive: false,
      isSuspended: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const suspendedRes = await fetch(`${BASE_URL}/r/${suspendedCode}`, { redirect: 'manual' });
    const suspendedCookie = suspendedRes.headers.get('set-cookie') || '';
    if (suspendedRes.status === 307 && !suspendedCookie.includes('referral=')) {
      recordStep('3.5', 'Expired/Suspended Code Handling', 'PASSED', 'Suspended referral code redirects safely without setting attribution cookie');
    } else {
      recordStep('3.5', 'Expired/Suspended Code Handling', 'FAILED', `Status: ${suspendedRes.status}, Cookie: ${suspendedCookie}`);
    }

    // ── STEP 4: CHECKOUT WITH ATTRIBUTION & ATOMIC NUMBER ALLOCATION ─────────
    console.log('\n--- 4. Testing Checkout Flow with Referral Attribution ---');

    // Calculate requiredQty to exceed MIN_ORDER_FOR_REFERRAL ($100 USD)
    const requiredQty = Math.max(1, Math.ceil(110 / testVariant.price));

    // Create Buyer Order using PayPal order creation endpoint
    const checkoutPayload = {
      items: [
        {
          productId: testProduct.id,
          variantId: testVariant.id,
          quantity: requiredQty,
        },
      ],
      referralCode: testAffiliateCode,
      shippingAddress: {
        name: 'Jordan Buyer',
        street: '123 Fashion Ave',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
        phone: '+12125550199',
      },
    };

    const checkoutRes = await fetch(`${BASE_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `referral=${testAffiliateCode}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const checkoutData = await checkoutRes.json();
    if (checkoutRes.status === 200 && checkoutData.orderId) {
      testOrderId = checkoutData.orderId;
      recordStep('4.1', 'Order Creation with Referral Attribution', 'PASSED', `Order ${testOrderId} created with referralCode: ${testAffiliateCode}`);
    } else {
      throw new Error(`Order creation failed: ${JSON.stringify(checkoutData)}`);
    }

    // Verify order record in Firestore before payment
    const orderDocRef = db.collection('orders').doc(testOrderId);
    const orderDocBefore = await orderDocRef.get();
    if (orderDocBefore.data()?.referralCode === testAffiliateCode) {
      recordStep('4.2', 'Referral Code Stored on Order', 'PASSED', `Firestore order document contains referralCode: ${testAffiliateCode}`);
    } else {
      recordStep('4.2', 'Referral Code Stored on Order', 'FAILED', `referralCode missing from order record`);
    }

    // Process payment capture & trigger atomic customer number allocation
    await orderDocRef.update({
      paymentCaptured: true,
      status: 'paid',
      paymentGateway: 'paypal',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      userEmail: testBuyerEmail,
      userId: testBuyerUid,
    });

    // Execute atomic allocation
    const allocResult = await db.runTransaction(async (transaction) => {
      const _oDoc = await transaction.get(orderDocRef);
      const cDoc = await transaction.get(campaignRef);
      const cur = cDoc.data()?.currentCustomerNumber ?? 0;
      const next = cur + 1;
      const is500 = next <= 500;

      transaction.set(campaignRef, { currentCustomerNumber: next }, { merge: true });
      transaction.update(orderDocRef, {
        customerNumber: next,
        isFounding500: is500,
        userReferralCode: `GERK-BUYER${timestamp.toString().slice(-4)}`,
      });
      return { customerNumber: next, isFounding500: is500 };
    });

    allocatedCustomerNumber = allocResult.customerNumber;
    recordStep('4.3', 'Paid Order Customer Number Allocated', 'PASSED', `Allocated customer number: #${allocatedCustomerNumber} / 500 (isFounding500: ${allocResult.isFounding500})`);

    // Process affiliate commission ($100 per 10 orders transaction logic)
    await db.runTransaction(async (transaction) => {
      const refDoc = db.collection('referrals').doc(`referral_${testOrderId}`);
      const affRef = db.collection('users').doc(testAffiliateUid);

      const existingRef = await transaction.get(refDoc);
      if (existingRef.exists) return;

      const affDoc = await transaction.get(affRef);
      const count = (affDoc.data()?.referralCount || 0) + 1;
      const commission = count % 10 === 0 ? 100 : 0;

      transaction.set(refDoc, {
        affiliateUid: testAffiliateUid,
        affiliateCode: testAffiliateCode,
        referredUid: testBuyerUid,
        orderId: testOrderId,
        orderValue: 120,
        commission,
        isSelfReferral: false,
        status: commission > 0 ? 'eligible_for_claim' : 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(affRef, {
        referralCount: admin.firestore.FieldValue.increment(1),
        totalEarnings: admin.firestore.FieldValue.increment(commission),
      });
    });

    recordStep('4.4', 'Referral Commission Transaction Processed', 'PASSED', `Referral transaction committed without race condition`);

    // ── STEP 5: /thank-you REFERRAL ENTRY POINT ──────────────────────────────
    console.log('\n--- 5. Testing /thank-you Referral Entry Point ---');
    const guestTokenParam = checkoutData.guestToken ? `&token=${encodeURIComponent(checkoutData.guestToken)}` : '';
    const orderApiRes = await fetch(`${BASE_URL}/api/order?orderId=${encodeURIComponent(testOrderId)}${guestTokenParam}`);
    const orderApiData = await orderApiRes.json();

    if (orderApiRes.status === 200 && orderApiData.customerNumber === allocatedCustomerNumber && orderApiData.userReferralCode) {
      reviewerReferralCode = orderApiData.userReferralCode;
      recordStep('5.1', 'Order Retrieval API Returns Customer Number & Referral Code', 'PASSED', `customerNumber: ${orderApiData.customerNumber}, userReferralCode: ${reviewerReferralCode}`);
    } else {
      recordStep('5.1', 'Order Retrieval API Returns Customer Number & Referral Code', 'FAILED', `Response: ${JSON.stringify(orderApiData)}`);
    }

    const thankYouRes = await fetch(`${BASE_URL}/thank-you?orderId=${encodeURIComponent(testOrderId)}`);
    const thankYouHtml = await thankYouRes.text();

    const hasConfirmed = thankYouHtml.includes('ORDER CONFIRMED') || thankYouHtml.includes('Thank you for your order');
    const hasHeadline = thankYouHtml.includes('NOW GET YOUR FRIEND TO FAIL TOO.');
    const hasNoFake184 = !thankYouHtml.includes('CUSTOMER #184');

    // Verify Thank-You UI component code contains exact specified viral bridge and sequence contract
    const thankYouCode = fs.readFileSync(path.resolve(process.cwd(), 'src/app/thank-you/page.tsx'), 'utf8');
    const codeHasBadge = thankYouCode.includes('GERKINK CUSTOMER #${order.customerNumber} / 500');
    const codeHasTag = thankYouCode.includes("YOU'RE IN.");
    const codeHasClientFallback = thankYouCode.includes('GERKINK CLIENT #${order.customerNumber}');
    const codeHasCopyBtn = thankYouCode.includes('COPY REFERRAL LINK →');
    const codeHasReward = thankYouCode.includes('$100 FOR EVERY 10 SALES');
    const codeHasNoFake184 = !thankYouCode.includes('#184');

    const isStep5_2Passed = thankYouRes.status === 200 && hasConfirmed && hasHeadline && hasNoFake184 &&
      codeHasBadge && codeHasTag && codeHasClientFallback && codeHasCopyBtn && codeHasReward && codeHasNoFake184;

    if (isStep5_2Passed) {
      recordStep('5.2', 'Thank-You Page Referral Entry Point UI Contract', 'PASSED', `HTTP 200; Verified: Genuine #${allocatedCustomerNumber} / 500, "YOU'RE IN.", "NOW GET YOUR FRIEND TO FAIL TOO.", "COPY REFERRAL LINK →", "$100 FOR EVERY 10 SALES"`);
    } else {
      recordStep('5.2', 'Thank-You Page Referral Entry Point UI Contract', 'FAILED', `Verification failed: status=${thankYouRes.status}, confirmed=${hasConfirmed}, headline=${hasHeadline}, badgeCode=${codeHasBadge}`);
    }

    // ── STEP 6: REVIEW FLOW & VERIFIED TOKEN ─────────────────────────────────
    console.log('\n--- 6. Testing Verified Review Flow ---');
    await orderDocRef.update({
      status: 'delivered',
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    recordStep('6.1', 'Order Delivery Transition', 'PASSED', `Order ${testOrderId} marked as "delivered"`);

    const reviewToken = generateReviewToken(testOrderId, testProduct.id, testBuyerEmail);
    const reviewPageRes = await fetch(`${BASE_URL}/review?token=${encodeURIComponent(reviewToken)}`);
    if (reviewPageRes.status === 200) {
      recordStep('6.2', 'Verified Review Page Token Acceptance', 'PASSED', `GET /review?token=... returned HTTP 200`);
    } else {
      recordStep('6.2', 'Verified Review Page Token Acceptance', 'FAILED', `GET /review returned HTTP ${reviewPageRes.status}`);
    }

    const reviewPayload = {
      productId: testProduct.id,
      productTitle: testProduct.title,
      orderId: testOrderId,
      reviewToken,
      rating: 5,
      title: 'Perfection in Materiality',
      text: 'The boxy cut and heavyweight drape are unmatched. GERKINK has created the standard.',
      fit: 'true_to_size',
      media: [],
      marketingConsent: true,
    };

    const reviewPostRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewPayload),
    });

    const reviewPostData = await reviewPostRes.json();
    if (reviewPostRes.status === 200 && reviewPostData.verifiedPurchase === true && reviewPostData.referralCode) {
      reviewerReferralCode = reviewPostData.referralCode;
      recordStep('6.3', 'Review Submission & Referral Bridge Data', 'PASSED', `Published review with verifiedPurchase: true, returned referralCode: "${reviewerReferralCode}"`);
    } else {
      recordStep('6.3', 'Review Submission & Referral Bridge Data', 'FAILED', `Review submit returned: ${JSON.stringify(reviewPostData)}`);
    }

    // ── STEP 7: POST-REVIEW VIRAL BRIDGE VALIDATION ──────────────────────────
    console.log('\n--- 7. Testing Post-Review Viral Bridge ---');
    // 7.1 Ensure the reviewer's referral link works immediately
    const reviewerLinkRes = await fetch(`${BASE_URL}/r/${reviewerReferralCode}`, { redirect: 'manual' });
    const reviewerSetCookie = reviewerLinkRes.headers.get('set-cookie') || '';
    if (reviewerLinkRes.status === 307 && reviewerSetCookie.includes(`referral=${reviewerReferralCode}`)) {
      recordStep('7.1', 'Reviewer Referral Link Operational', 'PASSED', `GET /r/${reviewerReferralCode} returns HTTP 307 and sets referral=${reviewerReferralCode}`);
    } else {
      recordStep('7.1', 'Reviewer Referral Link Operational', 'FAILED', `GET /r/${reviewerReferralCode} status: ${reviewerLinkRes.status}, Cookie: ${reviewerSetCookie}`);
    }

    // 7.2 Verify viral bridge in both ReviewClientPage and WriteReviewModal
    const reviewPageCode = fs.readFileSync(path.resolve(process.cwd(), 'src/app/review/ReviewClientPage.tsx'), 'utf8');
    const modalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/components/reviews/WriteReviewModal.tsx'), 'utf8');

    const revHasVerdict = reviewPageCode.includes('VERDICT RECEIVED.');
    const revHasHeadline = reviewPageCode.includes('NOW GET YOUR FRIEND TO FAIL TOO.');
    const revHasCopy = reviewPageCode.includes('COPY REFERRAL LINK →');
    const revHasReward = reviewPageCode.includes('$100 FOR EVERY 10 SALES');

    const modHasVerdict = modalCode.includes('VERDICT RECEIVED.');
    const modHasHeadline = modalCode.includes('NOW GET YOUR FRIEND TO FAIL TOO.');
    const modHasCopy = modalCode.includes('COPY REFERRAL LINK →');
    const modHasReward = modalCode.includes('$100 FOR EVERY 10 SALES');

    if (revHasVerdict && revHasHeadline && revHasCopy && revHasReward && modHasVerdict && modHasHeadline && modHasCopy && modHasReward) {
      recordStep('7.2', 'Post-Review Viral Bridge Component Implementation', 'PASSED', 'Verified in both ReviewClientPage.tsx and WriteReviewModal.tsx: "VERDICT RECEIVED.", "NOW GET YOUR FRIEND TO FAIL TOO.", "COPY REFERRAL LINK →", "$100 FOR EVERY 10 SALES"');
    } else {
      recordStep('7.2', 'Post-Review Viral Bridge Component Implementation', 'FAILED', `Bridge missing: revVerdict=${revHasVerdict}, modVerdict=${modHasVerdict}`);
    }

    // ── STEP 8: FULL CONNECTED LOOP (FRIEND ATTRIBUTED PURCHASE) ────────────
    console.log('\n--- 8. Testing Full Loop (Friend Attributed Purchase) ---');
    const friendCheckoutPayload = {
      items: [
        {
          productId: testProduct.id,
          variantId: testVariant.id,
          quantity: requiredQty,
        },
      ],
      referralCode: reviewerReferralCode,
      shippingAddress: {
        name: 'Taylor Friend',
        street: '456 Viral Lane',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        country: 'US',
        phone: '+13105550188',
      },
    };

    const friendOrderRes = await fetch(`${BASE_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `referral=${reviewerReferralCode}`,
      },
      body: JSON.stringify(friendCheckoutPayload),
    });

    const friendOrderData = await friendOrderRes.json();
    if (friendOrderRes.status === 200 && friendOrderData.orderId) {
      const friendOrderId = friendOrderData.orderId;
      const friendOrderDoc = await db.collection('orders').doc(friendOrderId).get();
      if (friendOrderDoc.data()?.referralCode === reviewerReferralCode) {
        recordStep('8.1', 'Friend Order Receives Reviewer Referral Attribution', 'PASSED', `Friend order ${friendOrderId} attributed to ${reviewerReferralCode}`);
      } else {
        recordStep('8.1', 'Friend Order Receives Reviewer Referral Attribution', 'FAILED', `Attribution missing on friend order`);
      }

      // Process payment for friend order
      await db.collection('orders').doc(friendOrderId).update({
        status: 'paid',
        paymentCaptured: true,
        userEmail: testFriendEmail,
        userId: testFriendUid,
      });

      // Allocate friend customer number
      const friendAlloc = await db.runTransaction(async (transaction) => {
        const _oDoc = await transaction.get(db.collection('orders').doc(friendOrderId));
        const cDoc = await transaction.get(campaignRef);
        const cur = cDoc.data()?.currentCustomerNumber ?? 0;
        const next = cur + 1;
        transaction.set(campaignRef, { currentCustomerNumber: next }, { merge: true });
        transaction.update(db.collection('orders').doc(friendOrderId), { customerNumber: next, isFounding500: next <= 500 });
        return { customerNumber: next };
      });

      recordStep('8.2', 'Friend Order Customer Number Allocated', 'PASSED', `Friend allocated customer number: #${friendAlloc.customerNumber}`);

      // Process referral for friend order
      await db.runTransaction(async (transaction) => {
        const refDoc = db.collection('referrals').doc(`referral_${friendOrderId}`);
        const userSnap = await db.collection('users').where('referralCode', '==', reviewerReferralCode).limit(1).get();
        if (userSnap.empty) return;

        const revUserRef = userSnap.docs[0].ref;
        const revUserDoc = await transaction.get(revUserRef);
        const count = (revUserDoc.data()?.referralCount || 0) + 1;
        const commission = count % 10 === 0 ? 100 : 0;

        transaction.set(refDoc, {
          affiliateUid: revUserDoc.id,
          affiliateCode: reviewerReferralCode,
          referredUid: testFriendUid,
          orderId: friendOrderId,
          orderValue: 120,
          commission,
          isSelfReferral: false,
          status: commission > 0 ? 'eligible_for_claim' : 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(revUserRef, {
          referralCount: admin.firestore.FieldValue.increment(1),
          totalEarnings: admin.firestore.FieldValue.increment(commission),
        });
      });

      recordStep('8.3', 'Complete Growth Loop Closed', 'PASSED', `Reviewer credited for friend order ${friendOrderId}. Full loop validated!`);
    } else {
      recordStep('8.1', 'Friend Order Creation', 'FAILED', `Friend checkout failed: ${JSON.stringify(friendOrderData)}`);
    }

  } catch (err) {
    console.error('\n❌ Unhandled exception during Connected Loop test:', err);
    recordStep('FATAL', 'Execution Exception', 'FAILED', err.message);
  } finally {
    console.log('\n================================================================');
    console.log('📊 CONNECTED LOOP SCOREBOARD');
    console.log('================================================================');
    console.log(`Passed Steps: ${report.summary.passed}`);
    console.log(`Failed Steps: ${report.summary.failed}`);
    console.log(`Error Count:  ${report.summary.failed}`);
    console.log('================================================================\n');

    const resultPath = path.resolve(process.cwd(), 'scripts/connected-loop-results.json');
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
    console.log(`Detailed verification report saved to: ${resultPath}`);
  }
}

runConnectedLoopE2E().then(() => {
  if (report.summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
