import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { isRateLimited } from '@/lib/utils/rateLimit';

export async function GET(request: NextRequest) {
  // Apply rate limiting to prevent enumeration attacks
  if (isRateLimited(request, 'referral_validate', { limit: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ valid: false, error: 'Code is required' }, { status: 400 });
  }

  try {
    const uppercaseCode = code.toUpperCase().trim();
    
    // 1. Find if any user document has this referral code
    const userSnap = await adminDb.collection('users')
      .where('referralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    if (!userSnap.empty) {
      const userData = userSnap.docs[0].data() || {};
      if (userData.referralActive === false || userData.isSuspended === true) {
        return NextResponse.json({ valid: false, reason: 'inactive' });
      }
      return NextResponse.json({ valid: true });
    }

    // 2. Check referral_codes collection
    const codeDoc = await adminDb.collection('referral_codes').doc(uppercaseCode).get();
    if (codeDoc.exists) {
      const codeData = codeDoc.data() || {};
      if (codeData.referralActive === false || codeData.isSuspended === true) {
        return NextResponse.json({ valid: false, reason: 'inactive' });
      }
      return NextResponse.json({ valid: true });
    }

    // 3. Check orders collection where userReferralCode was assigned
    const orderSnap = await adminDb.collection('orders')
      .where('userReferralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    if (!orderSnap.empty) {
      const orderData = orderSnap.docs[0].data() || {};
      if (orderData.referralActive === false || orderData.isSuspended === true) {
        return NextResponse.json({ valid: false, reason: 'inactive' });
      }
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false });
  } catch (err: any) {
    console.error('Error validating referral code:', err);
    return NextResponse.json({ valid: false, error: 'Internal validation error' }, { status: 500 });
  }
}
