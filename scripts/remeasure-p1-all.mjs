import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';

const TEST_HOST = 'http://127.0.0.1:3005';
const TARGET_ROUTES = [
  { slug: 'home', name: 'Homepage', path: '/' },
  { slug: 'shop', name: 'Shop Catalog', path: '/shop' },
  { slug: 'valueless-bitches', name: 'Valueless Bitches Collection', path: '/shop/valueless-bitches' },
  { slug: 'society-fuckers', name: 'Society Fuckers Collection', path: '/shop/society-fuckers' },
  { slug: 'gods-plan', name: 'Product Detail (Gods Plan)', path: '/shop/gods-plan' },
  { slug: 'cart', name: 'Cart Page', path: '/cart' },
  { slug: 'checkout', name: 'Checkout Guard', path: '/checkout' },
  { slug: 'custom-design', name: 'Custom Design Atelier', path: '/custom-design' },
];

function calculateMedian(arr) {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function runAudit(url, chromePort) {
  const targetRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetRes.json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let msgId = 1;
  const pending = new Map();
  const requests = new Map();

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
      } else if (d.method === 'Network.requestWillBeSent') {
        const p = d.params;
        requests.set(p.requestId, {
          url: p.request.url,
          startTime: p.timestamp * 1000,
          type: p.type || 'Other',
        });
      } else if (d.method === 'Network.responseReceived') {
        const p = d.params;
        const req = requests.get(p.requestId);
        if (req) {
          req.status = p.response.status;
          req.responseTime = p.timestamp * 1000;
        }
      } else if (d.method === 'Network.loadingFinished') {
        const p = d.params;
        const req = requests.get(p.requestId);
        if (req) {
          req.endTime = p.timestamp * 1000;
          req.transferSize = p.encodedDataLength || 0;
        }
      }
    } catch (_) {}
  };

  try {
    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');

    // Mobile Slow 4G Profile: 390x844 DPR 3, 150ms RTT, 1.638 Mbps down, 0.75 Mbps up, CPU 4x
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

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__lcp_entries = [];
        window.__long_tasks = [];
        window.__cls_entries = [];
        window.__paint_entries = [];

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            let el = entry.element;
            let selector = 'N/A';
            let tagName = 'N/A';
            let outerSnippet = 'N/A';

            if (el) {
              tagName = el.tagName;
              selector = el.className ? (el.tagName + '.' + String(el.className).trim().replace(/\\s+/g, '.')) : el.tagName;
              outerSnippet = el.outerHTML ? el.outerHTML.slice(0, 300) : 'N/A';
            }

            window.__lcp_entries.push({
              renderTime: Math.round(entry.renderTime || 0),
              loadTime: Math.round(entry.loadTime || 0),
              startTime: Math.round(entry.startTime || 0),
              size: entry.size || 0,
              url: entry.url || '',
              tagName,
              selector,
              outerSnippet,
              isText: !entry.url && (!el || el.tagName !== 'IMG')
            });
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__long_tasks.push({
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        }).observe({ type: 'longtask', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__cls_entries.push(entry.value);
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__paint_entries.push({
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
          nav: performance.getEntriesByType('navigation')[0] || {},
          paint: window.__paint_entries || [],
          lcpCandidates: window.__lcp_entries || [],
          longTasks: window.__long_tasks || [],
          resources: performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            startTime: Math.round(r.startTime),
            responseStart: Math.round(r.responseStart),
            responseEnd: Math.round(r.responseEnd),
            duration: Math.round(r.duration),
            initiatorType: r.initiatorType,
            transferSize: r.transferSize
          })),
          cls: (window.__cls_entries || []).reduce((a, b) => a + b, 0),
          headPreloads: Array.from(document.querySelectorAll('link[rel="preload"]')).map(l => ({
            as: l.getAttribute('as'),
            href: l.getAttribute('href'),
            imageSrcSet: l.getAttribute('imagesrcset')
          })),
          headPreconnects: Array.from(document.querySelectorAll('link[rel="preconnect"]')).map(l => l.getAttribute('href')),
        })
      `,
      returnByValue: true,
    });

    const metrics = JSON.parse(evalRes.result.value);
    const nav = metrics.nav;
    const ttfb = Math.round(nav.responseStart ? nav.responseStart - nav.requestStart : 0);
    const fcpEntry = metrics.paint.find((p) => p.name === 'first-contentful-paint');
    const fcp = fcpEntry ? fcpEntry.startTime : 0;
    const lcpEntry = metrics.lcpCandidates.length ? metrics.lcpCandidates[metrics.lcpCandidates.length - 1] : null;
    const lcp = lcpEntry ? (lcpEntry.renderTime || lcpEntry.loadTime || lcpEntry.startTime) : fcp;

    const longTasks = metrics.longTasks || [];
    const longTasksBeforeLcp = longTasks.filter((t) => t.startTime < lcp);
    const jsTasksBeforeLcp = longTasksBeforeLcp.reduce((a, b) => a + b.duration, 0);
    const tbt = Math.max(0, jsTasksBeforeLcp - longTasksBeforeLcp.length * 50);

    // Correlate LCP resource timing from performance resource timeline
    let lcpRequestStart = 'N/A';
    let lcpResourceCompletion = 'N/A';
    let lcpRenderDelay = 0;

    if (lcpEntry && lcpEntry.url) {
      // Find matching resource by URL
      const matchingRes = (metrics.resources || []).find((r) => r.name === lcpEntry.url);
      if (matchingRes) {
        lcpRequestStart = matchingRes.startTime;
        lcpResourceCompletion = matchingRes.responseEnd;
        lcpRenderDelay = Math.max(0, Math.round(lcp - matchingRes.responseEnd));
      }
    } else {
      lcpRequestStart = 'N/A (Inline DOM)';
      lcpResourceCompletion = 'N/A (Inline DOM)';
      lcpRenderDelay = 0;
    }

    let totalBytes = 0;
    const reqList = Array.from(requests.values());
    for (const r of reqList) {
      if (r.transferSize) totalBytes += r.transferSize;
    }

    return {
      ttfb,
      fcp,
      lcp,
      cls: Number(metrics.cls.toFixed(4)),
      tbt,
      longTasksBeforeLcpCount: longTasksBeforeLcp.length,
      jsTasksBeforeLcp,
      totalBytes,
      requestCount: reqList.length,
      lcpElement: lcpEntry,
      lcpRequestStart,
      lcpResourceCompletion,
      lcpRenderDelay,
      headPreloads: metrics.headPreloads || [],
      headPreconnects: metrics.headPreconnects || [],
    };
  } finally {
    try {
      ws.close();
      await fetch(`http://127.0.0.1:${chromePort}/json/close/${target.id}`, { method: 'PUT' });
    } catch (_) {}
  }
}

