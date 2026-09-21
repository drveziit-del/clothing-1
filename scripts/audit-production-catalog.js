const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const admin = require('firebase-admin');

// Load environment variables manually from .env.local
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.replace(/\\n/g, '\n');
      }
    }
  });
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

const adminDb = admin.firestore();

async function checkUrlStatus(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') return { ok: false, status: 'NO_URL' };
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(
        targetUrl,
        { method: 'HEAD', timeout: 5000 },
        (res) => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
        }
      );
      req.on('error', (err) => resolve({ ok: false, status: err.code || err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 'TIMEOUT' });
      });
      req.end();
    } catch (e) {
      resolve({ ok: false, status: 'INVALID_URL' });
    }
  });
}

async function auditCatalog() {
  console.log('====================================================');
  console.log('  GERKINK REAL PRODUCT CATALOG FORENSIC AUDIT       ');
  console.log('====================================================\n');

  const snapshot = await adminDb.collection('products').get();
  console.log(`Found total ${snapshot.size} product documents in Firestore.\n`);

  const products = [];
  const issues = [];
  const slugs = new Map();
  const ids = new Set();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const p = { id, ...data };
    products.push(p);

    // 1. Duplicate ID check
    if (ids.has(id)) {
      issues.push(`[CRITICAL] Duplicate Product ID: ${id}`);
    }
    ids.add(id);

    // 2. Slug check
    const slug = data.slug || id;
    if (slugs.has(slug)) {
      issues.push(`[CRITICAL] Duplicate Slug "${slug}" on products ${id} and ${slugs.get(slug)}`);
    } else {
      slugs.set(slug, id);
    }

    // 3. Price validation
    if (typeof data.price !== 'number' || isNaN(data.price)) {
      issues.push(`[CRITICAL] Product ${id} (${data.title}): Price is not a valid number (${data.price})`);
    } else if (data.price <= 0) {
      issues.push(`[CRITICAL] Product ${id} (${data.title}): Price is zero or negative (${data.price})`);
    }

    // 4. Section validation
    if (!['valueless_bitches', 'society_fuckers'].includes(data.section)) {
      issues.push(`[WARNING] Product ${id} (${data.title}): Non-standard section "${data.section}"`);
    }

    // 5. Variants validation
    const variants = Array.isArray(data.variants) ? data.variants : [];
    if (variants.length === 0) {
      issues.push(`[WARNING] Product ${id} (${data.title}): Has 0 variants defined`);
    } else {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (typeof v.price !== 'number' || v.price <= 0) {
          issues.push(`[CRITICAL] Product ${id} Variant #${i} (${v.size}/${v.color}): Invalid price (${v.price})`);
        }
      }
    }

    // 6. Test/Dummy detection
    const lowerTitle = (data.title || '').toLowerCase();
    const lowerSlug = (slug || '').toLowerCase();
    if (lowerTitle.includes('test') || lowerSlug.includes('test') || lowerSlug.includes('tset')) {
      issues.push(`[DISCOVERY] Test/Dummy Product found: ${id} | Title: "${data.title}" | Slug: "${slug}" | isPublished: ${data.isPublished}`);
    }

    // 7. Image check
    const images = Array.isArray(data.images) ? data.images : [];
    if (images.length === 0) {
      issues.push(`[WARNING] Product ${id} (${data.title}): Has 0 images`);
    }
  }

  // Print audit table
  console.log('-------------------------------------------------------------------------------------------------------------');
  console.log('ID                       | SLUG                                | PRICE   | SEC    | PUB   | TITLE');
  console.log('-------------------------------------------------------------------------------------------------------------');
  for (const p of products) {
    const pub = p.isPublished ? 'YES' : 'NO ';
    const sec = p.section === 'society_fuckers' ? 'SOC' : (p.section === 'valueless_bitches' ? 'VAL' : 'OTH');
    const priceStr = (p.price != null ? '$' + Number(p.price).toFixed(2) : 'N/A').padEnd(7);
    const slugStr = (p.slug || p.id).slice(0, 35).padEnd(35);
    const idStr = p.id.padEnd(24);
    const titleStr = (p.title || 'Untitled').slice(0, 30);
    console.log(`${idStr} | ${slugStr} | ${priceStr} | ${sec}  | ${pub}   | ${titleStr}`);
  }
  console.log('-------------------------------------------------------------------------------------------------------------\n');

  console.log(`Audited ${products.length} products. Found ${issues.length} issue(s):`);
  issues.forEach((iss) => console.log('  ' + iss));

  // Verify image accessibility for published products
  console.log('\n--- Checking Image URLs of Published Products ---');
  for (const p of products.filter((x) => x.isPublished)) {
    const images = Array.isArray(p.images) ? p.images : [];
    for (const img of images.slice(0, 2)) {
      const res = await checkUrlStatus(img);
      console.log(`  Product ${p.id} (${p.title?.slice(0, 20)}): [${res.status}] ${img.slice(0, 70)}...`);
    }
  }
}

auditCatalog()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Fatal error auditing catalog:', e);
    process.exit(1);
  });
