import * as chromeLauncher from 'chrome-launcher';

const instrumentSource = `
  window.__nav_events = window.__nav_events || [];
  window.__active_transition = window.__active_transition || null;
  window.__network_requests = window.__network_requests || [];
  window.__long_tasks = window.__long_tasks || [];

  if (!window.__long_task_observer_installed) {
    window.__long_task_observer_installed = true;
    try {
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          window.__long_tasks.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
          if (window.__active_transition) {
            window.__active_transition.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch (e) {}
  }

  if (!window.__mutation_observer_installed) {
    window.__mutation_observer_installed = true;
    const obs = new MutationObserver((mutations) => {
      const now = performance.now();
      if (!window.__active_transition) return;

      // Check for loading skeleton or spinner
      const loadingEl = document.querySelector('[aria-label="Loading page content"], [aria-label="Loading"]');
      if (loadingEl && !window.__active_transition.loadingSeen) {
        window.__active_transition.loadingSeen = true;
        window.__active_transition.loadingStartTime = now;
      } else if (!loadingEl && window.__active_transition.loadingSeen && !window.__active_transition.loadingEndTime) {
        window.__active_transition.loadingEndTime = now;
      }

      // Check for splash overlay flash
      const splashEl = document.querySelector('[class*="LoadingScreen_screen"]');
      if (splashEl) {
        window.__active_transition.splashSeen = true;
      }

      if (window.__active_transition.targetSelector) {
        const target = document.querySelector(window.__active_transition.targetSelector);
        if (target && !window.__active_transition.targetRenderTime) {
          window.__active_transition.targetRenderTime = now;
        }
      }
    });

    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  window.__startTransitionMeasurement = function(name, targetSelector) {
    const now = performance.now();
    window.__active_transition = {
      name: name,
      targetSelector: targetSelector,
      startTime: now,
      startPathname: window.location.pathname,
      endPathname: null,
      pathnameChangeTime: null,
      targetRenderTime: null,
      loadingSeen: false,
      loadingStartTime: null,
      loadingEndTime: null,
      splashSeen: false,
      longTasks: [],
      completed: false,
      endTime: null
    };

    const check = () => {
      if (!window.__active_transition) return;
      if (window.location.pathname !== window.__active_transition.startPathname && !window.__active_transition.pathnameChangeTime) {
        window.__active_transition.pathnameChangeTime = performance.now();
        window.__active_transition.endPathname = window.location.pathname;
      }
      if (!window.__active_transition.completed) {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  };

  window.__endTransitionMeasurement = function() {
    if (!window.__active_transition) return null;
    const now = performance.now();
    window.__active_transition.completed = true;
    window.__active_transition.endTime = now;
    const result = Object.assign({}, window.__active_transition);
    window.__nav_events.push(result);
    window.__active_transition = null;
    return result;
  };
`;

