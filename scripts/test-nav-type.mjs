import * as chromeLauncher from 'chrome-launcher';

async function test() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  try {
    const targetRes = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (event) => {
          const d = JSON.parse(event.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(d.result || d);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:3005' });
    await new Promise(r => setTimeout(r, 3000));

    // Set a canary on window
    await send('Runtime.evaluate', { expression: `window.__CANARY = Math.random(); console.log('Canary set:', window.__CANARY);` });

    const before = await send('Runtime.evaluate', { expression: `window.__CANARY`, returnByValue: true });
    console.log('Canary before click:', before.result.value);

    // Click the shop link
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('nav[aria-label="Main navigation"] a[href="/shop"]');
          if (!el) return 'NOT_FOUND';
          el.click();
          return 'CLICKED';
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result.value);

    await new Promise(r => setTimeout(r, 2000));

    const after = await send('Runtime.evaluate', {
      expression: `
        JSON.stringify({
          canary: window.__CANARY,
          pathname: window.location.pathname,
          navEntries: performance.getEntriesByType('navigation').map(n => ({ type: n.type, name: n.name }))
        })
      `,
      returnByValue: true
    });
    console.log('After navigation:', JSON.parse(after.result.value));

    ws.close();
  } finally {
    try { await chrome.kill(); } catch (_) {}
  }
}

test().catch(console.error);
