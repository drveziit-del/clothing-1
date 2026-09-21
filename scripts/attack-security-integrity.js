const https = require('https');
const url = require('url');

async function sendRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GerkinkSecurityAuditor/1.0',
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...headers,
    };

    const req = https.request(
      `https://gerkink.shop${path}`,
      {
        method,
        headers: reqHeaders,
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json,
          });
        });
      }
    );

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'TIMEOUT' });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runAttacks() {
  console.log('=================================================================');
  console.log('  GERKINK LIVE SECURITY & INTEGRITY PENETRATION ATTACK SUITE     ');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, detail = '') {
    if (cond) {
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } else {
      failed++;
      console.log(`  ❌ FAIL: ${name} — ${detail}`);
    }
  }

  // ── ATTACK 1: Admin Privilege Escalation ────────────────────────────────────
  console.log('--- 1. Admin Privilege Escalation Attacks ---');
  
  // 1a. Direct unauthenticated request to /api/admin/orders
  const a1 = await sendRequest('GET', '/api/admin/orders');
  assert(a1.status === 401 || a1.status === 403, 'Unauthenticated /api/admin/orders rejected', `Got status ${a1.status}`);

  // 1b. Forged is_admin cookie without valid session
  const a2 = await sendRequest('GET', '/api/admin/orders', null, {
    'Cookie': 'is_admin=true'
  });
  assert(a2.status === 401 || a2.status === 403, 'Forged is_admin=true cookie rejected without valid session', `Got status ${a2.status}`);

  // 1c. Tampered session cookie with is_admin=true
  const a3 = await sendRequest('GET', '/api/admin/orders', null, {
    'Cookie': 'session=eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJ1aWQiOiJmYWtlX2FkbWluIiwiYWRtaW4iOnRydWV9.fake_signature; is_admin=true'
  });
  assert(a3.status === 401 || a3.status === 403, 'Tampered session JWT rejected by adminAuth.verifySessionCookie', `Got status ${a3.status}`);

  // 1d. Unauthenticated request to /api/admin/payouts
  const a4 = await sendRequest('GET', '/api/admin/payouts');
  assert(a4.status === 401 || a4.status === 403, 'Unauthenticated /api/admin/payouts rejected', `Got status ${a4.status}`);

  // 1e. Unauthenticated request to /api/admin/settings/bank-details
  const a5 = await sendRequest('GET', '/api/admin/settings/bank-details');
  assert(a5.status === 401 || a5.status === 403, 'Unauthenticated /api/admin/settings/bank-details rejected', `Got status ${a5.status}`);

  // 1f. Unauthenticated request to /api/admin/custom-designs
  const a6 = await sendRequest('GET', '/api/admin/custom-designs');
  assert(a6.status === 401 || a6.status === 403, 'Unauthenticated /api/admin/custom-designs rejected', `Got status ${a6.status}`);

  // ── ATTACK 2: Bank Details & Sensitive Treasury IDOR ─────────────────────────
  console.log('\n--- 2. Sensitive Treasury & Bank Details IDOR Attacks ---');

  // 2a. Anonymous request to /api/user/bank
  const b1 = await sendRequest('GET', '/api/user/bank');
  assert(b1.status === 401, 'Anonymous /api/user/bank rejected with 401', `Got status ${b1.status}`);

  // 2b. Anonymous request to /api/settings/bank-details
  const b2 = await sendRequest('GET', '/api/settings/bank-details');
  assert(b2.status === 401, 'Anonymous /api/settings/bank-details rejected with 401', `Got status ${b2.status}`);

  // 2c. Forged order ID with fake session to /api/settings/bank-details?orderId=ORD-99999
  const b3 = await sendRequest('GET', '/api/settings/bank-details?orderId=ORD-99999', null, {
    'Cookie': 'session=fake_invalid_session_token'
  });
  assert(b3.status === 401, 'Forged orderId with invalid session rejected with 401', `Got status ${b3.status}`);

  // ── ATTACK 3: Price Manipulation & Quantity Attacks ─────────────────────────
  console.log('\n--- 3. Price & Quantity Tampering Attacks ---');

  // 3a. Calling /api/payment/create-order with unauthenticated session
  const c1 = await sendRequest('POST', '/api/payment/create-order', {
    items: [{ productId: 'li2k2yobmJb2TH8sQH3T', variantId: '1', quantity: 1, price: 0.01 }],
    shippingAddress: { country: 'US', address1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', fullName: 'Attacker' }
  });
  assert(c1.status === 401, 'Unauthenticated /api/payment/create-order rejected with 401', `Got status ${c1.status}`);

  // 3b. Calling /api/paypal/create-order with negative quantity
  const c2 = await sendRequest('POST', '/api/paypal/create-order', {
    items: [{ productId: 'li2k2yobmJb2TH8sQH3T', variantId: '1', quantity: -5 }],
    shippingAddress: { country: 'US', address1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', fullName: 'Attacker' }
  });
  assert(c2.status === 400, 'Negative quantity rejected with 400 validation error', `Got status ${c2.status}`);

  // 3c. Calling /api/paypal/create-order with 0 quantity
  const c3 = await sendRequest('POST', '/api/paypal/create-order', {
    items: [{ productId: 'li2k2yobmJb2TH8sQH3T', variantId: '1', quantity: 0 }],
    shippingAddress: { country: 'US', address1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', fullName: 'Attacker' }
  });
  assert(c3.status === 400, 'Zero quantity rejected with 400 validation error', `Got status ${c3.status}`);

  // 3d. Calling /api/paypal/create-order with non-existent productId
  const c4 = await sendRequest('POST', '/api/paypal/create-order', {
    items: [{ productId: 'non_existent_hacked_prod', variantId: '1', quantity: 1 }],
    shippingAddress: { country: 'US', address1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', fullName: 'Attacker' }
  });
  assert(c4.status === 400, 'Non-existent productId rejected with 400 error', `Got status ${c4.status}`);

  // ── ATTACK 4: Webhook Forgery Attacks ───────────────────────────────────────
  console.log('\n--- 4. Webhook Forgery & Replay Attacks ---');

  // 4a. Razorpay webhook with fake signature
  const w1 = await sendRequest('POST', '/api/payment/webhook', {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_fake123', order_id: 'order_fake123', status: 'captured' } } }
  }, {
    'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000'
  });
  assert(w1.status === 400, 'Forged Razorpay webhook signature rejected with 400', `Got status ${w1.status}`);

  // 4b. PayPal webhook with fake signature
  const w2 = await sendRequest('POST', '/api/paypal/webhook', {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'cap_fake123' }
  }, {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-c7820a4b',
    'paypal-transmission-id': 'fake-trans-id',
    'paypal-transmission-sig': 'fake_signature',
    'paypal-transmission-time': new Date().toISOString()
  });
  assert(w2.status === 400, 'Forged PayPal webhook signature rejected with 400', `Got status ${w2.status}`);

  // 4c. Printify webhook with fake signature
  const w3 = await sendRequest('POST', '/api/printify/webhook', {
    type: 'order:created',
    data: { external_id: 'fake_order_id' }
  }, {
    'x-pfy-signature': 'fake_signature'
  });
  assert(w3.status === 401, 'Forged Printify webhook rejected with 401', `Got status ${w3.status}`);

  // ── ATTACK 5: Custom Design Upload & Media Traversal Attacks ─────────────────
  console.log('\n--- 5. Custom Design & Media Security Attacks ---');

  // 5a. Path traversal on /api/custom-design/media
  const cd1 = await sendRequest('GET', '/api/custom-design/media?path=../etc/passwd');
  assert(cd1.status === 400, 'Path traversal ../etc/passwd rejected with 400', `Got status ${cd1.status}`);

  // 5b. Unauthenticated access to /api/custom-design/media
  const cd2 = await sendRequest('GET', '/api/custom-design/media?path=custom-design/some_user/secret.png');
  assert(cd2.status === 401, 'Unauthenticated /api/custom-design/media rejected with 401', `Got status ${cd2.status}`);

  // 5c. Unauthenticated upload attempt to /api/custom-design/upload
  const cd3 = await sendRequest('POST', '/api/custom-design/upload', 'fake multipart data', {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
  });
  assert(cd3.status === 401, 'Unauthenticated /api/custom-design/upload rejected with 401', `Got status ${cd3.status}`);

  // 5d. Unauthenticated request creation to /api/custom-design/create-request
  const cd4 = await sendRequest('POST', '/api/custom-design/create-request', {
    plan: 'starter',
    country: 'US',
    notes: 'Hacked request'
  });
  assert(cd4.status === 401, 'Unauthenticated /api/custom-design/create-request rejected with 401', `Got status ${cd4.status}`);

  // ── ATTACK 6: Coupon Validation Attacks ─────────────────────────────────────
  console.log('\n--- 6. Coupon Tampering Attacks ---');

  // 6a. Non-existent coupon code
  const cp1 = await sendRequest('POST', '/api/coupons/validate', {
    code: 'HACKED_FREE_100_PERCENT',
    subtotal: 100,
    tax: 0
  });
  assert(cp1.status === 200 && cp1.json?.valid === false, 'Non-existent coupon returns valid=false', `Got ${JSON.stringify(cp1.json)}`);

  // 6b. Negative subtotal in coupon validation
  const cp2 = await sendRequest('POST', '/api/coupons/validate', {
    code: 'GERKINK10',
    subtotal: -50,
    tax: 0
  });
  assert(cp2.status === 400 || (cp2.status === 200 && cp2.json?.valid === false), 'Negative subtotal in coupon rejected', `Got ${cp2.status}`);

  // ── ATTACK 7: Favourites IDOR Attacks ───────────────────────────────────────
  console.log('\n--- 7. Favourites IDOR Attacks ---');

  // 7a. Unauthenticated GET /api/favorites
  const fav1 = await sendRequest('GET', '/api/favorites');
  assert(fav1.status === 401, 'Unauthenticated GET /api/favorites rejected with 401', `Got status ${fav1.status}`);

  // 7b. Unauthenticated POST /api/favorites
  const fav2 = await sendRequest('POST', '/api/favorites', { productId: 'li2k2yobmJb2TH8sQH3T' });
  assert(fav2.status === 401, 'Unauthenticated POST /api/favorites rejected with 401', `Got status ${fav2.status}`);

  // 7c. Unauthenticated DELETE /api/favorites
  const fav3 = await sendRequest('DELETE', '/api/favorites?productId=li2k2yobmJb2TH8sQH3T');
  assert(fav3.status === 401, 'Unauthenticated DELETE /api/favorites rejected with 401', `Got status ${fav3.status}`);

  console.log('\n=================================================================');
  console.log(`  ATTACK RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('=================================================================');
}

runAttacks().catch(console.error);
