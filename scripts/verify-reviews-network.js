const { spawn } = require('child_process');
const http = require('http');

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventHandlers = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        } else if (msg.method) {
          const handlers = this.eventHandlers.get(msg.method) || [];
          for (const handler of handlers) handler(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, []);
    }
    this.eventHandlers.get(method).push(handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const path = require('path');
const os = require('os');

async function runAudit() {
  console.log('=================================================================');
  console.log('  REVIEWS API LIVE NETWORK & REAL-BROWSER AUDIT (HEADLESS CHROME)');
  console.log('=================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9700 + Math.floor(Math.random() * 200);
  const userDataDir = path.join(os.tmpdir(), 'chrome-audit-' + Date.now());
  console.log(`[CDP] Spawning Chrome on port ${port}...`);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,900',
    'about:blank'
  ]);

  let browserWsUrl = null;
  for (let i = 0; i < 20; i++) {
    try {
      const v = await getJson(`http://127.0.0.1:${port}/json/version`);
      browserWsUrl = v.webSocketDebuggerUrl;
      break;
    } catch {
      await sleep(250);
    }
  }

  if (!browserWsUrl) {
    chrome.kill();
    throw new Error('Failed to connect to Chrome remote debugging port.');
  }

  const browserClient = new CdpClient(browserWsUrl);
  await browserClient.connect();

  const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pageTarget = targets.find(t => t.id === targetId);
  const pageClient = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await pageClient.connect();

  await pageClient.send('Page.enable');
  await pageClient.send('Network.enable');
  await pageClient.send('Runtime.enable');
  await pageClient.send('Console.enable');

  const reviewRequests = [];
  const consoleWarnings = [];
  const duplicateKeyWarnings = [];

  pageClient.on('Network.requestWillBeSent', (params) => {
    try {
      const parsed = new URL(params.request.url);
      if (parsed.pathname === '/api/reviews') {
        reviewRequests.push({
          url: params.request.url,
          timestamp: Date.now(),
          method: params.request.method
        });
        console.log(`  [HTTP REQUEST] ${params.request.method} ${params.request.url}`);
      }
    } catch {}
  });

  pageClient.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map(a => a.value || JSON.stringify(a)).join(' ');
    if (params.type === 'warning' || params.type === 'error') {
      consoleWarnings.push(text);
      if (/duplicate key|unique "key" prop|each child in a list should have a unique/i.test(text)) {
        duplicateKeyWarnings.push(text);
        console.warn(`  [CONSOLE KEY WARNING] ${text}`);
      }
    }
  });

  const BASE_URL = 'http://localhost:3000';
  let allPass = true;

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1-4: OPEN PDP & OBSERVE IDLE FOR 15 SECONDS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Step 1-4: Open PDP & Observe 15s Idle (Zero Polling / Zero Looping) ---');
    reviewRequests.length = 0;
    const pdpUrl = `${BASE_URL}/shop/unisex-heavy-blend-crewneck-sweatshirt`;
    console.log(`  Navigating to ${pdpUrl}...`);
    await pageClient.send('Page.navigate', { url: pdpUrl });

    // Wait for initial page hydration and reviews fetch
    await sleep(4000);
    const initialReqCount = reviewRequests.length;
    console.log(`  Initial review request count on PDP load: ${initialReqCount}`);

    console.log('  Waiting 15 seconds without user interaction to verify zero polling...');
    for (let s = 1; s <= 15; s++) {
      await sleep(1000);
      process.stdout.write(`  [${s}/15s] Requests recorded: ${reviewRequests.length}\r`);
    }
    console.log('\n  15-second observation window concluded.');

    const pdp15sCount = reviewRequests.length;
    console.log(`  Total /api/reviews requests after 15s idle: ${pdp15sCount}`);
    if (pdp15sCount === 1) {
      console.log('  ✅ PASS: Exactly 1 initial /api/reviews request fired on PDP. Zero background re-fetching.');
    } else {
      console.error(`  ❌ FAIL: Expected exactly 1 request on PDP, but received ${pdp15sCount}`);
      allPass = false;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: DELIBERATE FILTER / PRODUCT CHANGE INTERACTION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Step 5: Deliberate Review Filter / Interaction ---');
    // Ensure reviews toolbar is rendered
    await sleep(2000);
    const beforeFilterCount = reviewRequests.length;
    console.log('  Clicking filter button in customer reviews toolbar...');
    const clickResult = await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const targetBtn = buttons.find(b => {
            const txt = (b.textContent || '').trim();
            return txt.includes('5★') || txt.includes('VERIFIED') || txt.includes('PHOTOS');
          });
          if (targetBtn) {
            targetBtn.click();
            return 'Clicked: ' + targetBtn.textContent.trim();
          }
          return 'Buttons found: ' + buttons.map(b => b.textContent.trim()).filter(Boolean).slice(0, 10).join(', ');
        })()
      `,
      returnByValue: true
    });
    console.log(`  DOM Action: ${clickResult.result?.value}`);

    await sleep(2500);
    const afterFilterCount = reviewRequests.length;
    const filterReqDiff = afterFilterCount - beforeFilterCount;
    console.log(`  Requests after filter toggle: +${filterReqDiff} (Total: ${afterFilterCount})`);

    // Verify it doesn't loop after filter toggle
    console.log('  Waiting 5 seconds to verify filter change does not trigger loop...');
    await sleep(5000);
    const afterSortWaitCount = reviewRequests.length;
    if (afterSortWaitCount === afterFilterCount && filterReqDiff === 1) {
      console.log('  ✅ PASS: Filter change fired single expected request (+1) and remained completely stable.');
    } else {
      console.error(`  ❌ FAIL: Expected +1 request after filter click, got +${filterReqDiff}; subsequent requests: ${afterSortWaitCount - afterFilterCount}`);
      allPass = false;
    }

    // Now test navigating to another product (product change)
    console.log('\n--- Step 5b: Navigate to Second Product (/shop/bhjb) ---');
    const beforeSecondPdpCount = reviewRequests.length;
    console.log(`  Navigating to ${BASE_URL}/shop/bhjb...`);
    await pageClient.send('Page.navigate', { url: `${BASE_URL}/shop/bhjb` });
    // Allow up to 8s for second product SSR, hydration & initial fetch
    await sleep(8000);
    const secondPdpCount = reviewRequests.length - beforeSecondPdpCount;
    console.log(`  Requests on second PDP after initial load: ${secondPdpCount}`);
    console.log('  Waiting 10s on second PDP to verify stability...');
    for (let s = 1; s <= 10; s++) {
      await sleep(1000);
      process.stdout.write(`  [${s}/10s] Requests recorded on second PDP: ${reviewRequests.length - beforeSecondPdpCount}\r`);
    }
    console.log('\n  Second PDP observation concluded.');
    const afterSecondPdpWait = reviewRequests.length - beforeSecondPdpCount;
    if (afterSecondPdpWait === 1 && secondPdpCount === 1) {
      console.log('  ✅ PASS: Second product page fired exactly 1 request and remained completely stable.');
    } else {
      console.error(`  ❌ FAIL: Expected exactly 1 request on second PDP, got ${afterSecondPdpWait}`);
      allPass = false;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 6: UNMOUNT & NAVIGATION CLEANUP
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Step 6: Navigation Away & Unmount Cleanup ---');
    console.log('  Navigating away from PDP to /shop...');
    await pageClient.send('Page.navigate', { url: `${BASE_URL}/shop` });
    await sleep(2000);
    const afterNavCount = reviewRequests.length;
    console.log('  Waiting 5s on /shop to confirm no lingering timer or polling loop...');
    await sleep(5000);
    const afterShopWaitCount = reviewRequests.length;
    if (afterShopWaitCount === afterNavCount) {
      console.log('  ✅ PASS: Unmounting PDP leaves zero background request loops.');
    } else {
      console.error('  ❌ FAIL: Lingering request loops detected after navigation away.');
      allPass = false;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 7: HOMEPAGE REVIEW REVIEWS & 15S OBSERVATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Step 7: Homepage Marquee Audit & 15s Observation ---');
    reviewRequests.length = 0;
    console.log(`  Navigating to ${BASE_URL}...`);
    await pageClient.send('Page.navigate', { url: BASE_URL });
    await sleep(4000);
    console.log(`  Initial review request count on Homepage load: ${reviewRequests.length}`);

    console.log('  Observing homepage for 15 seconds...');
    for (let s = 1; s <= 15; s++) {
      await sleep(1000);
      process.stdout.write(`  [${s}/15s] Requests recorded: ${reviewRequests.length}\r`);
    }
    console.log('\n  Homepage 15-second observation window concluded.');

    const homeReqCount = reviewRequests.length;
    console.log(`  Total /api/reviews requests on homepage after 15s: ${homeReqCount}`);
    if (homeReqCount === 1) {
      console.log('  ✅ PASS: Exactly 1 initial /api/reviews request fired on Homepage. Zero background re-fetching.');
    } else {
      console.error(`  ❌ FAIL: Expected exactly 1 request on homepage, received ${homeReqCount}`);
      allPass = false;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 8: REACT DUPLICATE-KEY WARNING AUDIT
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Step 8: React Duplicate Key & Console Warnings Audit ---');
    console.log(`  Total console warnings logged: ${consoleWarnings.length}`);
    console.log(`  Duplicate key warnings logged: ${duplicateKeyWarnings.length}`);
    if (duplicateKeyWarnings.length === 0) {
      console.log('  ✅ PASS: Zero React duplicate-key warnings observed throughout entire session.');
    } else {
      console.error('  ❌ FAIL: Detected duplicate key warnings in console:');
      duplicateKeyWarnings.forEach(w => console.error(`    - ${w}`));
      allPass = false;
    }

  } finally {
    pageClient.close();
    browserClient.close();
    chrome.kill();
    console.log('\n[CDP] Headless Chrome session terminated.');
  }

  console.log('\n=================================================================');
  if (allPass) {
    console.log('  ALL BROWSER NETWORK & STABILITY CRITERIA: PASS (100%) ✅');
  } else {
    console.log('  AUDIT FAILED: One or more assertions did not meet criteria ❌');
    process.exit(1);
  }
  console.log('=================================================================\n');
}

runAudit().catch((err) => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