async function runAudit() {
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
    await send('Network.enable');
    await send('Runtime.enable');

    async function ensureInstrumented() {
      const res = await send('Runtime.evaluate', { expression: instrumentSource });
      if (res.exceptionDetails) {
        console.error('Instrumentation error:', res.exceptionDetails);
      }
    }

    async function measureStep(stepName, clickSelector, targetSelector, isBack = false, isForward = false) {
      console.log(`\n--- Measuring: ${stepName} ---`);
      await ensureInstrumented();

      // Start measurement
      await send('Runtime.evaluate', {
        expression: `window.__startTransitionMeasurement(${JSON.stringify(stepName)}, ${JSON.stringify(targetSelector)})`
      });

      if (isBack) {
        console.log('Triggering history.back()...');
        await send('Runtime.evaluate', { expression: `history.back()` });
      } else if (isForward) {
        console.log('Triggering history.forward()...');
        await send('Runtime.evaluate', { expression: `history.forward()` });
      } else {
        const clickResult = await send('Runtime.evaluate', {
          expression: `
            (() => {
              const el = document.querySelector(${JSON.stringify(clickSelector)});
              if (!el) return { error: 'Element not found: ' + ${JSON.stringify(clickSelector)} };
              el.scrollIntoView({ behavior: 'instant', block: 'center' });
              el.click();
              return { success: true, href: el.getAttribute('href') };
            })()
          `,
          returnByValue: true
        });
        if (clickResult.result?.value?.error) {
          console.error(`Click failed: ${clickResult.result.value.error}`);
        } else {
          console.log(`Clicked ${clickSelector}, target href: ${clickResult.result?.value?.href}`);
        }
      }

      // Wait for navigation and rendering to settle
      await new Promise(r => setTimeout(r, 1500));

      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const res = (typeof window.__endTransitionMeasurement === 'function')
              ? window.__endTransitionMeasurement()
              : { error: 'endTransition not a function' };
            const currentPath = window.location.pathname;
            const targetEl = ${JSON.stringify(targetSelector)} ? document.querySelector(${JSON.stringify(targetSelector)}) : null;
            return JSON.stringify({
              ...res,
              currentPath,
              targetFound: !!targetEl,
              mainHtmlSnippet: document.querySelector('main')?.innerHTML?.slice(0, 150)
            });
          })()
        `,
        returnByValue: true
      });

      if (!evalRes?.result?.value) {
        console.error('Empty eval result:', evalRes);
        return { stepName, error: 'Empty evaluation result' };
      }

      const data = JSON.parse(evalRes.result.value);
      if (data.error) {
        console.error(`Step ${stepName} encountered error:`, data.error);
        return { stepName, error: data.error };
      }

      const clickToPathname = data.pathnameChangeTime ? Math.round(data.pathnameChangeTime - data.startTime) : 'N/A';
      const clickToRender = data.targetRenderTime ? Math.round(data.targetRenderTime - data.startTime) : 'N/A';
      const totalDuration = Math.round(data.endTime - data.startTime);
      const loadingDuration = data.loadingStartTime && data.loadingEndTime ? Math.round(data.loadingEndTime - data.loadingStartTime) : (data.loadingStartTime ? 'still loading' : 'none');
      const longTaskTotal = Math.round((data.longTasks || []).reduce((a, b) => a + b.duration, 0));

      console.log(`Result for ${stepName}:`);
      console.log(`  Path change: ${data.startPathname} -> ${data.currentPath}`);
      console.log(`  Click-to-pathname: ${clickToPathname} ms`);
      console.log(`  Click-to-render: ${clickToRender} ms`);
      console.log(`  Loading fallback visible: ${data.loadingSeen}`);
      console.log(`  Splash screen seen: ${data.splashSeen}`);
      console.log(`  Long tasks count: ${data.longTasks?.length || 0} (Total: ${longTaskTotal} ms)`);
      console.log(`  Target element found: ${data.targetFound}`);

      return {
        stepName,
        fromPath: data.startPathname,
        toPath: data.currentPath,
        clickToPathname,
        clickToRender,
        loadingSeen: data.loadingSeen,
        splashSeen: data.splashSeen,
        longTaskTotal,
        longTasksCount: data.longTasks?.length || 0,
      };
    }

    console.log('\n========================================');
    console.log('STARTING RE-MEASUREMENT AUDIT (DESKTOP)');
    console.log('========================================');

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('Navigating to http://127.0.0.1:3005 ...');
    await send('Page.navigate', { url: 'http://127.0.0.1:3005' });
    await new Promise(r => setTimeout(r, 4000));
    await ensureInstrumented();

    const results = [];

    // 1. Home -> Shop
    results.push(await measureStep('1. Home -> Shop', 'nav[aria-label="Main navigation"] a[href="/shop"]', 'h1'));

    // 2. Shop -> Valueless Bitches
    results.push(await measureStep('2. Shop -> Valueless Bitches', 'a[href="/shop/valueless-bitches"]', 'h1'));

    // 3. Collection -> Product Detail
    results.push(await measureStep('3. Collection -> Product Detail', 'a[href*="/shop/"] h3 a, a[href^="/shop/"]', 'h1'));

    // 4. Product -> Cart
    results.push(await measureStep('4. Product -> Cart', 'a[href="/cart"]', 'h1'));

    // 5. Back: Cart -> Product
    results.push(await measureStep('5. Back: Cart -> Product', null, 'h1', true, false));

    // 6. Forward: Product -> Cart
    results.push(await measureStep('6. Forward: Product -> Cart', null, 'h1', false, true));

    // 7. Back to Shop
    await send('Runtime.evaluate', { expression: `window.location.href = '/shop'` });
    await new Promise(r => setTimeout(r, 1500));
    await ensureInstrumented();

    // 8. Shop -> Society Fuckers
    results.push(await measureStep('8. Shop -> Society Fuckers', 'a[href="/shop/society-fuckers"]', 'h1'));

    // 9. Back: Society Fuckers -> Shop
    results.push(await measureStep('9. Back: Society Fuckers -> Shop', null, 'h1', true, false));

    // 10. Back: Shop -> Home (Check for splash flash)
    results.push(await measureStep('10. Back: Shop -> Home', null, 'h1', true, false));

    console.log('\n========================================');
    console.log('STARTING RE-MEASUREMENT AUDIT (MOBILE)');
    console.log('========================================');

    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });

    await send('Page.navigate', { url: 'http://127.0.0.1:3005' });
    await new Promise(r => setTimeout(r, 3000));
    await ensureInstrumented();

    // Open hamburger
    await send('Runtime.evaluate', { expression: `document.querySelector('button[aria-label="Toggle navigation"]')?.click()` });
    await new Promise(r => setTimeout(r, 400));

    // Mobile 1: Home -> Shop
    results.push(await measureStep('Mobile 1. Home -> Shop', '#mobile-navigation-menu a[href="/shop"]', 'h1'));

    // Mobile 2: Shop -> Valueless Bitches
    results.push(await measureStep('Mobile 2. Shop -> Valueless Bitches', 'a[href="/shop/valueless-bitches"]', 'h1'));

    // Mobile 3: Collection -> Product Detail
    results.push(await measureStep('Mobile 3. Collection -> Product Detail', 'a[href*="/shop/"] h3 a, a[href^="/shop/"]', 'h1'));

    // Mobile 4: Back: Product Detail -> Collection
    results.push(await measureStep('Mobile 4. Back: Product Detail -> Collection', null, 'h1', true, false));

    // Mobile 5: Back: Collection -> Shop
    results.push(await measureStep('Mobile 5. Back: Collection -> Shop', null, 'h1', true, false));

    // Mobile 6: Back: Shop -> Home
    results.push(await measureStep('Mobile 6. Back: Shop -> Home', null, 'h1', true, false));

    console.log('\n========================================');
    console.log('RE-MEASUREMENT AUDIT SUMMARY');
    console.log('========================================');
    console.table(results);

    ws.close();
  } finally {
    try { await chrome.kill(); } catch (_) {}
  }
}

runAudit().catch(console.error);
