/**
 * ==============================================================================
 * GERKINK Phase 11 — Admin Reliability Master Verification Suite
 * ==============================================================================
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. ZERO SIMULATED DATABASE MUTATIONS:
 *    All administrative actions, decisions, and state transitions MUST proceed
 *    through authentic production API endpoints (/api/admin/*) using real
 *    cryptographically signed session cookies.
 * 2. REAL CONCURRENCY & IDEMPOTENCY:
 *    True concurrent Promise.all dispatch against live endpoints to verify
 *    Firestore transactions, state guards, and double-action prevention.
 * 3. STRICT EXIT CODE: If ANY assertion fails, terminates with process.exit(1).
 * ==============================================================================
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Load Environment Variables from .env.local
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
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

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

// Test Execution & Tracking Harness
const results = [];
function record(id, title, status, details) {
  results.push({ id, title, status, details });
  const icon = status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} [${id}] ${title}: ${status} — ${details}`);
}

const cleanupRefs = [];
const cleanupAuthUids = [];

function markForCleanup(ref) {
  if (ref) cleanupRefs.push(ref);
}

// Mint authentic session cookie using Firebase Auth + Google Identity Toolkit
async function getUserSessionCookie(uid, isAdmin = false, emailOverride = null) {
  const userEmail = emailOverride || `${uid}@gerkink-test.internal`;
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({
      uid,
      email: userEmail,
      displayName: `Test User ${uid.slice(-6)}`,
    });
    cleanupAuthUids.push(uid);
  }

  // Set custom claims (admin: true or false)
  await admin.auth().setCustomUserClaims(uid, isAdmin ? { admin: true } : { admin: false });

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

async function runAdminReliabilitySuite() {
  console.log('\n======================================================================');
  console.log('🛡️ GERKINK Phase 11 — Master Admin Reliability Verification Suite');
  console.log('======================================================================\n');

  const runId = `p11_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  console.log(`[Admin Suite] Initializing run ID: ${runId}\n`);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Sessions: Admin and Standard (Non-Admin) Customer
    // -------------------------------------------------------------------------
    console.log('[Setup] Minting authenticated sessions...');
    const adminUid = `admin_${runId}`;
    const customerUid = `cust_${runId}`;

    const adminCookie = await getUserSessionCookie(adminUid, true);
    const customerCookie = await getUserSessionCookie(customerUid, false);
    console.log('[Setup] Admin & Customer session cookies minted successfully.\n');

    // =========================================================================
    // SUITE 1: ADMIN RBAC & ROUTE ACCESS CONTROL MATRIX
    // =========================================================================
    console.log('--- SUITE 1: Admin RBAC & Route Access Control Matrix ---');

    // 1.1 Web UI Routes (Admin layout redirection audit)
    const adminUiRoutes = [
      '/admin',
      '/admin/orders',
      '/admin/payouts',
      '/admin/custom-designs',
      '/admin/products',
      '/admin/coupons',
      '/admin/settings',
      '/admin/reviews',
    ];

    for (const route of adminUiRoutes) {
      // (a) Unauthenticated -> Must redirect to login (HTTP 307)
      const unauthRes = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
      const isRedirectLogin = unauthRes.status === 307 && (unauthRes.headers.get('location') || '').includes('/auth/login');
      if (isRedirectLogin) {
        record(`1.1.unauth.${route}`, `UI Access Control: ${route} (Unauth)`, 'PASSED', `HTTP 307 -> ${unauthRes.headers.get('location')}`);
      } else {
        record(`1.1.unauth.${route}`, `UI Access Control: ${route} (Unauth)`, 'FAILED', `Status: ${unauthRes.status}, Location: ${unauthRes.headers.get('location')}`);
      }

      // (b) Non-Admin Authenticated -> Must reject / redirect to home with error (HTTP 307)
      const nonAdminRes = await fetch(`${BASE_URL}${route}`, {
        headers: { Cookie: `session=${customerCookie}` },
        redirect: 'manual',
      });
      const isRedirectHome = nonAdminRes.status === 307 && (nonAdminRes.headers.get('location') || '').includes('error=unauthorized');
      if (isRedirectHome) {
        record(`1.1.customer.${route}`, `UI Access Control: ${route} (Customer Forbidden)`, 'PASSED', `HTTP 307 -> ${nonAdminRes.headers.get('location')}`);
      } else {
        record(`1.1.customer.${route}`, `UI Access Control: ${route} (Customer Forbidden)`, 'FAILED', `Status: ${nonAdminRes.status}, Location: ${nonAdminRes.headers.get('location')}`);
      }

      // (c) Admin Authenticated -> Must render successfully (HTTP 200)
      const adminRes = await fetch(`${BASE_URL}${route}`, {
        headers: { Cookie: `session=${adminCookie}` },
      });
      if (adminRes.status === 200) {
        record(`1.1.admin.${route}`, `UI Access Control: ${route} (Admin Allowed)`, 'PASSED', 'HTTP 200 OK');
      } else {
        record(`1.1.admin.${route}`, `UI Access Control: ${route} (Admin Allowed)`, 'FAILED', `Status: ${adminRes.status}`);
      }
    }

    // 1.2 Admin API Endpoints Rejection Matrix
    const adminApiEndpoints = [
      { path: '/api/admin/payouts', method: 'GET' },
      { path: '/api/admin/payouts', method: 'POST', body: { requestId: 'dummy', action: 'approve' } },
      { path: '/api/admin/orders/approve-wire', method: 'POST', body: { orderId: 'dummy', action: 'approve' } },
      { path: '/api/admin/orders/retry-printify', method: 'POST', body: { orderId: 'dummy' } },
      { path: '/api/admin/custom-designs/req_dummy/status', method: 'POST', body: { status: 'in_review' } },
      { path: '/api/admin/products', method: 'GET' },
      { path: '/api/admin/coupons', method: 'GET' },
      { path: '/api/admin/settings', method: 'POST', body: { tickerRoasts: ['test'] } },
      { path: '/api/reviews', method: 'PATCH', body: { reviewId: 'dummy', action: 'approve' } },
    ];

    for (const ep of adminApiEndpoints) {
      // (a) Unauthenticated Call
      const unauthApiRes = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      // Endpoints return either 401 or 403 when no auth is provided
      if (unauthApiRes.status === 401 || unauthApiRes.status === 403) {
        record(`1.2.unauth.${ep.path}`, `API Auth Boundary: ${ep.method} ${ep.path}`, 'PASSED', `HTTP ${unauthApiRes.status} Blocked`);
      } else {
        record(`1.2.unauth.${ep.path}`, `API Auth Boundary: ${ep.method} ${ep.path}`, 'FAILED', `Expected 401/403, got HTTP ${unauthApiRes.status}`);
      }

      // (b) Non-Admin Customer Call -> Must return 401 or 403 Forbidden
      const nonAdminApiRes = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${customerCookie}`,
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      if (nonAdminApiRes.status === 401 || nonAdminApiRes.status === 403) {
        record(`1.2.customer.${ep.path}`, `API RBAC Boundary: ${ep.method} ${ep.path}`, 'PASSED', `HTTP ${nonAdminApiRes.status} Forbidden`);
      } else {
        record(`1.2.customer.${ep.path}`, `API RBAC Boundary: ${ep.method} ${ep.path}`, 'FAILED', `Expected 401/403, got HTTP ${nonAdminApiRes.status}`);
      }
    }

    // =========================================================================
    // SUITE 2: PAYOUT RELIABILITY & ACID BALANCE RESTORATION
    // =========================================================================
    console.log('\n--- SUITE 2: Payout Reliability & ACID Balance Restoration ---');

    // 2.1 Retrieve Payouts Queue with Index Fallback
    const getPayoutsRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      headers: { Cookie: `session=${adminCookie}` },
    });
    if (getPayoutsRes.ok) {
      const payoutsData = await getPayoutsRes.json();
      const hasQueues = Array.isArray(payoutsData.pending) && Array.isArray(payoutsData.processed);
      if (hasQueues) {
        record('2.1.queue_retrieval', 'Admin Payouts Queue Retrieval', 'PASSED', `HTTP 200 (pending: ${payoutsData.pending.length}, processed: ${payoutsData.processed.length})`);
      } else {
        record('2.1.queue_retrieval', 'Admin Payouts Queue Retrieval', 'FAILED', 'Invalid response format');
      }
    } else {
      record('2.1.queue_retrieval', 'Admin Payouts Queue Retrieval', 'FAILED', `HTTP ${getPayoutsRes.status}`);
    }

    // 2.2 Create Test Payout Request linked to Referral Document
    const payoutReqId1 = `payout_test_${runId}_1`;
    const referralId1 = `ref_test_${runId}_1`;
    const affiliateUid = `affiliate_${runId}`;

    const referralRef1 = db.collection('referrals').doc(referralId1);
    await referralRef1.set({
      affiliateUid,
      status: 'claimed',
      payoutMethod: 'bank',
      payoutDetail: payoutReqId1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    markForCleanup(referralRef1);

    const payoutRef1 = db.collection('payout_requests').doc(payoutReqId1);
    await payoutRef1.set({
      userId: affiliateUid,
      userEmail: `${affiliateUid}@gerkink-test.internal`,
      userName: 'Test Affiliate',
      amount: 100,
      method: 'bank',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    markForCleanup(payoutRef1);

    // 2.3 Admin Rejection Action -> Verify Atomic Referral Balance Restoration
    const rejectRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        requestId: payoutReqId1,
        action: 'reject',
        adminNote: 'Bank routing code mismatch. Please update and re-claim.',
      }),
    });

    if (rejectRes.ok) {
      await rejectRes.json();
      const payoutDocAfterReject = (await payoutRef1.get()).data();
      const refDocAfterReject = (await referralRef1.get()).data();

      const isPayoutRejected = payoutDocAfterReject.status === 'rejected' &&
        payoutDocAfterReject.rejectedBy === adminUid &&
        payoutDocAfterReject.rejectedAt !== undefined;

      const isBalanceRestored = refDocAfterReject.status === 'eligible_for_claim' &&
        refDocAfterReject.payoutMethod === undefined &&
        refDocAfterReject.payoutDetail === undefined;

      if (isPayoutRejected && isBalanceRestored) {
        record('2.2.payout_rejection_restore', 'Atomic Payout Rejection & Balance Restoration', 'PASSED', 'Payout marked rejected & linked referral restored to eligible_for_claim');
      } else {
        record('2.2.payout_rejection_restore', 'Atomic Payout Rejection & Balance Restoration', 'FAILED', `Payout: ${payoutDocAfterReject?.status}, Referral: ${refDocAfterReject?.status}`);
      }
    } else {
      const errText = await rejectRes.text();
      record('2.2.payout_rejection_restore', 'Atomic Payout Rejection & Balance Restoration', 'FAILED', `HTTP ${rejectRes.status} — ${errText}`);
    }

    // 2.4 Double-Processing Guard (Idempotency / State Guard on Rejected Payout)
    const duplicateApproveRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        requestId: payoutReqId1,
        action: 'approve',
      }),
    });
    if (duplicateApproveRes.status === 409) {
      record('2.3.payout_double_action_guard', 'Payout State Transition Conflict Guard', 'PASSED', 'HTTP 409 Conflict: Already processed');
    } else {
      record('2.3.payout_double_action_guard', 'Payout State Transition Conflict Guard', 'FAILED', `Expected HTTP 409, got HTTP ${duplicateApproveRes.status}`);
    }

    // 2.5 Admin Approval Action on Fresh Payout
    const payoutReqId2 = `payout_test_${runId}_2`;
    const payoutRef2 = db.collection('payout_requests').doc(payoutReqId2);
    await payoutRef2.set({
      userId: affiliateUid,
      userEmail: `${affiliateUid}@gerkink-test.internal`,
      userName: 'Test Affiliate',
      amount: 200,
      method: 'paypal',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    markForCleanup(payoutRef2);

    const approveRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        requestId: payoutReqId2,
        action: 'approve',
        adminNote: 'Wire dispatched via Treasury desk.',
      }),
    });

    if (approveRes.ok) {
      const payoutDocAfterApprove = (await payoutRef2.get()).data();
      const isApproved = payoutDocAfterApprove.status === 'paid_manual' &&
        payoutDocAfterApprove.paidBy === adminUid &&
        payoutDocAfterApprove.paidAt !== undefined;

      if (isApproved) {
        record('2.4.payout_approval', 'Atomic Payout Approval', 'PASSED', 'Status transitioned to paid_manual with paidBy and paidAt timestamps');
      } else {
        record('2.4.payout_approval', 'Atomic Payout Approval', 'FAILED', `Status: ${payoutDocAfterApprove?.status}`);
      }
    } else {
      record('2.4.payout_approval', 'Atomic Payout Approval', 'FAILED', `HTTP ${approveRes.status}`);
    }

    // =========================================================================
    // SUITE 3: CONCURRENCY & IDEMPOTENCY STRESS TESTING
    // =========================================================================
    console.log('\n--- SUITE 3: Concurrency & Idempotency Stress Testing ---');

    // 3.1 Concurrent Payout Decisions Race (5 Simultaneous Actions on Single Payout)
    const payoutReqId3 = `payout_test_${runId}_concurrency`;
    const payoutRef3 = db.collection('payout_requests').doc(payoutReqId3);
    await payoutRef3.set({
      userId: affiliateUid,
      userEmail: `${affiliateUid}@gerkink-test.internal`,
      userName: 'Concurrent Affiliate',
      amount: 500,
      method: 'wire',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    markForCleanup(payoutRef3);

    console.log('  Firing 5 concurrent approval requests at single pending payout...');
    const concurrentPayoutPromises = Array.from({ length: 5 }).map(() =>
      fetch(`${BASE_URL}/api/admin/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${adminCookie}`,
        },
        body: JSON.stringify({
          requestId: payoutReqId3,
          action: 'approve',
          adminNote: 'Concurrent batch approval test',
        }),
      })
    );

    const payoutResponses = await Promise.all(concurrentPayoutPromises);
    const payoutSuccessCount = payoutResponses.filter((r) => r.status === 200).length;
    const payoutConflictCount = payoutResponses.filter((r) => r.status === 409).length;

    if (payoutSuccessCount === 1 && payoutConflictCount === 4) {
      record('3.1.payout_concurrency_race', 'Payout Decision ACID Concurrency Guard', 'PASSED', 'Exactly 1 request succeeded (HTTP 200); 4 rejected with HTTP 409 Conflict');
    } else {
      record('3.1.payout_concurrency_race', 'Payout Decision ACID Concurrency Guard', 'FAILED', `Successes: ${payoutSuccessCount}, Conflicts: ${payoutConflictCount}`);
    }

    // 3.2 Concurrent Wire Prebooking Approvals (5 Simultaneous Approvals on Single Order)
    const orderIdConcurrency = `order_test_${runId}_wire_concurrency`;
    const orderRefConcurrency = db.collection('orders').doc(orderIdConcurrency);
    await orderRefConcurrency.set({
      userId: customerUid,
      userEmail: `${customerUid}@gerkink-test.internal`,
      isPrebooking: true,
      tier: 4,
      status: 'awaiting_wire_confirmation',
      total: 10000,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    markForCleanup(orderRefConcurrency);

    console.log('  Firing 5 concurrent wire approval requests on single prebooking order...');
    const concurrentWirePromises = Array.from({ length: 5 }).map(() =>
      fetch(`${BASE_URL}/api/admin/orders/approve-wire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${adminCookie}`,
        },
        body: JSON.stringify({
          orderId: orderIdConcurrency,
          action: 'approve',
          adminNote: 'Concurrency wire verification',
        }),
      })
    );

    const wireResponses = await Promise.all(concurrentWirePromises);
    const wireJsonResults = await Promise.all(wireResponses.map((r) => r.json()));

    const winnerCount = wireJsonResults.filter((j) => j.success === true && !j.idempotent).length;
    const idempotentCount = wireJsonResults.filter((j) => j.success === true && j.idempotent === true).length;
    const finalOrderDoc = (await orderRefConcurrency.get()).data();

    if (winnerCount === 1 && idempotentCount === 4 && finalOrderDoc.status === 'paid' && finalOrderDoc.paymentCaptured === true) {
      record('3.2.wire_concurrency_race', 'Wire Approval Transactional Concurrency & Idempotency', 'PASSED', 'Exactly 1 transition won; 4 returned handled idempotent states without duplicate processing');
    } else {
      record('3.2.wire_concurrency_race', 'Wire Approval Transactional Concurrency & Idempotency', 'FAILED', `Winner: ${winnerCount}, Idempotent: ${idempotentCount}, Status: ${finalOrderDoc?.status}`);
    }

    // =========================================================================
    // SUITE 4: CUSTOM DESIGN FINITE STATE MACHINE (FSM) VALIDATION
    // =========================================================================
    console.log('\n--- SUITE 4: Custom Design Finite State Machine (FSM) Validation ---');

    const customDesignReqId = `cd_test_${runId}`;
    const cdRef = db.collection('customDesignRequests').doc(customDesignReqId);
    await cdRef.set({
      userId: customerUid,
      userEmail: `${customerUid}@gerkink-test.internal`,
      status: 'SUBMITTED',
      ideaDescription: 'Oversized distressed hoodie with heavy embroidery',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [
        {
          from: '',
          to: 'SUBMITTED',
          actor: 'user',
          actorId: customerUid,
          timestamp: new Date().toISOString(),
          reason: 'Initial creation',
        },
      ],
    });
    markForCleanup(cdRef);

    // 4.1 Invalid State Skip -> Attempt SUBMITTED -> IN_PRODUCTION (Must return HTTP 400)
    const invalidTransitionRes = await fetch(`${BASE_URL}/api/admin/custom-designs/${customDesignReqId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        status: 'IN_PRODUCTION',
        reason: 'Illegal state skip directly to production',
      }),
    });

    if (invalidTransitionRes.status === 400) {
      const errJson = await invalidTransitionRes.json();
      record('4.1.fsm_invalid_transition_block', 'Custom Design FSM Invalid Transition Rejection', 'PASSED', `HTTP 400: ${errJson.error}`);
    } else {
      record('4.1.fsm_invalid_transition_block', 'Custom Design FSM Invalid Transition Rejection', 'FAILED', `Expected HTTP 400, got HTTP ${invalidTransitionRes.status}`);
    }

    // 4.2 Valid Transition -> SUBMITTED -> UNDER_REVIEW
    const validStep1Res = await fetch(`${BASE_URL}/api/admin/custom-designs/${customDesignReqId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        adminNotes: 'Artisan workshop assigned to inspect concept.',
      }),
    });

    if (validStep1Res.ok) {
      const cdDoc = (await cdRef.get()).data();
      const hasHistory = cdDoc.status === 'UNDER_REVIEW' && cdDoc.statusHistory?.length === 2;
      if (hasHistory) {
        record('4.2.fsm_valid_step1', 'Custom Design Transition: SUBMITTED -> UNDER_REVIEW', 'PASSED', 'Status updated and statusHistory entry appended');
      } else {
        record('4.2.fsm_valid_step1', 'Custom Design Transition: SUBMITTED -> UNDER_REVIEW', 'FAILED', `Status: ${cdDoc?.status}, History length: ${cdDoc?.statusHistory?.length}`);
      }
    } else {
      record('4.2.fsm_valid_step1', 'Custom Design Transition: SUBMITTED -> UNDER_REVIEW', 'FAILED', `HTTP ${validStep1Res.status}`);
    }

    // 4.3 Valid Transition -> UNDER_REVIEW -> DESIGN_IN_PROGRESS with finalPrice
    const validStep2Res = await fetch(`${BASE_URL}/api/admin/custom-designs/${customDesignReqId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({
        status: 'DESIGN_IN_PROGRESS',
        finalPrice: 650,
        adminNotes: 'Bespoke pattern approved. Official quote: $650.',
      }),
    });

    if (validStep2Res.ok) {
      const cdDoc = (await cdRef.get()).data();
      const isQuoted = cdDoc.status === 'DESIGN_IN_PROGRESS' && cdDoc.finalPrice === 650 && cdDoc.statusHistory?.length === 3;
      if (isQuoted) {
        record('4.3.fsm_valid_step2_pricing', 'Custom Design Transition: UNDER_REVIEW -> DESIGN_IN_PROGRESS', 'PASSED', 'Status updated to DESIGN_IN_PROGRESS with finalPrice = $650');
      } else {
        record('4.3.fsm_valid_step2_pricing', 'Custom Design Transition: UNDER_REVIEW -> DESIGN_IN_PROGRESS', 'FAILED', `Status: ${cdDoc?.status}, Price: ${cdDoc?.finalPrice}`);
      }
    } else {
      record('4.3.fsm_valid_step2_pricing', 'Custom Design Transition: UNDER_REVIEW -> DESIGN_IN_PROGRESS', 'FAILED', `HTTP ${validStep2Res.status}`);
    }

    // =========================================================================
    // SUITE 5: DATABASE RESILIENCE & INPUT VALIDATION
    // =========================================================================
    console.log('\n--- SUITE 5: Database Resilience & Input Validation ---');

    // 5.1 Malformed JSON Bodies
    const malformedJsonRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: 'this is not valid json {{{',
    });
    if (malformedJsonRes.status === 400) {
      record('5.1.malformed_json', 'Malformed JSON Input Validation', 'PASSED', 'HTTP 400 Bad Request');
    } else {
      record('5.1.malformed_json', 'Malformed JSON Input Validation', 'FAILED', `Expected 400, got ${malformedJsonRes.status}`);
    }

    // 5.2 Missing Required Fields
    const missingFieldsRes = await fetch(`${BASE_URL}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({ action: 'approve' }), // missing requestId
    });
    if (missingFieldsRes.status === 400) {
      record('5.2.missing_fields_validation', 'Zod Schema Validation for Missing Fields', 'PASSED', 'HTTP 400 Bad Request');
    } else {
      record('5.2.missing_fields_validation', 'Zod Schema Validation for Missing Fields', 'FAILED', `Expected 400, got ${missingFieldsRes.status}`);
    }

    // 5.3 Non-Existent Document Lookup
    const notFoundRes = await fetch(`${BASE_URL}/api/admin/orders/approve-wire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminCookie}`,
      },
      body: JSON.stringify({ orderId: 'non_existent_order_id_xyz', action: 'approve' }),
    });
    if (notFoundRes.status === 404) {
      record('5.3.doc_not_found_handling', 'Non-Existent Document Graceful 404 Handling', 'PASSED', 'HTTP 404 Not Found');
    } else {
      record('5.3.doc_not_found_handling', 'Non-Existent Document Graceful 404 Handling', 'FAILED', `Expected 404, got ${notFoundRes.status}`);
    }

  } finally {
    // =========================================================================
    // CLEANUP: Automated Database State Restoration
    // =========================================================================
    console.log('\n--- Automated Cleanup Phase ---');
    for (const ref of cleanupRefs) {
      try {
        await ref.delete();
      } catch (err) {
        console.warn('Cleanup error for doc ref:', err?.message);
      }
    }
    for (const uid of cleanupAuthUids) {
      try {
        await admin.auth().deleteUser(uid);
      } catch (err) {
        console.warn('Cleanup error for auth uid:', err?.message);
      }
    }
    console.log(`[Cleanup] Deleted ${cleanupRefs.length} test Firestore docs & ${cleanupAuthUids.length} test Auth users.\n`);
  }

  // Final Summary & Exit
  console.log('======================================================================');
  console.log('  PHASE 11 AUDIT SUMMARY');
  console.log('======================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  const total = results.length;

  console.log(`  Total Assertions : ${total}`);
  console.log(`  Passed           : ${passed} ✅`);
  console.log(`  Failed           : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Success Rate     : ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.error('❌ PHASE 11 AUDIT FAILED — One or more assertions did not meet criteria.');
    process.exit(1);
  } else {
    console.log('✅ ALL PHASE 11 ADMIN RELIABILITY INVARIANTS CERTIFIED 100% PASS!');
    process.exit(0);
  }
}

runAdminReliabilitySuite().catch((err) => {
  console.error('FATAL SUITE EXECUTION ERROR:', err);
  process.exit(1);
});
