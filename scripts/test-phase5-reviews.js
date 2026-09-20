/**
 * GERKINK Phase 5 — Reviews System Integrity Verification Suite
 *
 * Strict Production Standards:
 * - 0 Simulated Firestore Mutations.
 * - Live HTTP endpoints against local server with real Firebase session authentication.
 * - Real Firestore ACID transactions.
 * - Exhaustive cleanup in finally blocks.
 * - Non-zero exit code on any assertion failure.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

// 0. Environment Setup
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
  testSuite: 'GERKINK Phase 5 — Reviews System Integrity',
  verdict: 'PENDING',
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

function generateTestReviewToken(orderId, productId, email) {
  const secret = process.env.ENCRYPTION_KEY || process.env.FIREBASE_PRIVATE_KEY || 'gerkink-review-secret-salt-2026';
  const payload = {
    orderId: orderId.trim(),
    productId: productId.trim(),
    email: email.trim().toLowerCase(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

async function createTestSession(uid, email, isAdmin = false) {
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({ uid, email, displayName: isAdmin ? 'Studio Admin' : 'Test Customer' });
  }

  await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });
  const customToken = await admin.auth().createCustomToken(uid, { admin: isAdmin });

  const idTokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!idTokenRes.ok) {
    throw new Error(`Failed to exchange custom token: ${idTokenRes.status}`);
  }
  const { idToken } = await idTokenRes.json();

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!sessionRes.ok) {
    throw new Error(`Failed to create session cookie: ${sessionRes.status}`);
  }

  const setCookieHeader = sessionRes.headers.get('set-cookie');
  if (!setCookieHeader) throw new Error('No Set-Cookie header received from /api/auth/session');
  const match = setCookieHeader.match(/session=([^;]+)/);
  if (!match) throw new Error('Could not parse session cookie');

  return { uid, email, cookie: `session=${match[1]}` };
}

async function runPhase5Suite() {
  console.log('\n===============================================================');
  console.log('  STARTING GERKINK PHASE 5 — REVIEWS SYSTEM INTEGRITY SUITE');
  console.log('===============================================================\n');

  const customerUid = `phase5_cust_${Date.now()}`;
  const customerEmail = `${customerUid}@gerkink.test`;

  const attackerUid = `phase5_attacker_${Date.now()}`;
  const attackerEmail = `${attackerUid}@gerkink.test`;

  const adminUid = `phase5_admin_${Date.now()}`;
  const adminEmail = `${adminUid}@gerkink.test`;

  const testProductId = `prod_test_p5_${Date.now()}`;
  const testOrderId = `order_test_p5_${Date.now()}`;
  const refundedOrderId = `order_refunded_p5_${Date.now()}`;

  const createdReviewIds = [];
  const createdOrderIds = [];
  const createdAuthUids = [customerUid, attackerUid, adminUid];

  try {
    // 0. Setup authentication sessions
    console.log('[Setup] Creating customer, attacker, and admin test sessions...');
    const customer = await createTestSession(customerUid, customerEmail, false);
    const attacker = await createTestSession(attackerUid, attackerEmail, false);
    const adminUser = await createTestSession(adminUid, adminEmail, true);

    // Seed test orders in Firestore
    console.log('[Setup] Seeding valid delivered order and refunded order in Firestore...');
    const validOrderRef = db.collection('orders').doc(testOrderId);
    await validOrderRef.set({
      id: testOrderId,
      orderNumber: `GK-TEST-${Date.now().toString().slice(-4)}`,
      userId: customerUid,
      customerEmail: customerEmail,
      status: 'delivered',
      paymentStatus: 'completed',
      paymentCaptured: true,
      items: [
        {
          productId: testProductId,
          productTitle: 'Heavyweight Signature Hoodie',
          quantity: 1,
          price: 180,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    createdOrderIds.push(testOrderId);

    const refundedOrderRef = db.collection('orders').doc(refundedOrderId);
    await refundedOrderRef.set({
      id: refundedOrderId,
      orderNumber: `GK-REF-${Date.now().toString().slice(-4)}`,
      userId: customerUid,
      customerEmail: customerEmail,
      status: 'refunded',
      refundStatus: 'refunded',
      paymentStatus: 'completed',
      items: [
        {
          productId: testProductId,
          productTitle: 'Heavyweight Signature Hoodie',
          quantity: 1,
          price: 180,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    createdOrderIds.push(refundedOrderId);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.1: Verified Purchase Qualification via HMAC Review Token
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.1: Verified Purchase Qualification via HMAC Review Token ---');
    const validToken = generateTestReviewToken(testOrderId, testProductId, customerEmail);

    const postVerifiedRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: testProductId,
        productTitle: 'Heavyweight Signature Hoodie',
        reviewToken: validToken,
        rating: 5,
        title: 'Unreal Quality & Heavy Drape',
        text: 'The 240GSM weight is legit. Best streetwear hoodie I own.',
        fit: 'true_to_size',
        marketingConsent: true,
      }),
    });

    const verifiedData = await postVerifiedRes.json();
    if (postVerifiedRes.ok && verifiedData.success && verifiedData.verifiedPurchase === true && verifiedData.status === 'approved') {
      createdReviewIds.push(verifiedData.id);
      recordTest(
        'TEST-5.1',
        'Verified Purchase Qualification (HMAC Token)',
        'PASSED',
        `Review ${verifiedData.id} verified with token: verifiedPurchase=true, status=approved`
      );
    } else {
      recordTest(
        'TEST-5.1',
        'Verified Purchase Qualification (HMAC Token)',
        'FAILED',
        `Expected verifiedPurchase=true & status=approved, got: ${JSON.stringify(verifiedData)}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.2: Unverified Purchase Defaults to Pending
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.2: Unverified Review Defaults to Pending ---');
    const postUnverifiedRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: testProductId,
        productTitle: 'Heavyweight Signature Hoodie',
        rating: 4,
        title: 'Cool aesthetic from photos',
        text: 'Has anyone tested the shrinkage after 5 washes? Looks fire.',
        fit: 'true_to_size',
      }),
    });

    const unverifiedData = await postUnverifiedRes.json();
    if (postUnverifiedRes.ok && unverifiedData.success && unverifiedData.verifiedPurchase === false && unverifiedData.status === 'pending') {
      createdReviewIds.push(unverifiedData.id);
      recordTest(
        'TEST-5.2',
        'Unverified Review Moderation Holding',
        'PASSED',
        `Unverified review ${unverifiedData.id} marked verifiedPurchase=false, status=pending`
      );
    } else {
      recordTest(
        'TEST-5.2',
        'Unverified Review Moderation Holding',
        'FAILED',
        `Expected verifiedPurchase=false & status=pending, got: ${JSON.stringify(unverifiedData)}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.3: Refunded/Cancelled Order Cannot Qualify as Verified Purchase
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.3: Refunded Order Excluded from Verified Purchase ---');
    const refundedToken = generateTestReviewToken(refundedOrderId, testProductId, customerEmail);

    const postRefundedRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: testProductId,
        productTitle: 'Heavyweight Signature Hoodie',
        reviewToken: refundedToken,
        rating: 1,
        title: 'Order was refunded',
        text: 'Trying to claim verified purchase on a cancelled order.',
        fit: 'runs_small',
      }),
    });

    const refundedData = await postRefundedRes.json();
    // Must NOT be verified because order status is 'refunded'
    if (postRefundedRes.ok && refundedData.success && refundedData.verifiedPurchase === false) {
      createdReviewIds.push(refundedData.id);
      recordTest(
        'TEST-5.3',
        'Refunded Order Disqualification',
        'PASSED',
        `Refunded order review ${refundedData.id} rejected verified status: verifiedPurchase=false`
      );
    } else {
      recordTest(
        'TEST-5.3',
        'Refunded Order Disqualification',
        'FAILED',
        `Refunded order was improperly granted verified purchase: ${JSON.stringify(refundedData)}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.4: IDOR Protection on Anonymous & User Reviews
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.4: IDOR Protection on Anonymous and Other User Reviews ---');
    // 1. Attacker attempts to modify unverified/anonymous review
    const idorAnonymousRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: attacker.cookie,
      },
      body: JSON.stringify({
        reviewId: unverifiedData.id,
        productId: testProductId,
        rating: 1,
        title: 'HACKED TITLE',
        text: 'This review was hijacked by unauthorized user.',
      }),
    });

    // 2. Attacker attempts without any cookies
    const idorNoAuthRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewId: unverifiedData.id,
        productId: testProductId,
        rating: 1,
        title: 'HACKED ANONYMOUS',
        text: 'Hijacked with no session',
      }),
    });

    if (idorAnonymousRes.status === 403 && idorNoAuthRes.status === 403) {
      recordTest(
        'TEST-5.4',
        'IDOR Protection on Reviews',
        'PASSED',
        'Both authenticated cross-user and unauthenticated edit attempts blocked with 403 Forbidden'
      );
    } else {
      recordTest(
        'TEST-5.4',
        'IDOR Protection on Reviews',
        'FAILED',
        `Expected 403 Forbidden, got attacker=${idorAnonymousRes.status}, noauth=${idorNoAuthRes.status}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.5: Public Data Exposure Scrubbing
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.5: Public Data Exposure Scrubbing ---');
    const publicGetRes = await fetch(`${BASE_URL}/api/reviews?productId=${testProductId}`);
    const publicGetData = await publicGetRes.json();

    let leakFound = false;
    let leakDetails = '';

    if (Array.isArray(publicGetData.reviews)) {
      for (const rev of publicGetData.reviews) {
        if (rev.orderId !== undefined) {
          leakFound = true;
          leakDetails = `orderId leaked: ${rev.orderId}`;
          break;
        }
        if (rev.userId !== undefined) {
          leakFound = true;
          leakDetails = `userId leaked: ${rev.userId}`;
          break;
        }
        if (rev.reportCount !== undefined) {
          leakFound = true;
          leakDetails = `reportCount leaked: ${rev.reportCount}`;
          break;
        }
        if (rev.marketingConsent !== undefined) {
          leakFound = true;
          leakDetails = `marketingConsent leaked: ${rev.marketingConsent}`;
          break;
        }
      }
    }

    if (!leakFound && publicGetData.reviews?.length > 0) {
      recordTest(
        'TEST-5.5',
        'Public API Data Exposure Scrubbing',
        'PASSED',
        'Public DTO successfully scrubbed orderId, userId, reportCount, and marketingConsent'
      );
    } else {
      recordTest(
        'TEST-5.5',
        'Public API Data Exposure Scrubbing',
        'FAILED',
        leakFound ? leakDetails : 'No reviews returned to test'
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.6: Admin API Full Audit Data Preservation & Auth Protection
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.6: Admin API Security & Audit Data Preservation ---');
    // 1. Unauthenticated request to admin endpoint
    const unauthAdminRes = await fetch(`${BASE_URL}/api/reviews?admin=true`);
    // 2. Customer (non-admin) request to admin endpoint
    const customerAdminRes = await fetch(`${BASE_URL}/api/reviews?admin=true`, {
      headers: { Cookie: customer.cookie },
    });
    // 3. True admin request
    const validAdminRes = await fetch(`${BASE_URL}/api/reviews?admin=true`, {
      headers: { Cookie: adminUser.cookie },
    });
    const validAdminData = await validAdminRes.json();

    const hasAuditFields = Array.isArray(validAdminData.reviews) &&
      validAdminData.reviews.some((r) => r.orderId || r.userId || r.status);

    if (unauthAdminRes.status === 403 && customerAdminRes.status === 403 && validAdminRes.ok && hasAuditFields) {
      recordTest(
        'TEST-5.6',
        'Admin API Auth & Audit Field Preservation',
        'PASSED',
        'Unauth/Customer blocked with 403; Admin receives full audit records with orderId/userId/status'
      );
    } else {
      recordTest(
        'TEST-5.6',
        'Admin API Auth & Audit Field Preservation',
        'FAILED',
        `unauth=${unauthAdminRes.status}, cust=${customerAdminRes.status}, adminOk=${validAdminRes.ok}, hasAudit=${hasAuditFields}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.7: Voting Deduplication (Duplicate Voter Returns 409 Conflict)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.7: Voting Deduplication & Anti-Fraud ---');
    const targetReviewId = verifiedData.id;

    // First upvote from customer
    const firstVoteRes = await fetch(`${BASE_URL}/api/reviews/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer.cookie,
      },
      body: JSON.stringify({ reviewId: targetReviewId, vote: 'up' }),
    });
    const firstVoteData = await firstVoteRes.json();

    // Duplicate upvote from same customer
    const dupVoteRes = await fetch(`${BASE_URL}/api/reviews/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customer.cookie,
      },
      body: JSON.stringify({ reviewId: targetReviewId, vote: 'up' }),
    });

    if (firstVoteRes.ok && firstVoteData.success && dupVoteRes.status === 409) {
      recordTest(
        'TEST-5.7',
        'Vote Deduplication & Anti-Fraud',
        'PASSED',
        'First vote succeeded (200 OK); duplicate vote from same identity rejected with 409 Conflict'
      );
    } else {
      recordTest(
        'TEST-5.7',
        'Vote Deduplication & Anti-Fraud',
        'FAILED',
        `First vote=${firstVoteRes.status}, Dup vote=${dupVoteRes.status} (expected 409)`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.8: Auto-Moderation on 5+ Reports (Flag and Unpublish)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.8: Auto-Moderation on Report Threshold ---');
    // Create an approved review specifically for testing report threshold
    const reportTargetDoc = await db.collection('reviews').add({
      productId: testProductId,
      productTitle: 'Heavyweight Signature Hoodie',
      userId: 'test_user_report',
      userName: 'Report Target',
      rating: 3,
      title: 'Review to be reported',
      text: 'This review contains questionable content and will be reported 5 times.',
      status: 'approved',
      approved: true,
      helpfulCount: 0,
      reportCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    createdReviewIds.push(reportTargetDoc.id);

    // Send 5 reports with distinct IP headers
    let fifthReportFlagged = false;
    for (let i = 1; i <= 5; i++) {
      const reportRes = await fetch(`${BASE_URL}/api/reviews/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `198.51.100.${10 + i}`,
          'user-agent': `TestReportBot/${i}.0`,
        },
        body: JSON.stringify({ reviewId: reportTargetDoc.id, vote: 'report' }),
      });
      const repJson = await reportRes.json();
      if (i === 5 && repJson.flagged === true) {
        fifthReportFlagged = true;
      }
    }

    // Verify in Firestore that status is 'flagged' and approved is false
    const reportedDocSnap = await reportTargetDoc.get();
    const reportedDocData = reportedDocSnap.data();

    // Query public API to ensure the flagged review is NOT shown
    const publicAfterReportRes = await fetch(`${BASE_URL}/api/reviews?productId=${testProductId}`);
    const publicAfterReportData = await publicAfterReportRes.json();
    const isPresentInPublic = Array.isArray(publicAfterReportData.reviews) &&
      publicAfterReportData.reviews.some((r) => r.id === reportTargetDoc.id);

    if (fifthReportFlagged && reportedDocData.status === 'flagged' && reportedDocData.approved === false && !isPresentInPublic) {
      recordTest(
        'TEST-5.8',
        'Auto-Moderation on 5+ Reports',
        'PASSED',
        'Review auto-flagged on 5th report, status=flagged, approved=false, immediately hidden from public API'
      );
    } else {
      recordTest(
        'TEST-5.8',
        'Auto-Moderation on 5+ Reports',
        'FAILED',
        `fifthFlagged=${fifthReportFlagged}, dbStatus=${reportedDocData?.status}, dbApproved=${reportedDocData?.approved}, inPublic=${isPresentInPublic}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.9: Media Upload Authentication with Review Token
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.9: Media Upload Authentication via Review Token ---');
    // Build multipart form data for test upload
    const boundary = '----WebKitFormBoundaryPhase5Test';
    const fakeImageContent = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="lookbook.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeImageContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    // 1. Upload without any session or token -> 401 Unauthorized
    const unauthUploadRes = await fetch(`${BASE_URL}/api/reviews/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    // 2. Upload with valid review token
    const tokenUploadRes = await fetch(`${BASE_URL}/api/reviews/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'x-review-token': validToken,
      },
      body: multipartBody,
    });
    const tokenUploadData = await tokenUploadRes.json();

    if (unauthUploadRes.status === 401 && tokenUploadRes.ok && tokenUploadData.success) {
      recordTest(
        'TEST-5.9',
        'Media Upload Auth via Review Token',
        'PASSED',
        'Unauthenticated upload rejected (401); verified review-token upload succeeded (200 OK)'
      );
    } else {
      recordTest(
        'TEST-5.9',
        'Media Upload Auth via Review Token',
        'FAILED',
        `unauthStatus=${unauthUploadRes.status}, tokenUploadOk=${tokenUploadRes.ok}, resp=${JSON.stringify(tokenUploadData)}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.10: Admin Moderation Actions & Staff Replies
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.10: Admin Moderation Lifecycle (Approve, Reject, Flag, Reply, Delete) ---');
    // 1. Admin adds staff reply
    const replyRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminUser.cookie,
      },
      body: JSON.stringify({
        reviewId: verifiedData.id,
        action: 'reply',
        replyText: 'Thank you for rocking GERKINK! More heavyweight drops coming soon.',
      }),
    });
    const replyData = await replyRes.json();

    // Verify reply in Firestore
    const repliedDocSnap = await db.collection('reviews').doc(verifiedData.id).get();
    const repliedData = repliedDocSnap.data();

    // 2. Admin rejects unverified review
    const rejectRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminUser.cookie,
      },
      body: JSON.stringify({
        reviewId: unverifiedData.id,
        action: 'reject',
      }),
    });

    const rejectedDocSnap = await db.collection('reviews').doc(unverifiedData.id).get();
    const rejectedDocData = rejectedDocSnap.data();

    if (
      replyRes.ok &&
      replyData.success &&
      repliedData?.officialReply?.text?.includes('Thank you for rocking GERKINK') &&
      rejectRes.ok &&
      rejectedDocData?.status === 'rejected'
    ) {
      recordTest(
        'TEST-5.10',
        'Admin Moderation Actions & Staff Replies',
        'PASSED',
        'Admin successfully posted official staff reply and updated review status to rejected'
      );
    } else {
      recordTest(
        'TEST-5.10',
        'Admin Moderation Actions & Staff Replies',
        'FAILED',
        `replyOk=${replyRes.ok}, replyText=${repliedData?.officialReply?.text}, rejectOk=${rejectRes.ok}, rejectedStatus=${rejectedDocData?.status}`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5.11: Review Aggregation Accuracy & Statistical Precision
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Finding 5.11: Review Aggregation Accuracy ---');
    // Create an additional 5-star and 4-star approved review
    const extraRev1 = await db.collection('reviews').add({
      productId: testProductId,
      productTitle: 'Heavyweight Signature Hoodie',
      userId: 'test_agg_1',
      rating: 5,
      title: 'Perfection',
      text: 'Great piece',
      fit: 'true_to_size',
      status: 'approved',
      approved: true,
      verifiedPurchase: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    createdReviewIds.push(extraRev1.id);

    const extraRev2 = await db.collection('reviews').add({
      productId: testProductId,
      productTitle: 'Heavyweight Signature Hoodie',
      userId: 'test_agg_2',
      rating: 4,
      title: 'Very Good',
      text: 'Slightly oversized',
      fit: 'runs_large',
      status: 'approved',
      approved: true,
      verifiedPurchase: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    createdReviewIds.push(extraRev2.id);

    const aggRes = await fetch(`${BASE_URL}/api/reviews?productId=${testProductId}`);
    const aggData = await aggRes.json();
    const summary = aggData.summary;

    // We have:
    // 1. verifiedData: rating 5, verifiedPurchase true, fit true_to_size
    // 2. extraRev1: rating 5, verifiedPurchase true, fit true_to_size
    // 3. extraRev2: rating 4, verifiedPurchase false, fit runs_large
    // Total approved reviews: 3
    // Sum of ratings: 5 + 5 + 4 = 14 / 3 = 4.67 (or rounded ~4.7)
    // 5-star count: 2, 4-star count: 1
    // Verified count: 2
    // Fit true_to_size: 2, runs_large: 1

    const isTotalCorrect = summary?.totalReviews === 3;
    const isVerifiedCorrect = summary?.verifiedReviewsCount === 2;
    const isDistributionCorrect = summary?.ratingDistribution?.[5] === 2 && summary?.ratingDistribution?.[4] === 1;
    const isFitCorrect = summary?.fitDistribution?.true_to_size === 2 && summary?.fitDistribution?.runs_large === 1;
    const isAverageCorrect = Math.abs((summary?.averageRating || 0) - 4.7) <= 0.1;

    if (isTotalCorrect && isVerifiedCorrect && isDistributionCorrect && isFitCorrect && isAverageCorrect) {
      recordTest(
        'TEST-5.11',
        'Review Aggregation Accuracy',
        'PASSED',
        `totalReviews=3, verifiedCount=2, averageRating=${summary.averageRating}, fitDistribution accurate`
      );
    } else {
      recordTest(
        'TEST-5.11',
        'Review Aggregation Accuracy',
        'FAILED',
        `total=${summary?.totalReviews} (exp 3), verified=${summary?.verifiedReviewsCount} (exp 2), avg=${summary?.averageRating} (exp 4.7), ratingDist=${JSON.stringify(summary?.ratingDistribution)}`
      );
    }
  } catch (err) {
    console.error('\n[FATAL ERROR in Phase 5 Suite]:', err);
    recordTest('FATAL', 'Phase 5 Execution Failure', 'FAILED', err.message || String(err));
  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // TEARDOWN & CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Teardown & Database Cleanup ---');
    console.log(`Cleaning up ${createdReviewIds.length} test reviews...`);
    for (const rid of createdReviewIds) {
      try {
        // Delete votes subcollection if any
        const votesSnap = await db.collection('reviews').doc(rid).collection('votes').get();
        for (const vDoc of votesSnap.docs) {
          await vDoc.ref.delete();
        }
        await db.collection('reviews').doc(rid).delete();
      } catch (err) {
        console.warn(`Failed to delete test review ${rid}:`, err.message);
      }
    }

    console.log(`Cleaning up ${createdOrderIds.length} test orders...`);
    for (const oid of createdOrderIds) {
      try {
        await db.collection('orders').doc(oid).delete();
      } catch (err) {
        console.warn(`Failed to delete test order ${oid}:`, err.message);
      }
    }

    console.log(`Cleaning up ${createdAuthUids.length} test Firebase auth accounts...`);
    for (const uid of createdAuthUids) {
      try {
        await admin.auth().deleteUser(uid);
      } catch {
        // non-fatal
      }
    }

    console.log('\n===============================================================');
    console.log(`  PHASE 5 TEST RESULTS: ${report.passed} / ${report.total} PASSED`);
    console.log('===============================================================\n');

    report.verdict = report.failed === 0 && report.passed > 0 ? 'PASS' : 'FAIL';

    // Non-zero exit code if any test failed
    if (report.failed > 0 || report.passed === 0) {
      console.error(`❌ Phase 5 Suite FAILED with ${report.failed} failure(s).`);
      process.exit(1);
    } else {
      console.log('🎉 ALL PHASE 5 TESTS PASSED SUCCESSFULLY.');
      process.exit(0);
    }
  }
}

runPhase5Suite();
