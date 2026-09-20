import * as chromeLauncher from 'chrome-launcher';

async function test() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  console.log('Chrome launched on port:', chrome.port);

  try {
    const res = await fetch(`http://127.0.0.1:${chrome.port}/json/version`);
    const data = await res.json();
    console.log('CDP Browser:', data.Browser);

    const targetRes = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetRes.json();
    console.log('Target created:', target.id);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    console.log('Connected to Target WebSocket!');

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const d = JSON.parse(event.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(d.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });

    // Emulate Slow 4G: 150ms latency, 1.638 Mbps down, 0.75 Mbps up
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1638.4 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      connectionType: 'cellular4g',
    });

    // CPU 4x throttling
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Inject performance observer for LCP before any scripts load
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__lcp_entries = [];
        window.__long_tasks = [];
        window.__cls_entries = [];

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__lcp_entries.push({
              renderTime: entry.renderTime,
              loadTime: entry.loadTime,
              startTime: entry.startTime,
              size: entry.size,
              id: entry.id,
              url: entry.url,
              tagName: entry.element ? entry.element.tagName : null,
              selector: entry.element ? (entry.element.className ? entry.element.tagName + '.' + String(entry.element.className).trim().replace(/\\s+/g, '.') : entry.element.tagName) : null,
              outerHTML: entry.element ? entry.element.outerHTML.slice(0, 300) : null
            });
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            window.__long_tasks.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
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
      `
    });

    console.log('Navigating to https://gerkink.shop ...');
    await send('Page.navigate', { url: 'https://gerkink.shop' });

    // Wait 12 seconds for full mobile render & LCP stability
    await new Promise(r => setTimeout(r, 12000));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        JSON.stringify({
          nav: performance.getEntriesByType('navigation')[0],
          fcp: performance.getEntriesByName('first-contentful-paint')[0],
          lcpCandidates: window.__lcp_entries,
          longTasks: window.__long_tasks,
          cls: window.__cls_entries.reduce((a, b) => a + b, 0),
          resources: performance.getEntriesByType('resource').map(r => ({
            name: r.name,
            initiatorType: r.initiatorType,
            transferSize: r.transferSize,
            duration: r.duration,
            startTime: r.startTime,
            responseEnd: r.responseEnd
          }))
        })
      `,
      returnByValue: true,
    });

    const result = JSON.parse(evalRes.result.value);
    console.log('\n=== DIRECT FORENSIC CAPTURE ===');
    console.log('TTFB (nav.responseStart):', Math.round(result.nav?.responseStart), 'ms');
    console.log('DOM Interactive:', Math.round(result.nav?.domInteractive), 'ms');
    console.log('FCP:', Math.round(result.fcp?.startTime), 'ms');
    console.log('CLS:', result.cls.toFixed(4));
    console.log('Long Tasks Count:', result.longTasks.length);
    console.log('Total Long Task Time:', Math.round(result.longTasks.reduce((a, b) => a + b.duration, 0)), 'ms');
    console.log('LCP Candidates:', JSON.stringify(result.lcpCandidates, null, 2));

    ws.close();
  } finally {
    try { await chrome.kill(); } catch (_) {}
  }
}

test().catch(console.error);
