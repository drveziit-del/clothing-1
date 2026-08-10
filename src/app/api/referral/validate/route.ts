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
    
    // Find if any user document has this referral code
    const snap = await adminDb.collection('users')
      .where('referralCode', '==', uppercaseCode)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch (err: any) {
    console.error('Error validating referral code:', err);
    return NextResponse.json({ valid: false, error: 'Internal validation error' }, { status: 500 });
  }
}
