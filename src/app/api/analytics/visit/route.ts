import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST() {
  try {
    const settingsRef = adminDb.collection('settings').doc('global');
    await settingsRef.set(
      {
        siteVisits: FieldValue.increment(1),
      },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Visit tracking failed';
    console.error('Error tracking site visit:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
