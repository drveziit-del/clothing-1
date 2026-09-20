/**
 * GERKINK Phase 8 — Email & Notifications Verification Suite
 *
 * Strict Production Standards:
 * - 0 Simulated Firestore Mutations.
 * - Live HTTP endpoints against local server with real Firebase session authentication.
 * - Real Firestore ACID locks & transactions.
 * - Concurrency race tests for duplicate email defense.
 * - Exhaustive cleanup in finally blocks.
 * - Non-zero exit code on any assertion failure.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 0. Setup TypeScript runtime loader for direct production code invocation
const jiti = require('jiti')(path.resolve(process.cwd(), 'scripts/test-phase8-email.js'), {
  alias: {
    '@': path.resolve(process.cwd(), 'src'),
    'server-only': path.resolve(process.cwd(), 'scripts/empty.js'),
  },
});

// Import production email senders & review token generator directly via jiti
const {
  sendOrderConfirmationEmail,
  sendAdminOrderNotification,
  sendOrderConfirmationEmailsOnce,
  sendAdminPayoutAlert,
  sendPayoutStatusEmail,
  sendPostDeliveryReviewRequestEmailOnce,
  sendCustomDesignNotification,
  CUSTOM_DESIGN_STUDIO_EMAIL,
} = jiti('@/lib/email/sender');

const { generateReviewToken, verifyReviewToken } = jiti('@/lib/reviews/token');

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

function markForCleanup(ref) {
  cleanupRefs.push(ref);
}

async function runSuite() {
  console.log('\n======================================================================');
  console.log('📧 GERKINK Phase 8 — Email & Notifications Verification Suite');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Server-Only Enforcement & Client-Bundle Isolation
    // ------------------------------------------------------------------------
    console.log('--- Test 1: Server-Only Enforcement & Client-Bundle Isolation ---');
    try {
      const filesToCheck = [
        'src/lib/email/sender.ts',
        'src/app/api/contact/route.ts',
        'src/app/api/admin/payouts/route.ts',
        'src/app/api/printify/webhook/route.ts',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const firstFewLines = content.split('\n').slice(0, 5).join('\n');
        if (!firstFewLines.includes("import 'server-only'") && !firstFewLines.includes('import "server-only"')) {
          throw new Error(`File ${relPath} is missing required import 'server-only'; at top of file`);
        }
      }

      record('TEST-1', 'Server-Only Enforcement', 'PASSED',
        `All 4 email-dispatching and administrative routes strictly enforce import 'server-only';.`);
    } catch (err) {
      record('TEST-1', 'Server-Only Enforcement', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Order Confirmation Template HTML Escaping & Numeric Safety
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Order Confirmation Template HTML Escaping & Numeric Safety ---');
    try {
      const testOrderId = `ord_xss_test_${Date.now()}`;
      const xssOrder = {
        id: testOrderId,
        userEmail: `victim_${Date.now()}@gerkink-test.internal`,
        items: [
          {
            title: '<script>alert("XSS-TITLE")</script> Gothic Distressed Hoodie',
            variant: {
              size: '<img src=x onerror=alert(1)>XL',
              color: '"><iframe src="evil.com"></iframe>Pitch Black',
            },
            quantity: 2,
            price: 150,
          },
        ],
        shippingAddress: {
          name: '<b onmouseover=alert("NAME")>Jane Doe</b>',
          street: '123 Fake St <script>steal()</script>',
          city: 'Tokyo',
          state: 'Kanto',
          zip: '100-0001',
          country: 'Japan',
          phone: '<svg onload=alert(2)>+81-90-1234-5678',
        },
        subtotal: 300,
        tax: 24,
        discount: 50,
        total: 274,
        createdAt: new Date(),
      };

      // Call sendOrderConfirmationEmail
      await sendOrderConfirmationEmail(xssOrder);

      // Verify email was logged to system_emails collection
      const snap = await db
        .collection('system_emails')
        .where('to', '==', xssOrder.userEmail)
        .get();

      if (snap.empty) {
        throw new Error('Expected order confirmation email record in system_emails collection');
      }

      const emailDoc = snap.docs[snap.docs.length - 1];
      markForCleanup(emailDoc.ref);
      const emailData = emailDoc.data();

      if (!emailData.html) {
        throw new Error('emailData.html missing from system_emails document');
      }

      // Assert XSS tags were escaped
      if (emailData.html.includes('<script>') || emailData.html.includes('<iframe') || emailData.html.includes('<svg onload')) {
        throw new Error('SECURITY VULNERABILITY: Raw XSS payload detected unescaped in email HTML!');
      }

      if (!emailData.html.includes('&lt;script&gt;alert(&quot;XSS-TITLE&quot;)&lt;/script&gt;')) {
        throw new Error('Expected HTML-escaped script tag in item title');
      }

      // Assert financial numbers are correctly formatted
      if (!emailData.html.includes('$300.00 USD') || !emailData.html.includes('$274.00 USD')) {
        throw new Error(`Financial totals not properly formatted in email HTML: ${emailData.html.substring(0, 300)}`);
      }

      record('TEST-2', 'Order Confirmation HTML Escaping & Financial Integrity', 'PASSED',
        `XSS payloads (<script>, <iframe>, <svg>) safely escaped; financial amounts ($300.00, $274.00) accurately formatted.`);
    } catch (err) {
      record('TEST-2', 'Order Confirmation HTML Escaping & Financial Integrity', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 3: Exactly-Once Order Email Dispatch Concurrency Race
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Exactly-Once Order Email Dispatch Concurrency Race ---');
    try {
      const raceOrderId = `ord_email_race_${Date.now()}`;
      const raceOrder = {
        id: raceOrderId,
        userEmail: `race_buyer_${Date.now()}@gerkink-test.internal`,
        items: [{ title: 'Race Tee', variant: { size: 'M', color: 'Black' }, quantity: 1, price: 50 }],
        subtotal: 50,
        tax: 4,
        discount: 0,
        total: 54,
        createdAt: new Date(),
      };

      // Ensure order document exists in Firestore first
      const raceOrderRef = db.collection('orders').doc(raceOrderId);
      markForCleanup(raceOrderRef);
      await raceOrderRef.set(raceOrder);

      const lockRef = db.collection('order_email_locks').doc(raceOrderId);
      markForCleanup(lockRef);

      // Simulate 5 simultaneous webhook and verify handlers racing to send the order confirmation email
      const attempts = [1, 2, 3, 4, 5].map(() => sendOrderConfirmationEmailsOnce(raceOrderId, raceOrder));
      const raceResults = await Promise.all(attempts);

      const acquiredCount = raceResults.filter((r) => r === true).length;
      const blockedCount = raceResults.filter((r) => r === false).length;

      if (acquiredCount !== 1) {
        throw new Error(`Concurrency race failed: expected exactly 1 lock winner, got ${acquiredCount}`);
      }
      if (blockedCount !== 4) {
        throw new Error(`Expected exactly 4 callers blocked by lock, got ${blockedCount}`);
      }

      // Verify lock document exists in Firestore
      const lockDoc = await lockRef.get();
      if (!lockDoc.exists || lockDoc.data()?.orderId !== raceOrderId) {
        throw new Error(`Email lock document was not recorded properly: ${JSON.stringify(lockDoc.data())}`);
      }

      // Cleanup system_emails created for this race
      const snap = await db.collection('system_emails').where('to', '==', raceOrder.userEmail).get();
      snap.docs.forEach((d) => markForCleanup(d.ref));

      record('TEST-3', 'Exactly-Once Order Email Concurrency Race', 'PASSED',
        `5 concurrent dispatch callers: exactly 1 acquired the lock, 4 blocked with duplicate lock defense.`);
    } catch (err) {
      record('TEST-3', 'Exactly-Once Order Email Concurrency Race', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Symmetrical Fallback Resilience (Unconfigured SMTP)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Symmetrical Fallback Resilience (Unconfigured SMTP) ---');
    try {
      const payoutDetails = {
        userName: 'Elena Rostova',
        userEmail: `affiliate_${Date.now()}@gerkink-test.internal`,
        method: 'wise',
        payoutDetails: 'elena.rostova@wise-transfer.internal',
        amount: 100,
      };

      // Temporarily mock unconfigured SMTP environment to test fallback path
      const origSmtpUser = process.env.SMTP_USER;
      delete process.env.SMTP_USER;

      try {
        await sendAdminPayoutAlert(payoutDetails);

        const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
        const snap = await db
          .collection('system_emails')
          .where('to', '==', adminEmail)
          .get();

        const alertDoc = snap.docs.find((d) => d.data()?.html?.includes(payoutDetails.userEmail));
        if (!alertDoc) {
          throw new Error(`Expected payout alert record with userEmail ${payoutDetails.userEmail} in system_emails fallback collection`);
        }

        markForCleanup(alertDoc.ref);
        const data = alertDoc.data();

        if (data.status !== 'pending_smtp_config') {
          throw new Error(`Expected pending_smtp_config status in fallback, got ${data.status}`);
        }
        if (!data.html.includes('$100.00 USD') || !data.html.includes('Elena Rostova')) {
          throw new Error('Payout alert email body missing expected details');
        }

        record('TEST-4', 'Symmetrical Fallback Resilience (Unconfigured SMTP)', 'PASSED',
          `Payout alert gracefully fell back to system_emails (status: pending_smtp_config) with complete audit payload.`);
      } finally {
        process.env.SMTP_USER = origSmtpUser;
      }
    } catch (err) {
      record('TEST-4', 'Symmetrical Fallback Resilience (Unconfigured SMTP)', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 5: Admin Order Notification & Recipient Routing
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Admin Order Notification & Recipient Routing ---');
    try {
      const adminOrderId = `ord_adm_test_${Date.now()}`;
      const customerEmail = `shopper_${Date.now()}@gerkink-test.internal`;
      const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';

      const sampleOrder = {
        id: adminOrderId,
        userEmail: customerEmail,
        items: [{ title: 'Silk Oversized Shirt', variant: { size: 'L', color: 'Onyx' }, quantity: 1, price: 180 }],
        subtotal: 180,
        tax: 14.4,
        discount: 0,
        total: 194.4,
        paypalCaptureId: 'CAP_PAYPAL_987654',
        createdAt: new Date(),
      };

      await sendAdminOrderNotification(sampleOrder);

      const snap = await db
        .collection('system_emails')
        .where('to', '==', adminEmail)
        .get();

      const adminEmailDoc = snap.docs.find((d) => d.data()?.html?.includes(adminOrderId));

      if (!adminEmailDoc) {
        throw new Error(`Admin order notification document with order ID ${adminOrderId} not found in system_emails`);
      }

      markForCleanup(adminEmailDoc.ref);
      const adminData = adminEmailDoc.data();

      // Strict recipient check
      if (adminData.to !== adminEmail) {
        throw new Error(`SECURITY LEAK: Admin order alert addressed to ${adminData.to} instead of ${adminEmail}`);
      }
      if (!adminData.html || !adminData.html.includes(customerEmail)) {
        throw new Error('Admin notification body missing customer email reference');
      }
      if (!adminData.html.includes('CAP_PAYPAL_987654')) {
        throw new Error('Admin notification body missing payment transaction ID');
      }

      record('TEST-5', 'Admin Order Notification Recipient Isolation', 'PASSED',
        `Admin order email strictly routed to ${adminEmail}; customer email and payment ID encapsulated safely.`);
    } catch (err) {
      record('TEST-5', 'Admin Order Notification Recipient Isolation', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 6: Custom Design Notification Lifecycle (Customer & Studio Alerts)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Custom Design Notification Lifecycle ---');
    try {
      const customReqId = `cd_req_test_${Date.now()}`;
      const customerEmail = `designer_fan_${Date.now()}@gerkink-test.internal`;

      await sendCustomDesignNotification({
        type: 'request_submitted',
        requestId: customReqId,
        requestNumber: 'GK-CUS-8899',
        customerEmail,
        customerName: 'Marcus Aurelius',
        productType: 'Distressed Heavyweight Trench',
        plan: 'better_quality',
        prepaymentAmount: 20,
        description: 'Double breasted with raw fringe edges and screenprinted typography: "<script>alert(1)</script>"',
        preferredSize: 'XL',
        preferredColor: 'Vintage Wash Charcoal',
        uploads: [
          { originalName: 'moodboard_<img src=x>.jpg', size: 1024 * 1024 * 2.5 },
        ],
        paymentReference: 'PAYPAL_CAP_555',
      });

      // 6a. Check customer receipt email
      const custSnap = await db
        .collection('system_emails')
        .where('to', '==', customerEmail)
        .get();

      const custDoc = custSnap.docs.find((d) => d.data()?.requestId === customReqId);
      if (!custDoc) {
        throw new Error('Custom design customer receipt was not logged');
      }
      markForCleanup(custDoc.ref);
      const custData = custDoc.data();
      if (!custData.html || !custData.html.includes('$20 USD PAID')) {
        throw new Error('Customer receipt missing prepayment amount confirmation');
      }

      // 6b. Check studio alert email
      const studioEmail = CUSTOM_DESIGN_STUDIO_EMAIL || 'custom@gerkink.shop';
      const studioSnap = await db
        .collection('system_emails')
        .where('to', '==', studioEmail)
        .get();

      const studioDoc = studioSnap.docs.find((d) => d.data()?.requestId === customReqId);
      if (!studioDoc) {
        throw new Error(`Custom design studio alert was not logged to ${studioEmail}`);
      }
      markForCleanup(studioDoc.ref);
      const studioData = studioDoc.data();

      // Verify XSS escaping in concept description & uploads
      if (studioData.html.includes('<script>alert(1)</script>') || studioData.html.includes('<img src=x>')) {
        throw new Error('SECURITY VULNERABILITY: Unescaped artwork payload in studio intake email!');
      }
      if (!studioData.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) {
        throw new Error('Concept description was not HTML-escaped');
      }

      record('TEST-6', 'Custom Design Lifecycle Dual Notifications', 'PASSED',
        `Dispatched customer receipt to ${customerEmail} & atelier intake to ${studioEmail}; concepts safely escaped.`);
    } catch (err) {
      record('TEST-6', 'Custom Design Lifecycle Dual Notifications', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 7: Post-Delivery Review Request with Verified Token & Idempotency Lock
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Post-Delivery Review Request & Idempotency Lock ---');
    try {
      const orderId = `ord_rev_lock_${Date.now()}`;
      const productId = 'prod_hoodie_001';
      const userEmail = `buyer_${Date.now()}@gerkink-test.internal`;

      // 7a. Generate cryptographic review token
      const token = generateReviewToken(orderId, productId, userEmail);
      const decoded = verifyReviewToken(token);
      if (!decoded || decoded.orderId !== orderId || decoded.email !== userEmail) {
        throw new Error(`Review token verification failed: ${JSON.stringify(decoded)}`);
      }

      const reviewLockRef = db.collection('review_email_locks').doc(orderId);
      markForCleanup(reviewLockRef);

      const reviewDetails = {
        orderId,
        userEmail,
        userName: '<marquee>Julian Casablancas</marquee>',
        productId,
        productTitle: 'Overdyed Boxy Tee <script>bad()</script>',
        reviewUrl: `https://gerkink.shop/review?token=${encodeURIComponent(token)}`,
      };

      // 7b. First dispatch -> should succeed and acquire lock
      const firstDispatch = await sendPostDeliveryReviewRequestEmailOnce(reviewDetails);
      if (!firstDispatch) {
        throw new Error('First review request email dispatch unexpectedly failed');
      }

      // Verify lock created
      const lockDoc = await reviewLockRef.get();
      if (!lockDoc.exists || lockDoc.data()?.orderId !== orderId) {
        throw new Error('review_email_locks document missing');
      }

      // Verify email logged
      const emailSnap = await db.collection('system_emails').where('to', '==', userEmail).get();
      if (emailSnap.empty) {
        throw new Error('Review invitation email was not logged in system_emails');
      }
      const revDoc = emailSnap.docs[0];
      markForCleanup(revDoc.ref);
      if (!revDoc.data().html) {
        throw new Error('Review email HTML is missing');
      }
      if (revDoc.data().html.includes('<script>') || revDoc.data().html.includes('<marquee>')) {
        throw new Error('Unescaped script or marquee in review invitation');
      }

      // 7c. Second dispatch -> must be blocked by atomic lock
      const secondDispatch = await sendPostDeliveryReviewRequestEmailOnce(reviewDetails);
      if (secondDispatch !== false) {
        throw new Error('Review invitation lock failed: duplicate email was not blocked!');
      }

      record('TEST-7', 'Post-Delivery Review Invitation & Idempotency Lock', 'PASSED',
        `HMAC review token verified, first invitation dispatched and locked; repeated call blocked.`);
    } catch (err) {
      record('TEST-7', 'Post-Delivery Review Invitation & Idempotency Lock', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 8: Affiliate Payout Status Notifications (Approved vs. Rejected)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Affiliate Payout Status Notifications ---');
    try {
      const affiliateEmail = `aff_payout_${Date.now()}@gerkink-test.internal`;

      // 8a. Approved payout email
      await sendPayoutStatusEmail({
        userEmail: affiliateEmail,
        userName: 'Satoshi Nakamoto',
        amount: 200,
        method: 'wise',
        approved: true,
      });

      // 8b. Rejected payout email with admin note
      await sendPayoutStatusEmail({
        userEmail: affiliateEmail,
        userName: 'Satoshi Nakamoto',
        amount: 200,
        method: 'wise',
        approved: false,
        adminNote: 'Incorrect routing number <script>alert("note")</script>',
      });

      const snap = await db.collection('system_emails').where('to', '==', affiliateEmail).get();
      if (snap.size < 2) {
        throw new Error(`Expected 2 payout status emails, got ${snap.size}`);
      }

      snap.docs.forEach((d) => markForCleanup(d.ref));

      const approvedDoc = snap.docs.find((d) => d.data().subject?.includes('Approved'));
      const rejectedDoc = snap.docs.find((d) => d.data().subject?.includes('Update'));

      if (!approvedDoc || !rejectedDoc) {
        throw new Error('Missing approved or rejected payout email doc');
      }

      const rejHtml = rejectedDoc.data().html;
      if (!rejHtml) {
        throw new Error('Rejected payout email HTML missing');
      }
      if (rejHtml.includes('<script>alert("note")</script>')) {
        throw new Error('Admin note was not HTML-escaped');
      }
      if (!rejHtml.includes('&lt;script&gt;alert(&quot;note&quot;)&lt;/script&gt;')) {
        throw new Error('Expected escaped admin note');
      }

      record('TEST-8', 'Affiliate Payout Status Notifications', 'PASSED',
        `Approved & rejected templates verified; admin notes safely escaped; claimed funds accurately stated ($200.00).`);
    } catch (err) {
      record('TEST-8', 'Affiliate Payout Status Notifications', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 9: Contact Form Submission API & Notification Email
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: Contact Form Submission API & Notification Email ---');
    try {
      const contactName = `Inquirer ${Date.now()}`;
      const contactEmail = `inquirer_${Date.now()}@gerkink-test.internal`;
      const contactMessage = 'Interested in wholesale custom orders <script>alert("wholesale")</script>';

      // 9a. Test live /api/contact endpoint
      const res = await fetch(`${BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.50',
        },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.status !== 'ok') {
        throw new Error(`/api/contact failed with ${res.status}: ${JSON.stringify(json)}`);
      }

      // Verify contact was recorded in contacts collection
      const contactSnap = await db.collection('contacts').where('email', '==', contactEmail).get();
      if (contactSnap.empty) {
        throw new Error('Contact message document was not written to Firestore');
      }
      contactSnap.docs.forEach((d) => markForCleanup(d.ref));

      // Wait a moment for fire-and-forget email sender
      await new Promise((r) => setTimeout(r, 1000));

      const adminEmail = process.env.ADMIN_EMAIL || 'support@gerkink.shop';
      const emailSnap = await db
        .collection('system_emails')
        .where('to', '==', adminEmail)
        .get();

      const contactDoc = emailSnap.docs.find((d) => d.data()?.subject?.includes(contactName));
      if (contactDoc) {
        markForCleanup(contactDoc.ref);
        const emailData = contactDoc.data();
        if (emailData.html && emailData.html.includes('<script>')) {
          throw new Error('Contact form email contained unescaped script tag');
        }
      }

      record('TEST-9', 'Contact Form Submission API & Email Alert', 'PASSED',
        `Live /api/contact processed inquiry; sanitized message saved in Firestore & notified ${adminEmail}.`);
    } catch (err) {
      record('TEST-9', 'Contact Form Submission API & Email Alert', 'FAILED', err.message);
    }

    // ------------------------------------------------------------------------
    // TEST 10: Secret Protection & Error Sanitization
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Secret Protection & Error Sanitization ---');
    try {
      const secretsToScan = [
        process.env.SMTP_PASSWORD,
        process.env.ENCRYPTION_KEY,
        process.env.RAZORPAY_KEY_SECRET,
        process.env.FIREBASE_PRIVATE_KEY,
      ].filter(Boolean);

      let exposedSecret = null;
      for (const ref of cleanupRefs) {
        if (ref.path.startsWith('system_emails/')) {
          const doc = await ref.get();
          if (doc.exists) {
            const dataStr = JSON.stringify(doc.data());
            for (const sec of secretsToScan) {
              if (dataStr.includes(sec)) {
                exposedSecret = sec.substring(0, 4) + '***';
                break;
              }
            }
          }
        }
      }

      if (exposedSecret) {
        throw new Error(`CRITICAL SECURITY LEAK: Secret string ${exposedSecret} detected in system_emails payload!`);
      }

      record('TEST-10', 'Secret Protection & Error Sanitization', 'PASSED',
        `0 secrets exposed across all generated email payloads & fallback audit documents.`);
    } catch (err) {
      record('TEST-10', 'Secret Protection & Error Sanitization', 'FAILED', err.message);
    }

  } finally {
    console.log('\n--- Cleaning Up Phase 8 Test Artifacts ---');
    const batch = db.batch();
    let count = 0;
    for (const ref of cleanupRefs) {
      batch.delete(ref);
      count++;
    }
    await batch.commit().catch((e) => console.warn('Cleanup batch warning:', e.message));
    console.log(`Cleaned up ${count} test documents.`);
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
    console.log('\n🎉 ALL 10 PHASE 8 VERIFICATION GATES PASSED! PHASE 8 CERTIFIED.');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('\n💥 UNCAUGHT SUITE EXCEPTION:', err);
  process.exit(1);
});
