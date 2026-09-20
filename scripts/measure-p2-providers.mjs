import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

const TEST_HOST = 'http://127.0.0.1:3005';
const ROUTES_TO_PROFILE = [
  { slug: 'home', name: 'Homepage', path: '/' },
  { slug: 'valueless-bitches', name: 'Valueless Bitches Collection', path: '/shop/valueless-bitches' },
  { slug: 'gods-plan', name: 'Product Detail (Gods Plan)', path: '/shop/gods-plan' },
];

async function profileRoute(url, chromePort) {
  const targetRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetRes.json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 35000);
      pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    try {
      const d = JSON.parse(event.data);
      if (d.id && pending.has(d.id)) {
        const { resolve, timeout } = pending.get(d.id);
        clearTimeout(timeout);
        pending.delete(d.id);
        resolve(d.result);
      }
    } catch (_) {}
  };

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    // Identical Mobile Slow 4G Profile: 390x844 DPR 3, 150ms RTT, 1.638 Mbps down, 0.75 Mbps up, CPU 4x
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1638.4 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      connectionType: 'cellular4g',
    });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Inject comprehensive provider and hydration instrumentation before any scripts execute
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__p2_events = {
          fetchCalls: [],
          storageReads: [],
          storageWrites: [],
          reflowTriggers: [],
          lcpCandidates: [],
          longTasks: [],
          paints: [],
        };

        // 1. Intercept fetch
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : 'unknown');
          const method = (args[1] && args[1].method) || 'GET';
          const start = Math.round(performance.now());
          const stack = (new Error().stack || '').split('\\n').slice(2, 5).map(s => s.trim()).join(' -> ');
          
          let provider = 'Unknown';
          if (url.includes('/api/currency')) provider = 'CurrencyProvider';
          else if (url.includes('/api/health')) provider = 'NetworkStatusProvider';
          else if (url.includes('/api/analytics/visit')) provider = 'LayoutWrapper';
          else if (url.includes('/api/auth/session')) provider = 'AuthProvider';
          else if (url.includes('/api/referral')) provider = 'LayoutWrapper (Referral)';
          else if (url.includes('firestore.googleapis.com')) provider = 'Firebase Firestore';
          
          const record = { url, method, start, provider, stack, duration: 0, status: 0 };
          window.__p2_events.fetchCalls.push(record);
          
          try {
            const res = await origFetch.apply(this, args);
            record.duration = Math.round(performance.now() - start);
            record.status = res.status;
            return res;
          } catch (e) {
            record.duration = Math.round(performance.now() - start);
            record.error = e.message;
            throw e;
          }
        };

        // 2. Intercept localStorage & sessionStorage
        const origGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function(key) {
          const start = Math.round(performance.now());
          const isLocal = this === window.localStorage;
          const storageType = isLocal ? 'localStorage' : 'sessionStorage';
          const val = origGetItem.apply(this, arguments);
          window.__p2_events.storageReads.push({
            storageType,
            key,
            time: start,
            hasValue: val !== null
          });
          return val;
        };

        const origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          const start = Math.round(performance.now());
          const isLocal = this === window.localStorage;
          const storageType = isLocal ? 'localStorage' : 'sessionStorage';
          window.__p2_events.storageWrites.push({
            storageType,
            key,
            time: start,
          });
          return origSetItem.apply(this, arguments);
        };

        // 3. Track forced reflows
        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        let reflowCount = 0;
        Element.prototype.getBoundingClientRect = function() {
          reflowCount++;
          if (reflowCount <= 20) {
            window.__p2_events.reflowTriggers.push({
              type: 'getBoundingClientRect',
              time: Math.round(performance.now()),
              tag: this.tagName,
              className: this.className,
            });
          }
          return origGetBoundingClientRect.apply(this, arguments);
        };

        // 4. Performance Observers for LCP, Paints, LongTasks
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            let el = entry.element;
            let selector = 'N/A';
            let tagName = 'N/A';
            if (el) {
              tagName = el.tagName;
              selector = el.className ? (el.tagName + '.' + String(el.className).trim().replace(/\\s+/g, '.')) : el.tagName;
            }
            window.__p2_events.lcpCandidates.push({
              renderTime: Math.round(entry.renderTime || 0),
              loadTime: Math.round(entry.loadTime || 0),
              startTime: Math.round(entry.startTime || 0),
              size: entry.size || 0,
              url: entry.url || '',
              tagName,
              selector,
              isText: !entry.url && (!el || el.tagName !== 'IMG')
            });
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__p2_events.longTasks.push({
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        }).observe({ type: 'longtask', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__p2_events.paints.push({
              name: entry.name,
              startTime: Math.round(entry.startTime),
            });
          }
        }).observe({ type: 'paint', buffered: true });
      `,
    });

    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 12000));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        JSON.stringify({
          events: window.__p2_events,
          nav: performance.getEntriesByType('navigation')[0] || {},
          resources: performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            initiatorType: r.initiatorType,
            startTime: Math.round(r.startTime),
            duration: Math.round(r.duration),
            transferSize: r.transferSize
          })),
        })
      `,
      returnByValue: true,
    });

    return JSON.parse(evalRes.result.value);
  } finally {
    try {
      ws.close();
      await fetch(`http://127.0.0.1:${chromePort}/json/close/${target.id}`, { method: 'PUT' });
    } catch (_) {}
  }
}

async function main() {
  console.log('======================================================================');
  console.log('🔬 GERKINK Phase P2 — Client Architecture & Hydration Deep Dive');
  console.log('Profiling Provider Initialization, Sync Storage Reads, Reflows, API Calls');
  console.log('======================================================================\n');

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const chromePort = chrome.port;
  const results = {};

  try {
    for (const route of ROUTES_TO_PROFILE) {
      const fullUrl = `${TEST_HOST}${route.path}`;
      console.log(`▶ Profiling Route: [${route.name}] (${fullUrl})...`);
      const profileData = await profileRoute(fullUrl, chromePort);
      results[route.slug] = profileData;

      const ev = profileData.events;
      console.log(`   Paints: FCP = ${ev.paints.find(p => p.name === 'first-contentful-paint')?.startTime || 'N/A'}ms`);
      console.log(`   LCP Candidates: ${ev.lcpCandidates.length}`);
      ev.lcpCandidates.forEach((c, idx) => {
        const t = c.renderTime || c.loadTime || c.startTime;
        console.log(`     #${idx + 1}: ${t}ms | <${c.tagName}>.${c.selector} | ${c.url ? 'IMG' : 'Text'}`);
      });
      console.log(`   Long Tasks: ${ev.longTasks.length} tasks (Total: ${ev.longTasks.reduce((a,b)=>a+b.duration,0)}ms)`);
      console.log(`   Network API Calls on Mount:`);
      ev.fetchCalls.forEach(f => {
        console.log(`     [${f.provider}] ${f.method} ${f.url} (start=${f.start}ms, dur=${f.duration}ms)`);
      });
      console.log(`   Storage Reads: ${ev.storageReads.length} | Writes: ${ev.storageWrites.length}`);
      ev.storageReads.slice(0, 8).forEach(s => {
        console.log(`     ${s.storageType}.getItem('${s.key}') at ${s.time}ms (hasValue: ${s.hasValue})`);
      });
      console.log(`   Forced Reflows Logged: ${ev.reflowTriggers.length}`);
      console.log('----------------------------------------------------------------------\n');
    }
  } finally {
    try { await chrome.kill(); } catch (_) {}
  }

  fs.writeFileSync('scripts/p2-hydration-profile.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Detailed profile saved to scripts/p2-hydration-profile.json');
}

main().catch(console.error);
