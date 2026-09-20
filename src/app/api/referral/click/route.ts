import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';

interface ClickTracker {
  expireTime: number;
}
const clickCache = new Map<string, ClickTracker>();

// Cleanup stale cache entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of clickCache.entries()) {
      if (now > value.expireTime) {
        clickCache.delete(key);
      }
    }
  }, 1000 * 60 * 15);
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'referral_click', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const uppercaseCode = code.trim().toUpperCase();

    // Deduplication check: 1 click per IP per code per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const dedupKey = `${ip}_${uppercaseCode}`;
    const now = Date.now();
    const cachedClick = clickCache.get(dedupKey);

    if (cachedClick && now < cachedClick.expireTime) {
      return NextResponse.json({ status: 'ok', cached: true });
    }

    // Lookup across users, referral_codes, and orders
    const userSnap = await adminDb.collection('users')
      .where('referralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    let targetDocRef: FirebaseFirestore.DocumentReference | null = !userSnap.empty ? userSnap.docs[0].ref : null;

    if (!targetDocRef) {
      const codeDoc = await adminDb.collection('referral_codes').doc(uppercaseCode).get();
      if (codeDoc.exists) {
        const codeData = codeDoc.data() || {};
        if (codeData.userId && !codeData.userId.startsWith('guest_')) {
          targetDocRef = adminDb.collection('users').doc(codeData.userId);
        } else if (codeData.orderId) {
          const ordDoc = await adminDb.collection('orders').doc(codeData.orderId).get();
          if (ordDoc.exists) {
            const ordData = ordDoc.data() || {};
            if (ordData.userId && !ordData.userId.startsWith('guest_')) {
              targetDocRef = adminDb.collection('users').doc(ordData.userId);
            } else {
              targetDocRef = ordDoc.ref;
            }
          }
        }
      }
    }

    if (!targetDocRef) {
      const orderSnap = await adminDb.collection('orders')
        .where('userReferralCode', '==', uppercaseCode)
        .limit(1)
        .get();
      if (!orderSnap.empty) {
        const orderDoc = orderSnap.docs[0];
        const orderData = orderDoc.data() || {};
        if (orderData.userId && !orderData.userId.startsWith('guest_')) {
          targetDocRef = adminDb.collection('users').doc(orderData.userId);
        } else {
          targetDocRef = orderDoc.ref;
        }
      }
    }

    if (!targetDocRef) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
    }

    clickCache.set(dedupKey, { expireTime: now + 60 * 60 * 1000 });

    await targetDocRef.set({
      linkClicks: FieldValue.increment(1),
    }, { merge: true });

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error tracking referral click:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
