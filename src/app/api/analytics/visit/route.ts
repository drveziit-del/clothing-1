import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';

export async function POST(request: NextRequest) {
  // Throttle per IP: silent success on limit so we don't leak rate-limit internals.
  if (isRateLimited(request, 'analytics_visit', { limit: 1, windowMs: 60 * 1000 })) {
    return NextResponse.json({ success: true });
  }

  try {
    const settingsRef = adminDb.collection('settings').doc('global');
    await settingsRef.set(
      {
        siteVisits: FieldValue.increment(1),
      },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error tracking site visit:', err);
    return NextResponse.json({ error: 'Visit tracking failed' }, { status: 500 });
  }
}
