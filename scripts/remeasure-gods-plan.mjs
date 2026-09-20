import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';

const TEST_HOST = 'http://127.0.0.1:3005';
const url = `${TEST_HOST}/shop/gods-plan`;

function calculateMedian(arr) {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function runSingle(chromePort) {
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
      }, 45000);
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
          req.contentType = p.response.headers ? (p.response.headers['content-type'] || p.response.headers['Content-Type']) : '';
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

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
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
          images: Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            currentSrc: img.currentSrc,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            clientWidth: img.clientWidth,
            clientHeight: img.clientHeight,
            loading: img.loading,
            decoding: img.decoding,
            sizes: img.getAttribute('sizes') || '',
            className: img.className,
            inViewport: (function(el) {
              const rect = el.getBoundingClientRect();
              return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
            })(img)
          })),
          resources: performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            startTime: Math.round(r.startTime),
            responseStart: Math.round(r.responseStart),
            responseEnd: Math.round(r.responseEnd),
            duration: Math.round(r.duration),
            initiatorType: r.initiatorType,
            transferSize: r.transferSize,
            decodedBodySize: r.decodedBodySize
          })),
          cls: (window.__cls_entries || []).reduce((a, b) => a + b, 0),
          headPreloads: Array.from(document.querySelectorAll('link[rel="preload"]')).map(l => ({
            as: l.getAttribute('as'),
            href: l.getAttribute('href'),
            imageSrcSet: l.getAttribute('imagesrcset')
          })),
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

    let lcpRequestStart = 'N/A';
    let lcpResourceCompletion = 'N/A';
    let lcpRenderDelay = 0;
    let lcpImageDetails = null;

    if (lcpEntry && lcpEntry.url) {
      const matchingRes = (metrics.resources || []).find((r) => r.name === lcpEntry.url);
      if (matchingRes) {
        lcpRequestStart = matchingRes.startTime;
        lcpResourceCompletion = matchingRes.responseEnd;
        lcpRenderDelay = Math.max(0, Math.round(lcp - matchingRes.responseEnd));
      }
      const matchingImg = (metrics.images || []).find((img) => img.currentSrc === lcpEntry.url || img.src === lcpEntry.url);
      if (matchingImg) {
        lcpImageDetails = matchingImg;
      }
    }

    let totalBytes = 0;
    const reqList = Array.from(requests.values());
    for (const r of reqList) {
      if (r.transferSize) totalBytes += r.transferSize;
    }

    const imageAudits = (metrics.images || []).map((img) => {
      const matchingNetworkReq = reqList.find((r) => r.url === img.currentSrc || r.url === img.src);
      const matchingPerfRes = (metrics.resources || []).find((r) => r.name === img.currentSrc || r.name === img.src);
      return {
        ...img,
        mimeType: matchingNetworkReq ? (matchingNetworkReq.contentType || matchingNetworkReq.mimeType) : 'unknown',
        transferSize: matchingPerfRes ? matchingPerfRes.transferSize : (matchingNetworkReq ? matchingNetworkReq.transferSize : 0),
        startTime: matchingPerfRes ? matchingPerfRes.startTime : 'N/A',
        responseEnd: matchingPerfRes ? matchingPerfRes.responseEnd : 'N/A',
      };
    });

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
      lcpImageDetails,
      imageAudits,
      headPreloads: metrics.headPreloads || [],
    };
  } finally {
    try {
      ws.close();
      await fetch(`http://127.0.0.1:${chromePort}/json/close/${target.id}`, { method: 'PUT' });
    } catch (_) {}
  }
}

async function main() {
  console.log('▶ Re-auditing Gods Plan (3 clean runs)...');
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const runs = [];
  try {
    for (let r = 1; r <= 3; r++) {
      process.stdout.write(`   Run ${r}/3... `);
      try {
        const m = await runSingle(chrome.port);
        runs.push(m);
        console.log(`FCP: ${m.fcp}ms | LCP: ${m.lcp}ms | Element: <${m.lcpElement?.tagName}>.${m.lcpElement?.selector} | TBT: ${m.tbt}ms`);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
      }
    }
  } finally {
    try { await chrome.kill(); } catch (_) {}
  }

  if (runs.length) {
    const fcpMedian = calculateMedian(runs.map(r => r.fcp));
    const lcpMedian = calculateMedian(runs.map(r => r.lcp));
    const tbtMedian = calculateMedian(runs.map(r => r.tbt));
    console.log(`\nGods Plan Medians -> FCP: ${fcpMedian}ms | LCP: ${lcpMedian}ms | TBT: ${tbtMedian}ms`);

    // Update scripts/p5-remeasurement-full.json
    const fullJsonPath = 'scripts/p5-remeasurement-full.json';
    if (fs.existsSync(fullJsonPath)) {
      const data = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));
      data['gods-plan'] = {
        name: 'Product Detail (Gods Plan)',
        path: '/shop/gods-plan',
        median: {
          fcp: fcpMedian,
          lcp: lcpMedian,
          lcpElement: runs[0].lcpElement,
          lcpRequestStart: runs[0].lcpRequestStart,
          lcpResourceCompletion: runs[0].lcpResourceCompletion,
          lcpRenderDelay: runs[0].lcpRenderDelay,
          lcpImageDetails: runs[0].lcpImageDetails,
          tbt: tbtMedian,
          longTasksBeforeLcpCount: calculateMedian(runs.map(r => r.longTasksBeforeLcpCount)),
          totalBytes: calculateMedian(runs.map(r => r.totalBytes)),
          requestCount: calculateMedian(runs.map(r => r.requestCount)),
          cls: Number((runs.reduce((a, b) => a + b.cls, 0) / runs.length).toFixed(4)),
          headPreloads: runs[0].headPreloads,
          imageAudits: runs[0].imageAudits,
        },
        runs,
      };
      fs.writeFileSync(fullJsonPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Updated ${fullJsonPath} with 3 clean Gods Plan runs.`);
    }
  }
}

main().catch(console.error);
