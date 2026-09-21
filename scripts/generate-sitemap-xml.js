const fs = require('fs');
const path = require('path');
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

async function generateCleanSitemap() {
  const baseUrl = 'https://gerkink.shop';
  const now = new Date().toISOString();

  const staticUrls = [
    { url: `${baseUrl}`, priority: '1.0', changefreq: 'daily' },
    { url: `${baseUrl}/shop`, priority: '0.9', changefreq: 'daily' },
    { url: `${baseUrl}/custom-design`, priority: '0.9', changefreq: 'daily' },
    { url: `${baseUrl}/shop/society-fuckers`, priority: '0.8', changefreq: 'weekly' },
    { url: `${baseUrl}/shop/valueless-bitches`, priority: '0.8', changefreq: 'weekly' },
    { url: `${baseUrl}/review`, priority: '0.7', changefreq: 'daily' },
    { url: `${baseUrl}/manifesto`, priority: '0.7', changefreq: 'monthly' },
    { url: `${baseUrl}/owners`, priority: '0.7', changefreq: 'weekly' },
    { url: `${baseUrl}/referral`, priority: '0.7', changefreq: 'monthly' },
    { url: `${baseUrl}/contact`, priority: '0.5', changefreq: 'monthly' },
    { url: `${baseUrl}/shipping`, priority: '0.5', changefreq: 'monthly' },
    { url: `${baseUrl}/refund`, priority: '0.5', changefreq: 'monthly' },
    { url: `${baseUrl}/terms`, priority: '0.4', changefreq: 'yearly' },
    { url: `${baseUrl}/privacy`, priority: '0.4', changefreq: 'yearly' },
    { url: `${baseUrl}/disclaimer`, priority: '0.4', changefreq: 'yearly' },
  ];

  const snapshot = await adminDb.collection('products').where('isPublished', '==', true).get();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  for (const item of staticUrls) {
    xml += '  <url>\n';
    xml += `    <loc>${item.url}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const slug = d.slug || doc.id;
    const updatedAt = d.updatedAt && typeof d.updatedAt.toDate === 'function' ? d.updatedAt.toDate().toISOString() : now;
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/shop/${slug}</loc>\n`;
    if (Array.isArray(d.images)) {
      for (const img of d.images) {
        if (typeof img === 'string' && img.startsWith('http')) {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${img.replace(/&/g, '&amp;')}</image:loc>\n`;
          xml += '    </image:image>\n';
        }
      }
    }
    xml += `    <lastmod>${updatedAt}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  fs.writeFileSync('sitemap.xml', xml, 'utf8');
  console.log(`✅ Generated clean sitemap.xml with ${staticUrls.length} static pages and ${snapshot.docs.length} published products.`);
}

generateCleanSitemap().catch(console.error);
