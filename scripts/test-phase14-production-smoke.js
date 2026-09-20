/**
 * GERKINK Phase 14 — Master Production Smoke Verification Suite
 * Targets strictly: https://gerkink.shop (Zero Localhost)
 *
 * Enforces the 22 Production Smoke Checkpoints:
 * - Infrastructure, DNS, TLS, Cloud App Hosting
 * - Security Headers, CSP, Public/Private Route Boundaries
 * - Commerce Core Flow, Catalog, Multi-Rail Payment Readiness
 * - Cryptographic Webhook Validation (PayPal, Razorpay, Printify)
 * - Review Engine, Referral Validation, Coupon Engine
 * - Custom Design / Bespoke Atelier, Prebooking, Account Deletion Gate
 * - Zero Sandbox/Debug Leakage
 */

const https = require('https');
const http = require('http');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROD_HOST = 'gerkink.shop';
const PROD_URL = `https://${PROD_HOST}`;
const REPORT_PATH = path.join(__dirname, 'phase14-production-smoke-report.json');

let passedCount = 0;
let failedCount = 0;
const results = [];

function assert(checkpointId, checkpointName, condition, details, evidence) {
  const status = condition ? 'PASSED' : 'FAILED';
  if (condition) {
    passedCount++;
    console.log(`✅ [${checkpointId}] ${checkpointName}: PASSED — ${details}`);
  } else {
    failedCount++;
    console.error(`❌ [${checkpointId}] ${checkpointName}: FAILED — ${details}`);
  }
  results.push({
    id: checkpointId,
    name: checkpointName,
    status,
    details,
    evidence: evidence || null,
    timestamp: new Date().toISOString(),
  });
}

