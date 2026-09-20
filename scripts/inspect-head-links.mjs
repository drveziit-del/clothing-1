import http from 'http';

http.get('http://127.0.0.1:3005/shop/gods-plan', (res) => {
  let html = '';
  res.on('data', (c) => (html += c));
  res.on('end', () => {
    const head = html.slice(0, html.indexOf('</head>'));
    const links = head.match(/<link[^>]+>/g) || [];
    console.log(`Found ${links.length} link tags in <head>:`);
    links.forEach((l, idx) => console.log(`[${idx + 1}] ${l}`));
  });
});
