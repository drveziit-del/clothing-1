import fs from 'fs';
import path from 'path';

const p0Path = path.resolve('scripts/production-performance-report.json');
const p1Path = path.resolve('scripts/p1-remeasurement-full.json');

const p0 = JSON.parse(fs.readFileSync(p0Path, 'utf8'));
const p1 = JSON.parse(fs.readFileSync(p1Path, 'utf8'));

console.log('# GERKINK — P0 Baseline vs P1 Post-Optimization Remeasurement\n');

for (const [slug, p1Route] of Object.entries(p1)) {
  const p0Route = p0.pages[slug];
  if (!p0Route) continue;

  const p0Med = p0Route.mobileMedian;
  const p1Med = p1Route.median;

  console.log(`### Route: ${p1Route.name} (\`${p1Route.path}\`)`);
  console.log('| Metric | P0 Baseline | P1 Post-Optimization | Delta | Notes / Evidence |');
  console.log('| :--- | :---: | :---: | :---: | :--- |');

  const fcpDelta = p1Med.fcp - p0Med.fcp;
  const lcpDelta = p1Med.lcp - p0Med.lcp;
  const tbt0 = p0Med.tbtEstimated ?? 0;
  const tbt1 = p1Med.tbt ?? 0;
  const tbtDelta = tbt1 - tbt0;
  const bytesDelta = p1Med.totalBytes - p0Med.totalBytes;
  const reqDelta = p1Med.requestCount - p0Med.requestCount;
  const tasksDelta = p1Med.longTasksBeforeLcpCount - (p0Med.longTasksCount ?? 0);

  console.log(`| **FCP** | ${p0Med.fcp} ms | ${p1Med.fcp} ms | ${fcpDelta > 0 ? '+' : ''}${fcpDelta} ms | ${fcpDelta < 0 ? 'Improved' : (fcpDelta === 0 ? 'Unchanged' : 'Regression/Jitter')} |`);
  console.log(`| **LCP** | ${p0Med.lcp} ms | ${p1Med.lcp} ms | ${lcpDelta > 0 ? '+' : ''}${lcpDelta} ms | ${lcpDelta < 0 ? 'Improved' : (lcpDelta === 0 ? 'Unchanged' : 'Regression/Jitter')} |`);
  console.log(`| **LCP Element** | \`${p0Med.lcpElement?.selector || 'N/A'}\` | \`${p1Med.lcpElement?.selector || 'N/A'}\` | ${p0Med.lcpElement?.selector === p1Med.lcpElement?.selector ? 'Unchanged' : 'Changed'} | Type: ${p1Med.lcpElement?.isText ? 'Text' : 'Image'} |`);
  console.log(`| **LCP Request Start** | ${p0Med.lcpElement?.isText ? 'N/A (Inline DOM)' : (p0Med.lcpElement?.startTime || 'N/A')} | ${p1Med.lcpRequestStart} ${typeof p1Med.lcpRequestStart === 'number' ? 'ms' : ''} | — | Discovery timing |`);
  console.log(`| **LCP Resource Completion** | ${p0Med.lcpElement?.isText ? 'N/A (Inline DOM)' : (p0Med.lcpElement?.loadTime || 'N/A')} | ${p1Med.lcpResourceCompletion} ${typeof p1Med.lcpResourceCompletion === 'number' ? 'ms' : ''} | — | Network completion |`);
  console.log(`| **LCP Render Delay** | ${p0Med.lcpElement?.renderDelay ?? 0} ms | ${p1Med.lcpRenderDelay} ms | ${p1Med.lcpRenderDelay - (p0Med.lcpElement?.renderDelay ?? 0)} ms | Paint delay after resource |`);
  console.log(`| **TBT** | ${tbt0} ms | ${tbt1} ms | ${tbtDelta > 0 ? '+' : ''}${tbtDelta} ms | ${tbtDelta < 0 ? 'Improved' : 'Stable'} |`);
  console.log(`| **Long Tasks before LCP** | ${p0Med.longTasksCount ?? 0} | ${p1Med.longTasksBeforeLcpCount} | ${tasksDelta > 0 ? '+' : ''}${tasksDelta} | Main-thread blocking tasks |`);
  console.log(`| **Total Transferred** | ${Math.round(p0Med.totalBytes / 1024)} KiB | ${Math.round(p1Med.totalBytes / 1024)} KiB | ${bytesDelta > 0 ? '+' : ''}${Math.round(bytesDelta / 1024)} KiB | Payload transfer size |`);
  console.log(`| **Requests** | ${p0Med.requestCount} | ${p1Med.requestCount} | ${reqDelta > 0 ? '+' : ''}${reqDelta} | Total HTTP requests |`);
  console.log('\n');
}
