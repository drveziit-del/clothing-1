const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let v = parts.slice(1).join('=').trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[key] = v;
  }
});
const admin = require('firebase-admin');
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.collection('orders').orderBy('createdAt', 'desc').limit(2).get().then(snap => {
  snap.docs.forEach(doc => {
    console.log('--- ORDER ID:', doc.id, '---');
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}).catch(console.error);
