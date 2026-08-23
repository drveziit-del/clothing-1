import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';

const SHARD_COUNT = 10;
// Roughly 1-in-50 visits refreshes the rolled-up total on settings/global.
// This keeps the public counter near-real-time while reducing writes to the
// single hot document by ~98% (the shard docs absorb the rest).
const ROLLUP_PROBABILITY = 0.02;

export async function POST(request: NextRequest) {
  // Throttle per IP: silent success on limit so we don't leak rate-limit internals.
  if (isRateLimited(request, 'analytics_visit', { limit: 1, windowMs: 60 * 1000 })) {
    return NextResponse.json({ success: true });
  }

  try {
    const shardId = Math.floor(Math.random() * SHARD_COUNT);
    const shardRef = adminDb.collection('settings').doc(`visits_shard_${shardId}`);
    await shardRef.set(
      { siteVisits: FieldValue.increment(1) },
      { merge: true }
    );

    if (Math.random() < ROLLUP_PROBABILITY) {
      // Sum every sharded counter, then overwrite the display total exactly.
      const snaps = await adminDb
        .collection('settings')
        .where('siteVisits', '>', -1)
        .get();
      let total = 0;
      snaps.forEach((s) => {
        if (/^visits_shard_\d+$/.test(s.id)) {
          total += Number(s.data()?.siteVisits ?? 0);
        }
      });
      await adminDb.collection('settings').doc('global').set(
        { siteVisits: total },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error tracking site visit:', err);
    return NextResponse.json({ error: 'Visit tracking failed' }, { status: 500 });
  }
}
