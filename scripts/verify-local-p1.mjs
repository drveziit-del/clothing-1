async function test() {
  const r1 = await fetch('http://127.0.0.1:3005/');
  const html1 = await r1.text();
  console.log('Homepage Preconnects in HTML:');
  const preconnects = html1.match(/<link[^>]+rel=["']preconnect["'][^>]*>/gi) || [];
  preconnects.forEach(p => console.log('  ', p));

  const r2 = await fetch('http://127.0.0.1:3005/shop/gods-plan');
  const html2 = await r2.text();
  console.log('\nPDP Preloads in HTML:');
  const preloads = html2.match(/<link[^>]+rel=["']preload["'][^>]*>/gi) || [];
  preloads.forEach(p => console.log('  ', p));
}

test().catch(console.error);
