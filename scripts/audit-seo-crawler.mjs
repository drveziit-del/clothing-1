import https from 'https';
import http from 'http';

function fetchUrl(url, userAgent = 'Googlebot') {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': userAgent === 'Googlebot'
          ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
          : userAgent === 'Bingbot'
          ? 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          body: data,
          location: res.headers.location || null,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ url, status: 0, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 0, error: 'TIMEOUT' });
    });
  });
}

async function audit() {
  console.log('==============================================================');
  console.log('GERKINK SEO & CRAWLER AUDIT — LIVE SITE (https://gerkink.shop)');
  console.log('==============================================================');

  // 1. Robots.txt
  console.log('\n--- 1. AUDITING ROBOTS.TXT ---');
  const liveRobots = await fetchUrl('https://gerkink.shop/robots.txt');
  console.log(`Live robots.txt Status: ${liveRobots.status}`);
  console.log(`Live robots.txt Content:\n${liveRobots.body}`);

  // 2. Sitemap.xml
  console.log('\n--- 2. AUDITING SITEMAP.XML ---');
  const liveSitemap = await fetchUrl('https://gerkink.shop/sitemap.xml');
  console.log(`Live sitemap.xml Status: ${liveSitemap.status}`);
  console.log(`Live sitemap.xml Content-Type: ${liveSitemap.headers?.['content-type']}`);
  console.log(`Live sitemap.xml Length: ${liveSitemap.body?.length} bytes`);

  // Extract URLs from sitemap
  const urlMatches = [...(liveSitemap.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`Total URLs found in live sitemap: ${urlMatches.length}`);
  console.log('Sample sitemap URLs:', urlMatches.slice(0, 10));

  // Check for suspicious URLs in sitemap
  const suspicious = urlMatches.filter(u =>
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('admin') ||
    u.includes('api') ||
    u.includes('auth') ||
    u.includes('cart') ||
    u.includes('checkout') ||
    u.includes('account') ||
    u.includes('thank-you') ||
    u.includes('review') ||
    !u.startsWith('https://gerkink.shop')
  );
  console.log('Suspicious/Private URLs in live sitemap:', suspicious);

  // 3. Check Canonical and Meta for Key Routes
  console.log('\n--- 3. CHECKING KEY ROUTES FOR CANONICALS & METADATA ---');
  const testRoutes = [
    '/',
    '/shop',
    '/shop/society-fuckers',
    '/shop/valueless-bitches',
    '/shop/unisex-heavy-blend-crewneck-sweatshirt',
    '/custom-design',
    '/thank-you',
    '/review',
    '/cart',
    '/checkout',
    '/admin'
  ];

  for (const route of testRoutes) {
    const res = await fetchUrl(`https://gerkink.shop${route}`, 'Googlebot');
    const canonicalMatch = res.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                           res.body?.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const robotsMatch = res.body?.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const titleMatch = res.body?.match(/<title>([^<]+)<\/title>/i);
    const jsonLdCount = [...(res.body || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length;

    console.log(`Route ${route.padEnd(45)}: Status=${res.status} | Canonical=${canonicalMatch ? canonicalMatch[1] : 'NONE'} | Robots=${robotsMatch ? robotsMatch[1] : 'NONE'} | Title=${titleMatch ? titleMatch[1].slice(0, 30) : 'NONE'} | JSON-LD=${jsonLdCount}`);
  }

  // 4. Check Local Compiled Server (http://127.0.0.1:3005)
  console.log('\n==============================================================');
  console.log('GERKINK SEO & CRAWLER AUDIT — LOCAL BUILD (http://127.0.0.1:3005)');
  console.log('==============================================================');

  const localRobots = await fetchUrl('http://127.0.0.1:3005/robots.txt');
  console.log(`Local robots.txt Status: ${localRobots.status}`);
  console.log(`Local robots.txt Content:\n${localRobots.body}`);

  const localSitemap = await fetchUrl('http://127.0.0.1:3005/sitemap.xml');
  console.log(`Local sitemap.xml Status: ${localSitemap.status}`);
  const localUrls = [...(localSitemap.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`Total URLs in local sitemap: ${localUrls.length}`);
  const localSuspicious = localUrls.filter(u =>
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('admin') ||
    u.includes('api') ||
    u.includes('auth') ||
    u.includes('cart') ||
    u.includes('checkout') ||
    u.includes('account') ||
    u.includes('thank-you') ||
    u.includes('review') ||
    !u.startsWith('https://gerkink.shop')
  );
  console.log('Suspicious/Private URLs in local sitemap:', localSuspicious);
}

audit().catch(console.error);
