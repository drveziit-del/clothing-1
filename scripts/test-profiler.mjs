import * as chromeLauncher from 'chrome-launcher';

async function test() {
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
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 15000);
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
    await send('Profiler.enable');
    await send('Network.enable');

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

    console.log('Starting CPU Profiler...');
    await send('Profiler.start');
    await send('Page.navigate', { url: 'http://127.0.0.1:3005/' });

    await new Promise((r) => setTimeout(r, 6000));

    console.log('Stopping CPU Profiler...');
    const prof = await send('Profiler.stop');
    console.log('Profiler captured nodes:', prof.profile.nodes.length);
    console.log('Total samples:', prof.profile.samples.length);

    // Aggregate function execution time
    const nodeTimes = new Map();
    const samples = prof.profile.samples;
    const timeDeltas = prof.profile.timeDeltas;

    let totalDuration = 0;
    for (let i = 0; i < samples.length; i++) {
      const nodeId = samples[i];
      const delta = (timeDeltas[i] || 0) / 1000; // ms
      totalDuration += delta;
      nodeTimes.set(nodeId, (nodeTimes.get(nodeId) || 0) + delta);
    }

    console.log('Total profiled JS time:', Math.round(totalDuration), 'ms');

    // Find top functions
    const nodes = prof.profile.nodes;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const aggregated = [];
    for (const [nodeId, time] of nodeTimes.entries()) {
      const node = nodeMap.get(nodeId);
      if (node && node.callFrame) {
        aggregated.push({
          name: node.callFrame.functionName || '(anonymous)',
          url: node.callFrame.url,
          line: node.callFrame.lineNumber,
          time: Math.round(time),
        });
      }
    }

    aggregated.sort((a, b) => b.time - a.time);
    console.log('\nTop 15 Main Thread Functions by Self-Time (ms):');
    aggregated.slice(0, 15).forEach(f => {
      const u = f.url ? f.url.split('/').slice(-2).join('/') : '';
      console.log(`  ${f.time}ms: ${f.name} (${u}:${f.line})`);
    });

  } finally {
    try {
      ws.close();
      await chrome.kill();
    } catch (_) {}
  }
}

test().catch(console.error);
