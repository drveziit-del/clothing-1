const https = require('https');

function getUrl(urlStr) {
  return new Promise((resolve) => {
    const req = https.get(urlStr, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyLength: data.length,
          bodySnippet: data.slice(0, 500),
          isHtml: res.headers['content-type']?.includes('text/html'),
          hasErrorText: data.includes('Application error') || data.includes('Internal Server Error') || data.includes('500'),
        });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'TIMEOUT' });
    });
  });
}

async function testAllSitemapUrls() {
  console.log('====================================================');
  console.log('  LIVE SITEMAP & PRODUCT ENDPOINTS AUDIT             ');
  console.log('====================================================\n');

  const sitemapUrls = [
    'https://gerkink.shop',
    'https://gerkink.shop/shop',
    'https://gerkink.shop/custom-design',
    'https://gerkink.shop/shop/society-fuckers',
    'https://gerkink.shop/shop/valueless-bitches',
    'https://gerkink.shop/manifesto',
    'https://gerkink.shop/owners',
    'https://gerkink.shop/referral',
    'https://gerkink.shop/contact',
    'https://gerkink.shop/shipping',
    'https://gerkink.shop/refund',
    'https://gerkink.shop/terms',
    'https://gerkink.shop/privacy',
    'https://gerkink.shop/disclaimer',
    'https://gerkink.shop/shop/tset2',
    'https://gerkink.shop/shop/test3',
    'https://gerkink.shop/shop/bhjb',
    'https://gerkink.shop/shop/test4',
    'https://gerkink.shop/shop/gods-plan',
    'https://gerkink.shop/shop/unisex-heavy-blend-crewneck-sweatshirt',
    'https://gerkink.shop/shop/unisex-oversized-boxy-tee',
    'https://gerkink.shop/shop/test',
  ];

  for (const targetUrl of sitemapUrls) {
    const res = await getUrl(targetUrl);
    const statusIcon = res.statusCode === 200 ? '✅' : (res.statusCode === 301 || res.statusCode === 302 ? '↪️' : '❌');
    console.log(`${statusIcon} [${res.statusCode}] ${targetUrl} (Len: ${res.bodyLength} bytes, Error: ${res.hasErrorText ? 'YES' : 'NO'})`);
  }
}

testAllSitemapUrls().catch(console.error);
