/**
 * GERKINK - Network Status Indicator & Offline Resilience Gate
 * Automated Test Suite
 *
 * Verifies:
 * 1. Health API Probe (/api/health) response integrity and performance
 * 2. NetworkStatusContext interface and lifecycle hooks
 * 3. NetworkStatusPill component and accessibility attributes
 * 4. Responsive styling & safe area clearance
 * 5. Global integration in root layout
 * 6. Action form guards (Checkout, PayPal, Reviews, Custom Design, Account Deletion)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:3000';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function fetchJson(urlPath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}${urlPath}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return { status: res.status, headers: res.headers, data };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('GERKINK Network Status Indicator & Offline Gate Suite');
  console.log('====================================================\n');

  // Test Group 1: /api/health Endpoint
  console.log('▶ [GROUP 1] Backend Health Endpoint Probing');
  try {
    const start = Date.now();
    const res = await fetchJson('/api/health');
    const elapsed = Date.now() - start;

    assert(res.status === 200, `/api/health responds with HTTP 200 (actual: ${res.status})`);
    assert(res.data && res.data.status === 'ok', '/api/health returns { status: "ok" }');
    assert(elapsed < 2000, `/api/health probe latency is low (<2000ms, actual: ${elapsed}ms)`);
  } catch (err) {
    assert(false, `/api/health probe failed: ${err.message}`);
  }

  // Test Group 2: Context Architecture
  console.log('\n▶ [GROUP 2] NetworkStatusContext Architecture & Lifecycle');
  const contextPath = path.join(__dirname, '..', 'src', 'context', 'NetworkStatusContext.tsx');
  assert(fs.existsSync(contextPath), 'NetworkStatusContext.tsx exists');
  const contextCode = fs.readFileSync(contextPath, 'utf8');

  assert(contextCode.includes('export function NetworkStatusProvider'), 'Exports NetworkStatusProvider');
  assert(contextCode.includes('export function useNetworkStatus'), 'Exports useNetworkStatus hook');
  assert(contextCode.includes('navigator.onLine'), 'Inspects navigator.onLine for browser connectivity');
  assert(contextCode.includes("addEventListener('online'"), 'Attaches window online event listener');
  assert(contextCode.includes("addEventListener('offline'"), 'Attaches window offline event listener');
  assert(contextCode.includes('/api/health'), 'Performs server health probe via /api/health');
  assert(contextCode.includes('back_online'), 'Implements back_online state with auto-dismissal');
  assert(contextCode.includes('isServerReachable'), 'Separates browser connectivity from backend availability via isServerReachable');

  // Test Group 3: NetworkStatusPill Component & UI
  console.log('\n▶ [GROUP 3] NetworkStatusPill Component & A11y');
  const pillPath = path.join(__dirname, '..', 'src', 'components', 'ui', 'NetworkStatusPill.tsx');
  const pillCssPath = path.join(__dirname, '..', 'src', 'components', 'ui', 'NetworkStatusPill.module.css');
  assert(fs.existsSync(pillPath), 'NetworkStatusPill.tsx exists');
  assert(fs.existsSync(pillCssPath), 'NetworkStatusPill.module.css exists');

  const pillCode = fs.readFileSync(pillPath, 'utf8');
  const pillCss = fs.readFileSync(pillCssPath, 'utf8');

  assert(pillCode.includes('role="status"'), 'NetworkStatusPill has role="status" for screen readers');
  assert(pillCode.includes('aria-live="polite"'), 'NetworkStatusPill has aria-live="polite" for accessibility');
  assert(pillCode.includes('ONLINE'), 'Contains ONLINE state text');
  assert(pillCode.includes('OFFLINE'), 'Contains OFFLINE state text');
  assert(pillCode.includes('BACK ONLINE'), 'Contains BACK ONLINE state text');
  assert(pillCode.includes('RECONNECTING'), 'Contains RECONNECTING state text');
  assert(pillCss.includes('@media (max-width:'), 'Contains responsive media query for mobile devices');
  assert(pillCss.includes('safe-area-inset-bottom'), 'Accounts for mobile safe area insets');
  assert(pillCss.includes('z-index: 99999'), 'Properly layers status pill at high z-index');

  // Test Group 4: Global Layout Provider Integration
  console.log('\n▶ [GROUP 4] Root Layout Persistence');
  const layoutPath = path.join(__dirname, '..', 'src', 'app', 'layout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf8');

  assert(layoutCode.includes('NetworkStatusProvider'), 'Root layout wraps application with NetworkStatusProvider');
  assert(layoutCode.includes('NetworkStatusPill'), 'Root layout renders NetworkStatusPill component globally');

  // Test Group 5: Action Form Offline Guards
  console.log('\n▶ [GROUP 5] Offline Action Protection & Messaging');

  // Checkout Page
  const checkoutPath = path.join(__dirname, '..', 'src', 'app', 'checkout', 'page.tsx');
  const checkoutCode = fs.readFileSync(checkoutPath, 'utf8');
  assert(checkoutCode.includes('useNetworkStatus'), 'Checkout page imports useNetworkStatus');
  assert(checkoutCode.includes('!isOnline') && checkoutCode.includes('handleAddressSubmit'), 'handleAddressSubmit prevents progression when offline');
  assert(checkoutCode.includes('!isOnline') && checkoutCode.includes('handleFreeCheckout'), 'handleFreeCheckout prevents completion when offline');
  assert(checkoutCode.includes('Offline — Reconnect to Continue'), 'Checkout address button displays offline state');

  // PayPal Multi Button
  const paypalPath = path.join(__dirname, '..', 'src', 'components', 'checkout', 'PayPalMultiButton.tsx');
  const paypalCode = fs.readFileSync(paypalPath, 'utf8');
  assert(paypalCode.includes('useNetworkStatus'), 'PayPalMultiButton imports useNetworkStatus');
  assert(paypalCode.includes('!isOnline') && paypalCode.includes('handleCreateOrder'), 'PayPalMultiButton blocks order creation when offline');
  assert(paypalCode.includes('pointerEvents: isOnline ? \'auto\' : \'none\''), 'PayPalMultiButton disables click interaction when offline');

  // Write Review Modal
  const reviewPath = path.join(__dirname, '..', 'src', 'components', 'reviews', 'WriteReviewModal.tsx');
  const reviewCode = fs.readFileSync(reviewPath, 'utf8');
  assert(reviewCode.includes('useNetworkStatus'), 'WriteReviewModal imports useNetworkStatus');
  assert(reviewCode.includes('!isOnline') && reviewCode.includes('handleSubmit'), 'WriteReviewModal blocks review submission when offline');
  assert(reviewCode.includes('Offline — Reconnect to Submit'), 'WriteReviewModal submit button indicates offline state');

  // Custom Design Configurator
  const customDesignPath = path.join(__dirname, '..', 'src', 'app', 'custom-design', 'CustomDesignClient.tsx');
  const customDesignCode = fs.readFileSync(customDesignPath, 'utf8');
  assert(customDesignCode.includes('useNetworkStatus'), 'CustomDesignClient imports useNetworkStatus');
  assert(customDesignCode.includes('!isOnline') && customDesignCode.includes('handleCreatePayPalOrder'), 'CustomDesignClient blocks PayPal order creation when offline');
  assert(customDesignCode.includes('disabled={isSubmitting || !isOnline'), 'CustomDesignClient disables PayPal button when offline');

  // Account Deletion Modal
  const deleteModalPath = path.join(__dirname, '..', 'src', 'components', 'account', 'DeleteAccountModal.tsx');
  const deleteModalCode = fs.readFileSync(deleteModalPath, 'utf8');
  assert(deleteModalCode.includes('useNetworkStatus'), 'DeleteAccountModal imports useNetworkStatus');
  assert(deleteModalCode.includes('isOnline') && deleteModalCode.includes('isDeleteEnabled'), 'DeleteAccountModal conditions delete confirmation on isOnline');
  assert(deleteModalCode.includes('Offline — Reconnect to Delete'), 'DeleteAccountModal button reflects offline state');

  console.log('\n====================================================');
  console.log(`TOTAL ASSERTIONS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runTests().catch((err) => {
  console.error('Test suite runtime error:', err);
  process.exitCode = 1;
});
