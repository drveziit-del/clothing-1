const fs = require('fs');

async function test() {
  let envContent = '';
  try {
    envContent = fs.readFileSync('.env.local', 'utf8');
  } catch (err) {
    console.error('Could not read .env.local:', err.message);
    return;
  }

  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  });

  const clientId = env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  const mode = env.PAYPAL_MODE || 'sandbox';

  console.log('Mode:', mode);
  console.log('Client ID prefix:', clientId ? clientId.substring(0, 10) : 'null');
  console.log('Client Secret prefix:', clientSecret ? clientSecret.substring(0, 10) : 'null');

  if (!clientId || !clientSecret) {
    console.error('Missing credentials!');
    return;
  }

  const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    console.log('Fetching access token from:', `${baseUrl}/v1/oauth2/token`);
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Access token failed:', tokenRes.status, err);
      return;
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    console.log('Access token fetched successfully.');

    console.log('Fetching client token from:', `${baseUrl}/v1/identity/generate-token`);
    const clientTokenRes = await fetch(`${baseUrl}/v1/identity/generate-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const status = clientTokenRes.status;
    const text = await clientTokenRes.text();
    console.log('Client token response status:', status);
    console.log('Client token response text:', text);
  } catch (error) {
    console.error('Error during test:', error);
  }
}

test();
