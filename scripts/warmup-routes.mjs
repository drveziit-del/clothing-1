import http from 'http';

const routes = [
  '/',
  '/shop',
  '/shop/valueless-bitches',
  '/shop/society-fuckers',
  '/shop/gods-plan',
  '/cart',
  '/checkout',
  '/custom-design',
];

async function warmup() {
  console.log('Warming up all 8 routes on http://127.0.0.1:3005...');
  for (const r of routes) {
    await new Promise((resolve) => {
      http.get(`http://127.0.0.1:3005${r}`, (res) => {
        let len = 0;
        res.on('data', (c) => (len += c.length));
        res.on('end', () => {
          console.log(`✓ ${r} (status: ${res.statusCode}, bytes: ${len})`);
          resolve();
        });
      }).on('error', (err) => {
        console.log(`✗ ${r} error:`, err.message);
        resolve();
      });
    });
  }
  console.log('Warmup complete!');
}

warmup();
