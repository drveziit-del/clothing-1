import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

async function main() {
  console.log('Launching Chrome...');
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-extensions', '--incognito'],
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  try {
    console.log('Running Lighthouse on https://gerkink.shop ...');
    const options = {
      port: chrome.port,
      onlyCategories: ['performance'],
      output: 'json',
      logLevel: 'error',
    };

    const runnerResult = await lighthouse('https://gerkink.shop', options);
    const lhr = runnerResult.lhr;
    const a = lhr.audits;

    console.log('\n--- AUDIT RESULTS ---');
    console.log('Performance Score:', Math.round(lhr.categories.performance.score * 100));
    console.log('FCP:', a['first-contentful-paint'].displayValue);
    console.log('LCP:', a['largest-contentful-paint'].displayValue);
    console.log('TBT:', a['total-blocking-time'].displayValue);
    console.log('CLS:', a['cumulative-layout-shift'].displayValue);
    console.log('Speed Index:', a['speed-index'].displayValue);
    console.log('TTFB:', a['server-response-time'].displayValue);
    console.log('Total Byte Weight:', a['total-byte-weight'].displayValue);
    console.log('Mainthread Work:', a['mainthread-work-breakdown'].displayValue);
  } finally {
    try {
      await chrome.kill();
    } catch (err) {
      console.warn('Chrome kill warning (safe to ignore):', err.message);
    }
  }
}

main().catch(console.error);
