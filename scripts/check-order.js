const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2 && !parts[0].startsWith('#')) {
    let val = parts.slice(1).join('=');
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[parts[0].trim()] = val.replace(/\\n/g, '\n');
  }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY
    })
  });
}

admin.firestore().collection('orders').doc('IKUdGhPSfwRpJcOa3Mkq').get().then(doc => {
  if (!doc.exists) {
    console.log('Order not found');
  } else {
    const data = doc.data();
    console.log('ORDER ID:', doc.id);
    console.log('STATUS:', data.status);
    console.log('PAYMENT CAPTURED:', data.paymentCaptured);
    console.log('PAYMENT GATEWAY:', data.paymentGateway);
    console.log('TOTAL:', data.total);
    console.log('PAYPAL ORDER ID:', data.paypalOrderId);
    console.log('PAYPAL CAPTURE ID:', data.paypalCaptureId);
    console.log('PRINTIFY ORDER ID:', data.printifyOrderId || 'N/A');
    console.log('PRINTIFY STATUS:', data.printifyStatus || 'N/A');
    console.log('TIMELINE HISTORY:', JSON.stringify(data.timelineHistory, null, 2));
  }
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
