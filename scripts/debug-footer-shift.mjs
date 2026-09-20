import * as chromeLauncher from 'chrome-launcher';

const TEST_HOST = 'http://127.0.0.1:3005/shop/valueless-bitches';

async function main() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const chromePort = chrome.port;
  const targetRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetRes.json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    try {
      const d = JSON.parse(event.data);
      if (d.id && pending.has(d.id)) {
        const { resolve } = pending.get(d.id);
        pending.delete(d.id);
        resolve(d.result);
      }
    } catch (_) {}
  };

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

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

    await send('Page.navigate', { url: TEST_HOST });

    // Poll every 500ms for 8 seconds
    for (let t = 500; t <= 8000; t += 500) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const footer = document.querySelector('footer');
            const main = document.querySelector('main');
            const hero = document.querySelector('[class*="hero"]');
            const grid = document.querySelector('[class*="grid"]');
            const cards = document.querySelectorAll('[class*="ProductCard_card"]');
            const fRect = footer ? footer.getBoundingClientRect() : null;
            const mRect = main ? main.getBoundingClientRect() : null;
            const hRect = hero ? hero.getBoundingClientRect() : null;
            const gRect = grid ? grid.getBoundingClientRect() : null;
            return JSON.stringify({
              time: ${t},
              cardCount: cards.length,
              footerY: fRect ? Math.round(fRect.top) : null,
              footerHeight: fRect ? Math.round(fRect.height) : null,
              mainHeight: mRect ? Math.round(mRect.height) : null,
              heroHeight: hRect ? Math.round(hRect.height) : null,
              gridHeight: gRect ? Math.round(gRect.height) : null,
              firstCardHeight: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : null
            });
          })()
        `,
        returnByValue: true,
      });
      console.log(`t=${t}ms:`, res.result.value);
    }
  } finally {
    ws.close();
    await chrome.kill();
  }
}

main().catch(console.error);
