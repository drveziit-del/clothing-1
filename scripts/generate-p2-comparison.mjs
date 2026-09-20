import fs from 'fs';
import path from 'path';

const p0Path = path.resolve('scripts/production-performance-report.json');
const p1Path = path.resolve('scripts/p1-remeasurement-full.json');
const p2Path = path.resolve('scripts/p2-remeasurement-full.json');

if (!fs.existsSync(p0Path) || !fs.existsSync(p1Path) || !fs.existsSync(p2Path)) {
  console.log('Waiting for all data files to exist.');
  process.exit(0);
}

const p0 = JSON.parse(fs.readFileSync(p0Path, 'utf8'));
const p1 = JSON.parse(fs.readFileSync(p1Path, 'utf8'));
const p2 = JSON.parse(fs.readFileSync(p2Path, 'utf8'));

console.log('# GERKINK — Comprehensive P0 vs P1 vs P2 Performance Evolution\n');

for (const [slug, p2Route] of Object.entries(p2)) {
  const p0Route = p0.pages[slug];
  const p1Route = p1[slug];
  if (!p0Route || !p1Route) continue;

  const p0Med = p0Route.mobileMedian;
  const p1Med = p1Route.median;
  const p2Med = p2Route.median;

  console.log(`### Route: ${p2Route.name} (\`${p2Route.path}\`)`);
  console.log('| Metric | P0 Baseline | P1 Result | P2 Post-Optimization | Delta vs P0 | Delta vs P1 | Notes / Evidence |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :--- |');

  const fcpDeltaP0 = p2Med.fcp - p0Med.fcp;
  const fcpDeltaP1 = p2Med.fcp - p1Med.fcp;

  const lcpDeltaP0 = p2Med.lcp - p0Med.lcp;
  const lcpDeltaP1 = p2Med.lcp - p1Med.lcp;

  const tbt0 = p0Med.tbtEstimated ?? 0;
  const tbt1 = p1Med.tbt ?? 0;
  const tbt2 = p2Med.tbt ?? 0;
  const tbtDeltaP0 = tbt2 - tbt0;
  const tbtDeltaP1 = tbt2 - tbt1;

  const tasks0 = p0Med.longTasksCount ?? 0;
  const tasks1 = p1Med.longTasksBeforeLcpCount ?? 0;
  const tasks2 = p2Med.longTasksBeforeLcpCount ?? 0;
  const tasksDeltaP0 = tasks2 - tasks0;
  const tasksDeltaP1 = tasks2 - tasks1;

  console.log(`| **FCP** | ${p0Med.fcp} ms | ${p1Med.fcp} ms | **${p2Med.fcp} ms** | ${fcpDeltaP0 > 0 ? '+' : ''}${fcpDeltaP0} ms | ${fcpDeltaP1 > 0 ? '+' : ''}${fcpDeltaP1} ms | ${p2Med.fcp < p0Med.fcp ? 'Faster' : 'Stable'} |`);
  console.log(`| **LCP** | ${p0Med.lcp} ms | ${p1Med.lcp} ms | **${p2Med.lcp} ms** | ${lcpDeltaP0 > 0 ? '+' : ''}${lcpDeltaP0} ms | ${lcpDeltaP1 > 0 ? '+' : ''}${lcpDeltaP1} ms | ${p2Med.lcp < p1Med.lcp ? 'Major Improvement' : 'Evaluated'} |`);
  console.log(`| **LCP Element** | \`${p0Med.lcpElement?.selector || 'N/A'}\` | \`${p1Med.lcpElement?.selector || 'N/A'}\` | \`${p2Med.lcpElement?.selector || 'N/A'}\` | — | — | Tag: <${p2Med.lcpElement?.tagName}> |`);
  console.log(`| **LCP Request Start** | ${p0Med.lcpElement?.isText ? 'N/A' : p0Med.lcpElement?.startTime + ' ms'} | ${typeof p1Med.lcpRequestStart === 'number' ? p1Med.lcpRequestStart + ' ms' : p1Med.lcpRequestStart} | ${typeof p2Med.lcpRequestStart === 'number' ? p2Med.lcpRequestStart + ' ms' : p2Med.lcpRequestStart} | — | — | Resource start |`);
  console.log(`| **LCP Resource Completion** | ${p0Med.lcpElement?.isText ? 'N/A' : p0Med.lcpElement?.loadTime + ' ms'} | ${typeof p1Med.lcpResourceCompletion === 'number' ? p1Med.lcpResourceCompletion + ' ms' : p1Med.lcpResourceCompletion} | ${typeof p2Med.lcpResourceCompletion === 'number' ? p2Med.lcpResourceCompletion + ' ms' : p2Med.lcpResourceCompletion} | — | — | Network completion |`);
  console.log(`| **LCP Render Delay** | ${p0Med.lcpElement?.renderDelay ?? 0} ms | ${p1Med.lcpRenderDelay} ms | **${p2Med.lcpRenderDelay} ms** | — | ${p2Med.lcpRenderDelay - p1Med.lcpRenderDelay} ms | Post-resource delay |`);
  console.log(`| **TBT** | ${tbt0} ms | ${tbt1} ms | **${tbt2} ms** | ${tbtDeltaP0 > 0 ? '+' : ''}${tbtDeltaP0} ms | ${tbtDeltaP1 > 0 ? '+' : ''}${tbtDeltaP1} ms | Blocking main thread |`);
  console.log(`| **Long Tasks before LCP** | ${tasks0} | ${tasks1} | **${tasks2}** | ${tasksDeltaP0 > 0 ? '+' : ''}${tasksDeltaP0} | ${tasksDeltaP1 > 0 ? '+' : ''}${tasksDeltaP1} | Pre-LCP tasks |`);
  console.log(`| **Total Transferred** | ${Math.round(p0Med.totalBytes / 1024)} KiB | ${Math.round(p1Med.totalBytes / 1024)} KiB | **${Math.round(p2Med.totalBytes / 1024)} KiB** | — | — | Payload size |`);
  console.log(`| **Requests** | ${p0Med.requestCount} | ${p1Med.requestCount} | **${p2Med.requestCount}** | — | — | HTTP requests |`);
  console.log('\n');
}
