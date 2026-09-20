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

    await new Promise((r) => setTimeout(r, 600));
    let res = await send('Runtime.evaluate', {
      expression: `(() => {
        const m = document.querySelector('main');
        return m ? m.innerHTML.slice(0, 500) : 'NO MAIN';
      })()`,
      returnByValue: true
    });
    console.log('t=600ms main innerHTML:');
    console.log(res.result.value);

    await new Promise((r) => setTimeout(r, 500));
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        const m = document.querySelector('main');
        return m ? m.innerHTML.slice(0, 500) : 'NO MAIN';
      })()`,
      returnByValue: true
    });
    console.log('\nt=1100ms main innerHTML:');
    console.log(res.result.value);

    await new Promise((r) => setTimeout(r, 600));
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        const m = document.querySelector('main');
        return m ? m.innerHTML.slice(0, 500) : 'NO MAIN';
      })()`,
      returnByValue: true
    });
    console.log('\nt=1700ms main innerHTML:');
    console.log(res.result.value);

  } finally {
    ws.close();
    await chrome.kill();
  }
}

main().catch(console.error);
