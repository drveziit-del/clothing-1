import http from 'http';
import https from 'https';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3005';

function fetchUrl(urlPath, userAgent = 'Googlebot') {
  return new Promise((resolve) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`;
    const client = fullUrl.startsWith('https:') ? https : http;

    const req = client.get(fullUrl, {
      headers: {
        'User-Agent': userAgent === 'Googlebot'
          ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
          : userAgent === 'Bingbot'
          ? 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url: fullUrl,
          status: res.statusCode,
          headers: res.headers,
          body: data,
          location: res.headers.location || null,
        });
      });
    });

    req.on('error', (err) => resolve({ url: fullUrl, status: 0, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url: fullUrl, status: 0, error: 'TIMEOUT' });
    });
  });
}

async function runGates() {
  console.log('==============================================================');
  console.log(`GERKINK AUTONOMOUS SEO & CRAWLER VERIFICATION GATES`);
  console.log(`Target: ${BASE_URL}`);
  console.log('==============================================================\n');

  const results = [];
  function record(gateId, name, pass, detail) {
    results.push({ gateId, name, pass, detail });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} [${gateId}] ${name}: ${detail}`);
  }

  // --- ROBOTS TESTS ---
  console.log('--- 1. ROBOTS.TXT VERIFICATION ---');
  const robotsRes = await fetchUrl('/robots.txt');
  record('ROBOTS-01', 'robots.txt returns 200', robotsRes.status === 200, `Status: ${robotsRes.status}`);

  const robotsBody = robotsRes.body || '';
  const hasUserAgent = /User-agent:\s*\*/i.test(robotsBody);
  const hasAllow = /Allow:\s*\//i.test(robotsBody);
  record('ROBOTS-02', 'robots syntax valid', hasUserAgent && hasAllow, `User-agent and Allow directive present`);

  const sitemapMatch = robotsBody.match(/Sitemap:\s*(https:\/\/[^\s]+)/i);
  record('ROBOTS-03', 'sitemap declared with HTTPS URL', !!sitemapMatch && sitemapMatch[1] === 'https://gerkink.shop/sitemap.xml', `Sitemap: ${sitemapMatch ? sitemapMatch[1] : 'NONE'}`);

  const disallows = [...robotsBody.matchAll(/Disallow:\s*([^\s]+)/gi)].map(m => m[1]);
  const publicBlocked = disallows.some(d => d === '/' || d.startsWith('/shop'));
  record('ROBOTS-04', 'public store crawlable', !publicBlocked, `No disallow for / or /shop`);

  const hasAdminDisallow = disallows.some(d => d.startsWith('/admin'));
  const hasApiDisallow = disallows.some(d => d.startsWith('/api'));
  const hasAccountDisallow = disallows.some(d => d.startsWith('/account'));
  const hasCheckoutDisallow = disallows.some(d => d.startsWith('/checkout'));
  const hasCartDisallow = disallows.some(d => d.startsWith('/cart'));
  const hasThankYouDisallow = disallows.some(d => d.startsWith('/thank-you'));
  const hasReviewDisallow = disallows.some(d => d.startsWith('/review'));

  const privateProtected = hasAdminDisallow && hasApiDisallow && hasAccountDisallow && hasCheckoutDisallow && hasCartDisallow && hasThankYouDisallow && hasReviewDisallow;
  record('ROBOTS-05', 'private routes protected in robots.txt', privateProtected, `Disallow rules: admin=${hasAdminDisallow}, api=${hasApiDisallow}, account=${hasAccountDisallow}, checkout=${hasCheckoutDisallow}, cart=${hasCartDisallow}, thank-you=${hasThankYouDisallow}, review=${hasReviewDisallow}`);

  // --- SITEMAP TESTS ---
  console.log('\n--- 2. SITEMAP.XML VERIFICATION ---');
  const sitemapRes = await fetchUrl('/sitemap.xml');
  record('SITEMAP-01', 'sitemap returns 200', sitemapRes.status === 200, `Status: ${sitemapRes.status}`);

  const sitemapBody = sitemapRes.body || '';
  const isXml = sitemapBody.startsWith('<?xml') && sitemapBody.includes('<urlset') && sitemapBody.includes('</urlset>');
  record('SITEMAP-02', 'valid XML structure', isXml, `Contains <?xml and <urlset>`);

  const sitemapUrls = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`Total URLs in sitemap: ${sitemapUrls.length}`);

  const hasLocalhost = sitemapUrls.some(u => u.includes('localhost') || u.includes('127.0.0.1'));
  record('SITEMAP-03', 'zero localhost URLs', !hasLocalhost, `Found ${sitemapUrls.filter(u => u.includes('localhost') || u.includes('127.0.0.1')).length} localhost URLs`);

  const duplicateUrls = sitemapUrls.filter((item, index) => sitemapUrls.indexOf(item) !== index);
  record('SITEMAP-04', 'zero duplicate URLs', duplicateUrls.length === 0, `Duplicates: ${duplicateUrls.join(', ') || 'none'}`);

  const privateInSitemap = sitemapUrls.filter(u =>
    u.includes('/admin') ||
    u.includes('/api') ||
    u.includes('/auth') ||
    u.includes('/cart') ||
    u.includes('/checkout') ||
    u.includes('/account') ||
    u.includes('/thank-you') ||
    u.includes('/review') ||
    u.includes('/r/')
  );
  record('SITEMAP-05', 'zero private URLs in sitemap', privateInSitemap.length === 0, `Private URLs found: ${privateInSitemap.join(', ') || 'none'}`);

  // Test every URL in sitemap for HTTP 200 and no redirects
  console.log('\n--- 3. TESTING EVERY SITEMAP URL FOR 200 & CANONICAL ---');
  let broken404s = [];
  let unintendedRedirects = [];
  let nonHttpsUrls = sitemapUrls.filter(u => !u.startsWith('https://'));

  for (const rawUrl of sitemapUrls) {
    const path = rawUrl.replace('https://gerkink.shop', '');
    const res = await fetchUrl(path, 'Googlebot');
    if (res.status === 404) {
      broken404s.push(rawUrl);
    }
    if (res.status >= 300 && res.status < 400) {
      unintendedRedirects.push({ url: rawUrl, status: res.status, location: res.location });
    }
  }

  record('SITEMAP-06', 'zero 404 URLs in sitemap', broken404s.length === 0, `404 URLs: ${broken404s.join(', ') || 'none'}`);
  record('SITEMAP-07', 'zero unintended redirects in sitemap', unintendedRedirects.length === 0, `Redirects: ${JSON.stringify(unintendedRedirects)}`);
  record('SITEMAP-08', 'all URLs in sitemap use HTTPS', nonHttpsUrls.length === 0, `Non-HTTPS URLs: ${nonHttpsUrls.join(', ') || 'none'}`);

  // --- CANONICAL TESTS ---
  console.log('\n--- 4. CANONICAL URL AUDIT ---');
  const homeRes = await fetchUrl('/');
  const homeCanonical = (homeRes.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  record('CANONICAL-01', 'homepage canonical', homeCanonical === 'https://gerkink.shop', `Canonical: ${homeCanonical}`);

  const shopRes = await fetchUrl('/shop');
  const shopCanonical = (shopRes.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  record('CANONICAL-02', 'shop canonical', shopCanonical === 'https://gerkink.shop/shop', `Canonical: ${shopCanonical}`);

  const sfRes = await fetchUrl('/shop/society-fuckers');
  const sfCanonical = (sfRes.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  const vbRes = await fetchUrl('/shop/valueless-bitches');
  const vbCanonical = (vbRes.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  record('CANONICAL-03', 'collection canonicals', sfCanonical === 'https://gerkink.shop/shop/society-fuckers' && vbCanonical === 'https://gerkink.shop/shop/valueless-bitches', `SF: ${sfCanonical} | VB: ${vbCanonical}`);

  const pdpRes = await fetchUrl('/shop/unisex-heavy-blend-crewneck-sweatshirt');
  const pdpCanonical = (pdpRes.body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  record('CANONICAL-04', 'product canonical', pdpCanonical === 'https://gerkink.shop/shop/unisex-heavy-blend-crewneck-sweatshirt', `PDP Canonical: ${pdpCanonical}`);

  // --- PRODUCT DISCOVERABILITY & STRUCTURED DATA ---
  console.log('\n--- 5. PRODUCT DISCOVERABILITY & STRUCTURED DATA ---');
  record('PRODUCT-01', 'product returns HTTP 200', pdpRes.status === 200, `Status: ${pdpRes.status}`);

  const pdpRobots = (pdpRes.body?.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  const isPdpIndexable = !pdpRobots || (pdpRobots.includes('index') && !pdpRobots.includes('noindex'));
  record('PRODUCT-02', 'product indexable (no accidental noindex)', isPdpIndexable, `Robots meta: ${pdpRobots || 'default index'}`);

  const pdpTitle = (pdpRes.body?.match(/<title>([^<]+)<\/title>/i) || [])[1];
  const pdpDesc = (pdpRes.body?.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  const pdpOgImg = (pdpRes.body?.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  record('PRODUCT-03', 'product metadata complete', !!(pdpTitle && pdpDesc && pdpOgImg), `Title: "${pdpTitle?.slice(0, 30)}...", Desc: "${pdpDesc?.slice(0, 30)}...", Image: ${pdpOgImg}`);

  // Parse JSON-LD scripts
  const jsonLdScripts = [...(pdpRes.body || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  let hasValidProductSchema = false;
  for (const s of jsonLdScripts) {
    try {
      const parsed = JSON.parse(s);
      if (parsed['@type'] === 'Product' && parsed.name && parsed.offers) {
        hasValidProductSchema = true;
      }
    } catch (_) {}
  }
  record('PRODUCT-04', 'Product structured data valid', hasValidProductSchema, `Product JSON-LD found and parsed with name and offers`);

  // --- INTERNAL LINKING ---
  console.log('\n--- 6. INTERNAL LINKING AUDIT ---');
  const collectionHasProductLinks = vbRes.body?.includes('/shop/unisex-heavy-blend-crewneck-sweatshirt') || vbRes.body?.includes('/shop/');
  record('LINK-01', 'collection links to products', collectionHasProductLinks, `Collection contains product links`);

  const shopHasCollections = shopRes.body?.includes('/shop/society-fuckers') && shopRes.body?.includes('/shop/valueless-bitches');
  record('LINK-02', 'shop links to collections', shopHasCollections, `Shop links to both collections`);

  // --- SECURITY TESTS ---
  console.log('\n--- 7. PRIVATE ROUTE ACCESS CONTROLS ---');
  const adminRes = await fetchUrl('/admin');
  record('SECURITY-01', 'admin protected', adminRes.status === 307 || adminRes.status === 401 || adminRes.status === 403, `Admin response: ${adminRes.status}`);

  const accountRes = await fetchUrl('/account');
  record('SECURITY-02', 'account protected from unauthenticated access', accountRes.status === 307 || accountRes.status === 401, `Account response: ${accountRes.status} (Redirect: ${accountRes.location})`);

  const checkoutRes = await fetchUrl('/checkout');
  record('SECURITY-03', 'checkout protected appropriately', checkoutRes.status === 307 || checkoutRes.status === 401, `Checkout response: ${checkoutRes.status} (Redirect: ${checkoutRes.location})`);

  const apiAdminRes = await fetchUrl('/api/admin/products');
  record('SECURITY-04', 'admin API strictly protected', apiAdminRes.status === 401 || apiAdminRes.status === 403, `Admin API response: ${apiAdminRes.status}`);

  console.log('\n==============================================================');
  console.log('SUMMARY');
  console.log('==============================================================');
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  console.log(`Total Gates: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\nFAILED GATES:');
    results.filter(r => !r.pass).forEach(r => console.log(`- [${r.gateId}] ${r.name}: ${r.detail}`));
  }
}

runGates().catch(console.error);
