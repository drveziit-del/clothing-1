const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const tls = require('tls');
const url = require('url');

async function fetchUrl(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      targetUrl,
      {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          ...(options.headers || {}),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function inspectCertificate(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      443,
      hostname,
      { servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.end();
        resolve({ cert, authorized });
      }
    );
    socket.on('error', reject);
  });
}

async function runForensics() {
  console.log('====================================================');
  console.log('  GERKINK PRODUCTION INFRASTRUCTURE & DOMAIN AUDIT  ');
  console.log('====================================================\n');

  // 1. DNS Resolution
  console.log('[1] DNS Resolution:');
  try {
    const aRecords = await dns.resolve4('gerkink.shop');
    console.log('  gerkink.shop A records:', aRecords);
  } catch (err) {
    console.error('  gerkink.shop A records error:', err.message);
  }

  try {
    const cnameRecords = await dns.resolveCname('www.gerkink.shop');
    console.log('  www.gerkink.shop CNAME records:', cnameRecords);
  } catch (err) {
    console.log('  www.gerkink.shop CNAME:', err.message);
  }

  // 2. SSL/TLS Certificate
  console.log('\n[2] SSL/TLS Certificate:');
  try {
    const { cert, authorized } = await inspectCertificate('gerkink.shop');
    console.log('  Authorized:', authorized);
    console.log('  Subject:', cert.subject);
    console.log('  Issuer:', cert.issuer);
    console.log('  Valid From:', cert.valid_from);
    console.log('  Valid To:', cert.valid_to);
    console.log('  Subject Alt Names:', cert.subjectaltname);
  } catch (err) {
    console.error('  Certificate inspection error:', err.message);
  }

  // 3. HTTP -> HTTPS Redirect
  console.log('\n[3] HTTP -> HTTPS & Canonical Redirects:');
  try {
    const httpRes = await fetchUrl('http://gerkink.shop/');
    console.log('  http://gerkink.shop/ -> Status:', httpRes.statusCode, 'Location:', httpRes.headers.location);
  } catch (err) {
    console.error('  http://gerkink.shop/ error:', err.message);
  }

  try {
    const wwwRes = await fetchUrl('http://www.gerkink.shop/');
    console.log('  http://www.gerkink.shop/ -> Status:', wwwRes.statusCode, 'Location:', wwwRes.headers.location);
  } catch (err) {
    console.error('  http://www.gerkink.shop/ error:', err.message);
  }

  try {
    const httpsWwwRes = await fetchUrl('https://www.gerkink.shop/');
    console.log('  https://www.gerkink.shop/ -> Status:', httpsWwwRes.statusCode, 'Location:', httpsWwwRes.headers.location);
  } catch (err) {
    console.error('  https://www.gerkink.shop/ error:', err.message);
  }

  // 4. Security Headers on Live Production
  console.log('\n[4] Production Security Headers (https://gerkink.shop/):');
  try {
    const prodRes = await fetchUrl('https://gerkink.shop/');
    console.log('  Status Code:', prodRes.statusCode);
    console.log('  Strict-Transport-Security:', prodRes.headers['strict-transport-security']);
    console.log('  Content-Security-Policy:', prodRes.headers['content-security-policy'] ? 'Present (' + prodRes.headers['content-security-policy'].length + ' chars)' : 'MISSING');
    console.log('  X-Frame-Options:', prodRes.headers['x-frame-options']);
    console.log('  X-Content-Type-Options:', prodRes.headers['x-content-type-options']);
    console.log('  Referrer-Policy:', prodRes.headers['referrer-policy']);
    console.log('  Permissions-Policy:', prodRes.headers['permissions-policy']);
    console.log('  Server / Edge:', prodRes.headers['server'], prodRes.headers['cf-ray'] ? 'Cloudflare Ray: ' + prodRes.headers['cf-ray'] : 'Direct');

    // 5. Leak Detection in HTML
    console.log('\n[5] Production HTML Leak Scan (https://gerkink.shop/):');
    const leakPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'sandbox',
      'emulator',
      'test_secret',
      'sk_test',
      'rzp_test',
      'example.com',
    ];

    for (const pat of leakPatterns) {
      const match = prodRes.body.includes(pat);
      console.log(`  Contains "${pat}":`, match ? '⚠️ FOUND LEAK' : 'CLEAN');
    }
  } catch (err) {
    console.error('  https://gerkink.shop/ error:', err.message);
  }

  // 6. Robots & Sitemap
  console.log('\n[6] Robots.txt & Sitemap.xml:');
  try {
    const robotsRes = await fetchUrl('https://gerkink.shop/robots.txt');
    console.log('  /robots.txt Status:', robotsRes.statusCode);
    console.log('  /robots.txt Content:\n' + robotsRes.body.split('\n').map(l => '    ' + l).join('\n'));

    const sitemapRes = await fetchUrl('https://gerkink.shop/sitemap.xml');
    console.log('\n  /sitemap.xml Status:', sitemapRes.statusCode);
    const urls = (sitemapRes.body.match(/<loc>(.*?)<\/loc>/g) || []).map(u => u.replace(/<\/?loc>/g, ''));
    console.log(`  Discovered ${urls.length} URLs in live production sitemap:`);
    urls.forEach(u => console.log('    ' + u));
  } catch (err) {
    console.error('  Robots/Sitemap error:', err.message);
  }

  // 7. API Health
  console.log('\n[7] API Health Endpoint:');
  try {
    const healthRes = await fetchUrl('https://gerkink.shop/api/health');
    console.log('  /api/health Status:', healthRes.statusCode);
    console.log('  /api/health Body:', healthRes.body);
  } catch (err) {
    console.error('  /api/health error:', err.message);
  }
}

runForensics().catch(console.error);
