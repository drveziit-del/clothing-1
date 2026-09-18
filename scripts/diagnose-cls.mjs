import * as chromeLauncher from 'chrome-launcher';

const TEST_HOST = 'http://127.0.0.1:3005';
const ROUTES_TO_DIAGNOSE = [
  { slug: 'valueless-bitches', path: '/shop/valueless-bitches' },
  { slug: 'home', path: '/' },
  { slug: 'shop', path: '/shop' },
];

async function diagnoseRoute(route, chromePort) {
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
      }, 30000);
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
        window.__cls_diagnostics = [];
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              const sources = [];
              if (entry.sources) {
                for (const s of entry.sources) {
                  const node = s.node;
                  sources.push({
                    tagName: node ? node.tagName : 'UNKNOWN',
                    className: node && node.className ? String(node.className) : '',
                    id: node ? node.id : '',
                    nodeSnippet: node ? (node.outerHTML ? node.outerHTML.slice(0, 200) : '') : '',
                    previousRect: s.previousRect ? {
                      x: s.previousRect.x,
                      y: s.previousRect.y,
                      width: s.previousRect.width,
                      height: s.previousRect.height,
                    } : null,
                    currentRect: s.currentRect ? {
                      x: s.currentRect.x,
                      y: s.currentRect.y,
                      width: s.currentRect.width,
                      height: s.currentRect.height,
                    } : null,
                  });
                }
              }
              window.__cls_diagnostics.push({
                value: entry.value,
                startTime: Math.round(entry.startTime),
                sources: sources
              });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      `,
    });

    await send('Page.navigate', { url: `${TEST_HOST}${route.path}` });
    await new Promise((r) => setTimeout(r, 12000));

    const evalRes = await send('Runtime.evaluate', {
      expression: `JSON.stringify(window.__cls_diagnostics || [])`,
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
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  console.log('====================================================');
  console.log('🔍 CLS Forensic Diagnosis on Mobile Slow 4G');
  console.log('====================================================\n');

  try {
    for (const r of ROUTES_TO_DIAGNOSE) {
      console.log(`Auditing ${r.path}...`);
      const shifts = await diagnoseRoute(r, chrome.port);
      const totalCls = shifts.reduce((acc, s) => acc + s.value, 0);
      console.log(`-> Total CLS: ${totalCls.toFixed(4)} (${shifts.length} shift entries)`);
      shifts.forEach((s, i) => {
        console.log(`   [Shift ${i + 1}] Time: ${s.startTime}ms | Score: ${s.value.toFixed(4)}`);
        s.sources.forEach((src, j) => {
          console.log(`      Source ${j + 1}: <${src.tagName}> .${src.className} #${src.id}`);
          console.log(`         Prev Rect:`, JSON.stringify(src.previousRect));
          console.log(`         Curr Rect:`, JSON.stringify(src.currentRect));
          console.log(`         Snippet:`, src.nodeSnippet);
        });
      });
      console.log('\n');
    }
  } finally {
    try {
      await chrome.kill();
    } catch (_) {}
  }
}

main().catch(console.error);
