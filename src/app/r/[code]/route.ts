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

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // 1. Rate limiting
  if (isRateLimited(request, 'referral_redirect', { limit: 60, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
  }

  try {
    const { code } = await params;
    if (!code || typeof code !== 'string') {
      return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
    }

    const uppercaseCode = code.trim().toUpperCase();

    // 2. Validate referral code against users, referral_codes, or orders collections
    const userSnap = await adminDb
      .collection('users')
      .where('referralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    let affiliateDoc: FirebaseFirestore.DocumentSnapshot | null = !userSnap.empty ? userSnap.docs[0] : null;

    if (!affiliateDoc) {
      const codeRefDoc = await adminDb.collection('referral_codes').doc(uppercaseCode).get();
      if (codeRefDoc.exists) {
        const codeData = codeRefDoc.data() || {};
        if (codeData.userId && !codeData.userId.startsWith('guest_')) {
          const uDoc = await adminDb.collection('users').doc(codeData.userId).get();
          if (uDoc.exists) {
            affiliateDoc = uDoc;
          }
        }
        if (!affiliateDoc && codeData.orderId) {
          const oDoc = await adminDb.collection('orders').doc(codeData.orderId).get();
          if (oDoc.exists) {
            affiliateDoc = oDoc;
          }
        }
      }
    }

    if (!affiliateDoc) {
      const orderSnap = await adminDb
        .collection('orders')
        .where('userReferralCode', '==', uppercaseCode)
        .limit(1)
        .get();

      if (!orderSnap.empty) {
        affiliateDoc = orderSnap.docs[0];
      }
    }

    if (!affiliateDoc) {
      // Invalid referral code — safely redirect to shop without setting attribution cookie
      return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
    }

    const affiliateData = affiliateDoc.data() || {};
    // Check if code is expired or inactive/suspended
    if (affiliateData.referralActive === false || affiliateData.isSuspended === true) {
      return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
    }

    if (affiliateData.referralExpiresAt) {
      const expireTime = affiliateData.referralExpiresAt.toDate 
        ? affiliateData.referralExpiresAt.toDate().getTime()
        : new Date(affiliateData.referralExpiresAt).getTime();
      if (!isNaN(expireTime) && expireTime < Date.now()) {
        return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
      }
    }

    // 3. Deduplicated click tracking: 1 click per IP per code per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const dedupKey = `${ip}_${uppercaseCode}`;
    const now = Date.now();
    const cachedClick = clickCache.get(dedupKey);

    if (!cachedClick || now >= cachedClick.expireTime) {
      clickCache.set(dedupKey, { expireTime: now + 60 * 60 * 1000 });
      try {
        if (affiliateDoc.ref.parent.id === 'users') {
          await affiliateDoc.ref.set({
            linkClicks: FieldValue.increment(1),
          }, { merge: true });
        } else if (affiliateDoc.ref.parent.id === 'orders') {
          const ownerUid = affiliateData.userId;
          if (ownerUid && typeof ownerUid === 'string' && !ownerUid.startsWith('guest_')) {
            await adminDb.collection('users').doc(ownerUid).set({
              linkClicks: FieldValue.increment(1),
            }, { merge: true });
          } else {
            await affiliateDoc.ref.set({
              linkClicks: FieldValue.increment(1),
            }, { merge: true });
          }
        }
      } catch (clickErr) {
        console.warn('[r/[code]] Failed to increment click counter:', clickErr);
      }
    }

    // 4. Set durable 30-day cookie and redirect to shop
    const redirectUrl = new URL('/shop', request.url);
    const response = NextResponse.redirect(redirectUrl, { status: 307 });

    response.cookies.set('referral', uppercaseCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // Accessible client-side for CartContext/Signup synchronization
    });

    return response;
  } catch (err) {
    console.error('[r/[code]] Error processing referral redirect:', err);
    return NextResponse.redirect(new URL('/shop', request.url), { status: 307 });
  }
}
