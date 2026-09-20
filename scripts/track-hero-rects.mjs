import * as chromeLauncher from 'chrome-launcher';

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
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, connectionType: 'cellular4g' });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await send('Page.navigate', { url: 'http://127.0.0.1:3005/shop/valueless-bitches' });

    for (let t = 1000; t <= 5000; t += 500) {
      await new Promise((r) => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const badge = document.querySelector('[class*="badgeRow"]');
          const title = document.querySelector('[class*="page_title"]');
          const desc = document.querySelector('[class*="page_desc"]');
          const hero = document.querySelector('[class*="page_hero__"]');
          return JSON.stringify({
            t: ${t},
            badge: badge ? badge.getBoundingClientRect() : null,
            title: title ? title.getBoundingClientRect() : null,
            desc: desc ? desc.getBoundingClientRect() : null,
            hero: hero ? hero.getBoundingClientRect() : null,
          });
        })()`,
        returnByValue: true,
      });
      console.log(`t=${t}:`, res.result.value);
    }
  } finally {
    try {
      ws.close();
      await chrome.kill();
    } catch (_) {}
  }
}

main().catch(console.error);
