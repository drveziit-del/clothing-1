async function check() {
  const r = await fetch('https://gerkink.shop/');
  const html = await r.text();
  console.log('HTML length:', html.length);
  console.log('Has LoadingScreen in HTML:', html.includes('LoadingScreen_screen'));
  console.log('Has hero headline in HTML:', html.includes('YOU DRESS LIKE'));
  const preloads = html.match(/<link[^>]+rel=["']preload["'][^>]*>/gi) || [];
  console.log('Preloads in <head> count:', preloads.length);
  preloads.forEach(p => console.log('  ', p));
}
check().catch(console.error);