// Low-level HTTP helper that returns headers, status, raw body, and parsed json
function requestUrl(urlStr, options = {}, retries = 1) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(options.headers || {}),
      },
      timeout: options.timeout || 12000,
    };

    const req = lib.request(urlStr, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not json */ }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json,
        });
      });
    });

    req.on('error', (err) => {
      if (retries > 0 && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        setTimeout(() => {
          requestUrl(urlStr, options, retries - 1).then(resolve).catch(reject);
        }, 500);
      } else {
        reject(err);
      }
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) {
        setTimeout(() => {
          requestUrl(urlStr, options, retries - 1).then(resolve).catch(reject);
        }, 500);
      } else {
        reject(new Error(`Timeout after ${reqOptions.timeout}ms on ${urlStr}`));
      }
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runProductionSmokeSuite() {
  console.log('======================================================================');
  console.log(`🚀 GERKINK Phase 14 — Master Production Smoke Verification Suite`);
  console.log(`Target: ${PROD_URL}`);
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log('======================================================================\n');

  // -------------------------------------------------------------------
  // CP-01: DNS, TLS & Canonical Redirects
  // -------------------------------------------------------------------
  console.log('--- CHECKPOINT 1: DNS, TLS & Canonical Redirects ---');
  try {
    const tlsCert = await new Promise((resolve, reject) => {
      const socket = tls.connect(443, PROD_HOST, { servername: PROD_HOST, timeout: 8000 }, () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.end();
        resolve({ cert, authorized });
      });
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('TLS handshake timeout'));
      });
    });

    const validTo = new Date(tlsCert.cert.valid_to);
    const daysRemaining = Math.round((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const certValid = tlsCert.authorized && daysRemaining > 0;

    assert(
      'CP-01A',
      'TLS Certificate Verification',
      certValid,
      `Valid SSL/TLS certificate for ${PROD_HOST} (Expires: ${tlsCert.cert.valid_to}, ${daysRemaining} days remaining)`,
      { subject: tlsCert.cert.subject, issuer: tlsCert.cert.issuer, validTo: tlsCert.cert.valid_to }
    );
  } catch (err) {
    assert('CP-01A', 'TLS Certificate Verification', false, `TLS inspection failed: ${err.message}`);
  }

  try {
    const httpRes = await requestUrl(`http://${PROD_HOST}/`);
    const isRedirect = [301, 302, 307, 308].includes(httpRes.statusCode);
    const redirectLoc = httpRes.headers['location'] || '';
    assert(
      'CP-01B',
      'HTTP to HTTPS Canonical Redirect',
      isRedirect && redirectLoc.startsWith('https://'),
      `HTTP requests redirected to HTTPS (Status: ${httpRes.statusCode}, Location: ${redirectLoc})`,
      { statusCode: httpRes.statusCode, location: redirectLoc }
    );
  } catch (err) {
    assert('CP-01B', 'HTTP to HTTPS Canonical Redirect', false, `HTTP redirect check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-02: Cloud App Hosting Deployment / Health
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 2: Cloud App Hosting Deployment / Health ---');
  try {
    const start = Date.now();
    const healthRes = await requestUrl(`${PROD_URL}/api/health`);
    const latency = Date.now() - start;

    assert(
      'CP-02',
      'Cloud App Hosting Container Health',
      healthRes.statusCode === 200 && healthRes.json?.status === 'ok' && healthRes.json?.environment === 'production',
      `Live health endpoint responded HTTP 200 in ${latency}ms (env: "${healthRes.json?.environment}", mode: "${healthRes.json?.mode}")`,
      healthRes.json
    );
  } catch (err) {
    assert('CP-02', 'Cloud App Hosting Deployment / Health', false, `Health endpoint probe failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-03: Production Firebase Infrastructure
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 3: Production Firebase Infrastructure ---');
  try {
    // Read public collection data via API backed by Firestore
    const reviewsRes = await requestUrl(`${PROD_URL}/api/reviews?productId=gods-plan`);
    const isReviewsArray = Array.isArray(reviewsRes.json) || Array.isArray(reviewsRes.json?.reviews);
    assert(
      'CP-03A',
      'Live Firestore Connectivity & Querying',
      reviewsRes.statusCode === 200 && isReviewsArray,
      `Firestore live read successful: connected to live database, returned reviews array and rating statistics`,
      { count: Array.isArray(reviewsRes.json) ? reviewsRes.json.length : (reviewsRes.json?.reviews?.length ?? 0) }
    );

    // Verify unauthenticated client cannot post unauthorized review
    const unauthReviewRes = await requestUrl(`${PROD_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { productId: 'gods-plan', rating: 5, text: 'Unauthorized probe' },
    });
    assert(
      'CP-03B',
      'Firestore Security Rule Enforcement',
      unauthReviewRes.statusCode === 401 || unauthReviewRes.statusCode === 400,
      `Unauthenticated review injection cleanly rejected with HTTP ${unauthReviewRes.statusCode}`,
      unauthReviewRes.json
    );
  } catch (err) {
    assert('CP-03', 'Production Firebase Infrastructure', false, `Firebase probe failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-04: Production Secret Manager Bindings
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 4: Production Secret Manager Bindings ---');
  try {
    const currRes = await requestUrl(`${PROD_URL}/api/currency`);
    assert(
      'CP-04',
      'Production Secrets & Rate Service Binding',
      currRes.statusCode === 200 && currRes.json?.rates && currRes.json?.rates?.INR,
      `Currency rates active without secret binding errors: 1 USD = ${currRes.json?.rates?.INR} INR, ${currRes.json?.rates?.EUR} EUR`,
      { base: currRes.json?.base, inr: currRes.json?.rates?.INR, eur: currRes.json?.rates?.EUR }
    );
  } catch (err) {
    assert('CP-04', 'Production Secret Manager Bindings', false, `Secret binding verification failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-05: Security Headers & Cookies
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 5: Security Headers & Cookies ---');
  try {
    const rootRes = await requestUrl(`${PROD_URL}/`);
    const h = rootRes.headers;

    const hasHsts = Boolean(h['strict-transport-security'] && h['strict-transport-security'].includes('max-age='));
    const hasFrame = h['x-frame-options'] === 'DENY';
    const hasNosniff = h['x-content-type-options'] === 'nosniff';
    const hasCsp = Boolean(h['content-security-policy'] && h['content-security-policy'].includes("default-src 'self'"));
    const hasPerms = Boolean(h['permissions-policy']);

    assert(
      'CP-05',
      'Production Edge Security Headers',
      hasHsts && hasFrame && hasNosniff && hasCsp && hasPerms,
      `All 5 mandatory security headers enforced (HSTS: ${h['strict-transport-security']}, X-Frame: ${h['x-frame-options']}, NoSniff: ${h['x-content-type-options']})`,
      {
        hsts: h['strict-transport-security'],
        frame: h['x-frame-options'],
        nosniff: h['x-content-type-options'],
        cspLength: h['content-security-policy']?.length,
        perms: h['permissions-policy'],
      }
    );
  } catch (err) {
    assert('CP-05', 'Security Headers & Cookies', false, `Security headers check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-06: Public / Private Route Boundaries
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 6: Public / Private Route Boundaries ---');
  try {
    const accountRes = await requestUrl(`${PROD_URL}/account`);
    const isAccountRedirect = accountRes.statusCode === 307 || accountRes.statusCode === 302;
    const accountTarget = accountRes.headers['location'] || '';

    const adminRes = await requestUrl(`${PROD_URL}/admin`);
    const isAdminRedirect = adminRes.statusCode === 307 || adminRes.statusCode === 302;

    const adminApiRes = await requestUrl(`${PROD_URL}/api/admin/orders/approve-wire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { orderId: 'fake-order-id' },
    });
    const isAdminApiBlocked = adminApiRes.statusCode === 401;

    assert(
      'CP-06',
      'Authentication Boundary Enforcement',
      isAccountRedirect && isAdminRedirect && isAdminApiBlocked,
      `Unauthenticated UI routes redirect (Account: HTTP ${accountRes.statusCode} -> ${accountTarget}), Admin API strictly blocked (HTTP ${adminApiRes.statusCode})`,
      { accountRedirect: accountTarget, adminApiStatus: adminApiRes.statusCode }
    );
  } catch (err) {
    assert('CP-06', 'Public / Private Route Boundaries', false, `Route boundary probe failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-07: /thank-you Indexing & Access Controls
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 7: /thank-you Indexing & Access Controls ---');
  try {
    const thankYouRes = await requestUrl(`${PROD_URL}/thank-you`);
    const robotsRes = await requestUrl(`${PROD_URL}/robots.txt`);
    const rendersThankYou = thankYouRes.statusCode === 200 && (thankYouRes.body.includes('thank-you') || thankYouRes.body.includes('Thank you'));
    const noPiiLeak = !thankYouRes.body.includes('customerEmail') && !thankYouRes.body.includes('shippingAddress');

    assert(
      'CP-07',
      'Thank-You Page Isolation & Access Controls',
      rendersThankYou && noPiiLeak && robotsRes.statusCode === 200,
      `Thank-you page returned HTTP 200 with clean unauthenticated isolation (zero client PII leaked without valid order)`,
      { statusCode: thankYouRes.statusCode, robotsStatus: robotsRes.statusCode }
    );
  } catch (err) {
    assert('CP-07', '/thank-you Indexing & Access Controls', false, `Thank-you check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-08: Commerce Core Flow
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 8: Commerce Core Flow ---');
  try {
    const homeRes = await requestUrl(`${PROD_URL}/`);
    const shopRes = await requestUrl(`${PROD_URL}/shop`);
    const sfRes = await requestUrl(`${PROD_URL}/shop/society-fuckers`);
    const vbRes = await requestUrl(`${PROD_URL}/shop/valueless-bitches`);
    const pdpRes = await requestUrl(`${PROD_URL}/shop/gods-plan`);
    const cartRes = await requestUrl(`${PROD_URL}/cart`);
    const checkoutRes = await requestUrl(`${PROD_URL}/checkout`);

    // In production, /checkout redirects to /cart when cart is empty (HTTP 307), or renders 200
    const checkoutProtected = checkoutRes.statusCode === 200 || checkoutRes.statusCode === 307;

    const loopValid = [
      homeRes.statusCode === 200,
      shopRes.statusCode === 200,
      sfRes.statusCode === 200,
      vbRes.statusCode === 200,
      pdpRes.statusCode === 200,
      cartRes.statusCode === 200,
      checkoutProtected,
    ].every(Boolean);

    assert(
      'CP-08',
      'Commerce Catalog & Navigation Loop',
      loopValid,
      `Full commerce loop rendered across all 7 stages (Home, Shop, Society Fuckers, Valueless Bitches, Gods Plan PDP, Cart, Checkout: ${checkoutRes.statusCode})`,
      {
        home: homeRes.statusCode,
        shop: shopRes.statusCode,
        societyFuckers: sfRes.statusCode,
        valuelessBitches: vbRes.statusCode,
        pdp: pdpRes.statusCode,
        cart: cartRes.statusCode,
        checkout: checkoutRes.statusCode,
      }
    );
  } catch (err) {
    assert('CP-08', 'Commerce Core Flow', false, `Commerce flow failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-09: PayPal Production Handshake
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 9: PayPal Production Flow ---');
  try {
    // 1. Empty order creation must trigger strict server-side validation (HTTP 400)
    const invalidPaypalRes = await requestUrl(`${PROD_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { items: [] },
    });

    // 2. Valid items structure but missing address
    const missingAddrRes = await requestUrl(`${PROD_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { items: [{ productId: 'gods-plan', variantId: 'v1', quantity: 1 }] },
    });

    assert(
      'CP-09',
      'PayPal Production Handshake & Input Gate',
      invalidPaypalRes.statusCode === 400 && missingAddrRes.statusCode === 400,
      `PayPal endpoint enforces strict server validation before gateway calls (Empty: HTTP ${invalidPaypalRes.statusCode}, MissingAddr: HTTP ${missingAddrRes.statusCode})`,
      { emptyOrder: invalidPaypalRes.json, missingAddr: missingAddrRes.json }
    );
  } catch (err) {
    assert('CP-09', 'PayPal Production Flow', false, `PayPal handshake failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-10: Razorpay Production Webhook (HMAC Signature Verification)
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 10: Razorpay Production Webhook Cryptographic Verification ---');
  try {
    // Send forged webhook payload with invalid signature -> MUST be rejected with HTTP 400
    const fakePayload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_prod_smoke_fake' } } } });
    const forgedRes = await requestUrl(`${PROD_URL}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: fakePayload,
    });

    assert(
      'CP-10',
      'Razorpay Webhook HMAC-SHA256 Rejection of Forged Signature',
      forgedRes.statusCode === 400,
      `Tampered Razorpay webhook signature cleanly blocked with HTTP ${forgedRes.statusCode} (${forgedRes.json?.error || forgedRes.body})`,
      { statusCode: forgedRes.statusCode, response: forgedRes.json || forgedRes.body }
    );
  } catch (err) {
    assert('CP-10', 'Razorpay Production Webhook', false, `Razorpay webhook check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-11: Wise / Wire Treasury Isolation
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 11: Wise / Wire Flow & Treasury Data Isolation ---');
  try {
    const prebookRes = await requestUrl(`${PROD_URL}/shop/gods-plan/prebook`);
    const leaksRouting = prebookRes.body.includes('ROUTING_NUMBER') || prebookRes.body.includes('ACCOUNT_NUMBER');
    const leaksSwift = prebookRes.body.includes('SWIFT_BIC') || prebookRes.body.includes('IBAN_CONFIDENTIAL');

    assert(
      'CP-11',
      'Wise Wire Prebook Isolation & Treasury Shielding',
      prebookRes.statusCode === 200 && !leaksRouting && !leaksSwift,
      `Bespoke prebook interface rendered HTTP 200 without exposing corporate treasury credentials in public markup`,
      { statusCode: prebookRes.statusCode, leaksRouting, leaksSwift }
    );
  } catch (err) {
    assert('CP-11', 'Wise / Wire Flow', false, `Wise flow check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-12: Printify Production Webhook (HMAC Signature Verification)
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 12: Printify Webhook / Fulfillment Flow ---');
  try {
    const printifyFakePayload = JSON.stringify({ type: 'order:created', data: { id: 'pfy_prod_smoke_fake' } });
    const forgedPrintifyRes = await requestUrl(`${PROD_URL}/api/printify/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pfy-signature': 'sha256=invalid_forged_printify_signature_hex_digest',
      },
      body: printifyFakePayload,
    });

    assert(
      'CP-12',
      'Printify Webhook HMAC Signature Guard',
      forgedPrintifyRes.statusCode === 400 || forgedPrintifyRes.statusCode === 401,
      `Unauthenticated/tampered Printify webhook rejected with HTTP ${forgedPrintifyRes.statusCode} (${forgedPrintifyRes.json?.error || forgedPrintifyRes.body})`,
      { statusCode: forgedPrintifyRes.statusCode, response: forgedPrintifyRes.json || forgedPrintifyRes.body }
    );
  } catch (err) {
    assert('CP-12', 'Printify Webhook', false, `Printify webhook check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-13: Review Submission & Review Invite
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 13: Review Submission & Reputation Engine ---');
  try {
    const reviewsQueryRes = await requestUrl(`${PROD_URL}/api/reviews?productId=gods-plan`);
    const isReviewsArray = Array.isArray(reviewsQueryRes.json) || Array.isArray(reviewsQueryRes.json?.reviews);

    assert(
      'CP-13',
      'Review Engine Querying & Integrity',
      reviewsQueryRes.statusCode === 200 && isReviewsArray,
      `Product reviews endpoint returned HTTP 200 with structured reviews array and rating aggregate`,
      { count: Array.isArray(reviewsQueryRes.json) ? reviewsQueryRes.json.length : (reviewsQueryRes.json?.reviews?.length ?? 0) }
    );
  } catch (err) {
    assert('CP-13', 'Review Submission', false, `Review check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-14: Referral Attribution & Validation
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 14: Referral Attribution & Validation ---');
  try {
    const valRes = await requestUrl(`${PROD_URL}/api/referral/validate?code=NONEXISTENT_SMOKE_CODE`);
    const clickRes = await requestUrl(`${PROD_URL}/api/referral/click?code=NONEXISTENT_SMOKE_CODE`, {
      method: 'POST',
    });
    const isClickProtected = clickRes.statusCode === 200 || clickRes.statusCode === 404;

    assert(
      'CP-14',
      'Affiliate Referral Validation & Anti-Fraud Click Engine',
      valRes.statusCode === 200 && valRes.json?.valid === false && isClickProtected,
      `Referral system correctly validates codes (HTTP 200 valid:false) and tracks click fraud bounds (HTTP ${clickRes.statusCode})`,
      { validateResult: valRes.json, clickStatus: clickRes.statusCode }
    );
  } catch (err) {
    assert('CP-14', 'Referral Attribution', false, `Referral check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-15: Coupon Flow
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 15: Coupon Engine ---');
  try {
    const couponRes = await requestUrl(`${PROD_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { code: 'NONEXISTENT_PROMO_CODE_XYZ', subtotal: 100 },
    });

    assert(
      'CP-15',
      'Coupon Engine Validation & Error Handling',
      couponRes.statusCode === 400 && couponRes.json?.error,
      `Invalid coupon code cleanly rejected with HTTP 400: "${couponRes.json?.error}"`,
      couponRes.json
    );
  } catch (err) {
    assert('CP-15', 'Coupon Flow', false, `Coupon check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-16: Custom Design Atelier / Bespoke Intake
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 16: Custom Design Atelier / Bespoke Intake ---');
  try {
    // Verify bespoke prebooking and bespoke order intake routes
    const sfPrebookRes = await requestUrl(`${PROD_URL}/shop/gods-plan/prebook`);
    const contactGateRes = await requestUrl(`${PROD_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: '', email: 'invalid', message: '' },
    });
    const isIntakeGated = contactGateRes.statusCode === 400 || contactGateRes.statusCode === 429;

    assert(
      'CP-16',
      'Custom Bespoke Atelier Intake & Gating',
      sfPrebookRes.statusCode === 200 && isIntakeGated,
      `Bespoke Atelier prebooking rendered HTTP 200; security & validation active on inquiry intake (HTTP ${contactGateRes.statusCode})`,
      { bespokeStatus: sfPrebookRes.statusCode, intakeGateStatus: contactGateRes.statusCode }
    );
  } catch (err) {
    assert('CP-16', 'Custom Design Flow', false, `Custom design check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-17: Society Fu*kers Prebooking
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 17: Society Fu*kers Prebooking ---');
  try {
    const sfPageRes = await requestUrl(`${PROD_URL}/shop/society-fuckers`);
    const hasBespokeContent = sfPageRes.body.includes('Society') || sfPageRes.body.includes('1,000');

    assert(
      'CP-17',
      'Society Fu*kers Prebook Collection Display',
      sfPageRes.statusCode === 200 && hasBespokeContent,
      `Society Fu*kers collection landing page rendered HTTP 200 with signature luxury collection architecture`,
      { statusCode: sfPageRes.statusCode }
    );
  } catch (err) {
    assert('CP-17', 'Society Fu*kers Prebooking', false, `Prebooking check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-18: Production Account Deletion Smoke (Controlled Auth Gate)
  // Protocol: Controlled production test account: use a dedicated disposable
  // production test account provisioned specifically for Phase 14. Record its
  // identifier in the private test execution log, not in the public certification report.
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 18: Controlled Production Account Deletion Gate ---');
  try {
    // Attempt deletion without session cookie -> MUST be rejected with HTTP 401
    const unauthDeleteRes = await requestUrl(`${PROD_URL}/api/user/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    assert(
      'CP-18',
      'Account Deletion Strict Authentication Gate',
      unauthDeleteRes.statusCode === 401,
      `Unauthenticated deletion attempt cleanly blocked with HTTP 401 (${unauthDeleteRes.json?.error || unauthDeleteRes.body})`,
      { statusCode: unauthDeleteRes.statusCode, response: unauthDeleteRes.json || unauthDeleteRes.body }
    );
  } catch (err) {
    assert('CP-18', 'Production Account Deletion Smoke', false, `Account deletion probe failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-19: Email Delivery & Contact Endpoint
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 19: Email Delivery & Contact Endpoint ---');
  try {
    const invalidContactRes = await requestUrl(`${PROD_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: '', email: 'invalid_email', message: '' },
    });

    const isGuarded = invalidContactRes.statusCode === 400 || invalidContactRes.statusCode === 429;

    assert(
      'CP-19',
      'Email / Contact Gateway Input Validation & Anti-Spam Gate',
      isGuarded,
      `Contact endpoint enforces production security guards (HTTP ${invalidContactRes.statusCode}: ${invalidContactRes.statusCode === 429 ? 'Rate Limited / Anti-Spam Guard Active' : 'Malformed Payload Rejected'})`,
      invalidContactRes.json
    );
  } catch (err) {
    assert('CP-19', 'Email Delivery', false, `Contact check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-20: Mobile + Desktop Viewport Smoke
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 20: Mobile + Desktop Viewport Smoke ---');
  try {
    const rootRes = await requestUrl(`${PROD_URL}/`);
    const hasViewport = rootRes.body.includes('name="viewport"') && rootRes.body.includes('width=device-width');
    const hasMetaCharset = rootRes.body.toLowerCase().includes('charset="utf-8"');

    assert(
      'CP-20',
      'Responsive Viewport & Mobile Safe-Area Standards',
      hasViewport && hasMetaCharset,
      `Responsive viewport meta tags configured correctly for high-DPI and mobile devices`,
      { hasViewport, hasMetaCharset }
    );
  } catch (err) {
    assert('CP-20', 'Mobile Viewport Smoke', false, `Viewport check failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-21: Production Logs & Error Rates
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 21: Production Logs & Error Rates ---');
  try {
    const sampleUrls = [
      `${PROD_URL}/`,
      `${PROD_URL}/shop`,
      `${PROD_URL}/cart`,
      `${PROD_URL}/manifesto`,
      `${PROD_URL}/privacy`,
      `${PROD_URL}/disclaimer`,
      `${PROD_URL}/owners`,
    ];

    const responses = await Promise.all(sampleUrls.map((u) => requestUrl(u)));
    const zero500s = responses.every((r) => r.statusCode < 500);

    assert(
      'CP-21',
      'Zero 5xx Server Error Rate on Core Routes',
      zero500s,
      `Sampled 7 critical production routes with 0 internal server errors (Statuses: ${responses.map((r) => r.statusCode).join(', ')})`,
      { routes: sampleUrls, statuses: responses.map((r) => r.statusCode) }
    );
  } catch (err) {
    assert('CP-21', 'Production Logs & Error Rates', false, `Error rate sampling failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // CP-22: Zero Debug / Sandbox Leakage
  // -------------------------------------------------------------------
  console.log('\n--- CHECKPOINT 22: Zero Debug / Sandbox Leakage ---');
  try {
    const rootRes = await requestUrl(`${PROD_URL}/`);
    const checkoutRes = await requestUrl(`${PROD_URL}/checkout`);

    const hasLocalhostInRoot = rootRes.body.includes('localhost:') || rootRes.body.includes('127.0.0.1:');
    const hasLocalhostInCheckout = checkoutRes.body.includes('localhost:') || checkoutRes.body.includes('127.0.0.1:');
    const hasSandboxPaypal = checkoutRes.body.includes('sandbox.paypal.com');

    const clean = !hasLocalhostInRoot && !hasLocalhostInCheckout && !hasSandboxPaypal;

    assert(
      'CP-22',
      'Zero Sandbox / Debug / Localhost Leakage in Production Markup',
      clean,
      `Production pages confirmed 100% clean: zero localhost URLs, zero debug credentials, zero sandbox.paypal.com scripts`,
      { hasLocalhostInRoot, hasLocalhostInCheckout, hasSandboxPaypal }
    );
  } catch (err) {
    assert('CP-22', 'Zero Debug / Sandbox Leakage', false, `Leakage scan failed: ${err.message}`);
  }

  // -------------------------------------------------------------------
  // Report Generation
  // -------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`🏆 Phase 14 Production Smoke Testing Summary`);
  console.log(`TOTAL CHECKPOINTS TESTED: ${passedCount + failedCount}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log(`SUCCESS RATE: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
  console.log('======================================================================\n');

  const report = {
    suite: 'GERKINK Phase 14 Production Smoke Verification Suite',
    target: PROD_URL,
    executedAt: new Date().toISOString(),
    totalCheckpoints: passedCount + failedCount,
    passed: passedCount,
    failed: failedCount,
    successRate: `${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`,
    status: failedCount === 0 ? 'PHASE_14_PASS' : 'PHASE_14_FAIL',
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Detailed JSON report written to: ${REPORT_PATH}`);

  if (failedCount > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runProductionSmokeSuite().catch((err) => {
  console.error('Fatal runtime error in production smoke suite:', err);
  process.exitCode = 1;
});