async function main() {
  console.log('======================================================================');
  console.log('🔬 GERKINK P1 Post-Optimization Forensic Remeasurement');
  console.log(`Server: ${TEST_HOST} (Compiled Production Server)`);
  console.log('Profile: Mobile Slow 4G (150ms RTT, 1.638 Mbps down, 0.75 Mbps up, CPU 4x)');
  console.log('Methodology: 3 runs per route, clean incognito context, CDP instrumentation');
  console.log('======================================================================\n');

  // Load P0 baseline
  const p0ReportPath = path.resolve('scripts/production-performance-report.json');
  let p0Data = null;
  if (fs.existsSync(p0ReportPath)) {
    p0Data = JSON.parse(fs.readFileSync(p0ReportPath, 'utf8'));
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const chromePort = chrome.port;
  const results = {};

  try {
    for (const route of TARGET_ROUTES) {
      const fullUrl = `${TEST_HOST}${route.path}`;
      console.log(`▶ Auditing [${route.name}] (${fullUrl})...`);
      const runs = [];

      for (let r = 1; r <= 3; r++) {
        process.stdout.write(`   Run ${r}/3... `);
        try {
          const m = await runAudit(fullUrl, chromePort);
          runs.push(m);
          console.log(`FCP: ${m.fcp}ms | LCP: ${m.lcp}ms | Element: <${m.lcpElement?.tagName}>.${m.lcpElement?.selector} | TBT: ${m.tbt}ms`);
        } catch (e) {
          console.log(`ERROR: ${e.message}`);
        }
      }

      if (runs.length) {
        // Extract medians
        const fcpMedian = calculateMedian(runs.map((r) => r.fcp));
        const lcpMedian = calculateMedian(runs.map((r) => r.lcp));
        const tbtMedian = calculateMedian(runs.map((r) => r.tbt));
        const totalBytesMedian = calculateMedian(runs.map((r) => r.totalBytes));
        const requestCountMedian = calculateMedian(runs.map((r) => r.requestCount));
        const longTasksCountMedian = calculateMedian(runs.map((r) => r.longTasksBeforeLcpCount));
        const lcpRenderDelayMedian = calculateMedian(runs.map((r) => (typeof r.lcpRenderDelay === 'number' ? r.lcpRenderDelay : 0)));

        // For request start and completion, filter numeric values
        const numericReqStarts = runs.map((r) => r.lcpRequestStart).filter((v) => typeof v === 'number');
        const lcpRequestStartMedian = numericReqStarts.length ? calculateMedian(numericReqStarts) : 'N/A (Inline DOM)';

        const numericCompletions = runs.map((r) => r.lcpResourceCompletion).filter((v) => typeof v === 'number');
        const lcpResourceCompletionMedian = numericCompletions.length ? calculateMedian(numericCompletions) : 'N/A (Inline DOM)';

        // Best representative LCP element (from run closest to median LCP)
        let bestRun = runs[0];
        let minDiff = Infinity;
        for (const run of runs) {
          const diff = Math.abs(run.lcp - lcpMedian);
          if (diff < minDiff) {
            minDiff = diff;
            bestRun = run;
          }
        }

        results[route.slug] = {
          name: route.name,
          path: route.path,
          median: {
            fcp: fcpMedian,
            lcp: lcpMedian,
            lcpElement: bestRun.lcpElement,
            lcpRequestStart: lcpRequestStartMedian,
            lcpResourceCompletion: lcpResourceCompletionMedian,
            lcpRenderDelay: lcpRenderDelayMedian,
            tbt: tbtMedian,
            longTasksBeforeLcpCount: longTasksCountMedian,
            totalBytes: totalBytesMedian,
            requestCount: requestCountMedian,
            cls: Number((runs.reduce((a, b) => a + b.cls, 0) / runs.length).toFixed(4)),
            headPreloads: bestRun.headPreloads,
            headPreconnects: bestRun.headPreconnects,
          },
          runs,
        };
      }
    }
  } finally {
    try {
      await chrome.kill();
    } catch (_) {}
  }

  const outputPath = 'scripts/p1-remeasurement-full.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
