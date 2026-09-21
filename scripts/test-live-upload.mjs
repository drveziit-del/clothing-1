import https from 'https';

function testEndpoint(url, method = 'POST', headers = {}, body = null) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', err => resolve({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Testing unauthenticated POST to https://gerkink.shop/api/custom-design/upload...');
  const res1 = await testEndpoint('https://gerkink.shop/api/custom-design/upload', 'POST', {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryXYZ',
  });
  console.log('Status:', res1.status);
  console.log('Headers:', res1.headers);
  console.log('Body:', res1.body);
}

run().catch(console.error);
