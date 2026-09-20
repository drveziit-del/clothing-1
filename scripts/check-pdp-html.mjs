async function check() {
  const r = await fetch('https://gerkink.shop/shop/gods-plan');
  const html = await r.text();
  const preloads = html.match(/<link[^>]+rel=["']preload["'][^>]*>/gi) || [];
  console.log('Preloads in <head> count:', preloads.length);
  preloads.forEach(p => console.log('  ', p));
  const imgs = html.match(/<img[^>]+>/gi) || [];
  console.log('Images in HTML count:', imgs.length);
  imgs.slice(0, 3).forEach((img, i) => console.log('Img', i, img.slice(0, 300)));
}
check().catch(console.error);
