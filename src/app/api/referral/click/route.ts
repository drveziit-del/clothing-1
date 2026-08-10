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

    const uppercaseCode = code.toUpperCase();

    // Deduplication check: 1 click per IP per code per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const dedupKey = `${ip}_${uppercaseCode}`;
    const now = Date.now();
    const cachedClick = clickCache.get(dedupKey);

    if (cachedClick && now < cachedClick.expireTime) {
      return NextResponse.json({ status: 'ok', cached: true });
    }

    clickCache.set(dedupKey, { expireTime: now + 60 * 60 * 1000 });

    const userSnap = await adminDb.collection('users')
      .where('referralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
    }

    const userDoc = userSnap.docs[0];
    await userDoc.ref.update({
      linkClicks: FieldValue.increment(1),
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error tracking referral click:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
