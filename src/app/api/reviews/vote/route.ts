import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'reviews_vote', { limit: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { reviewId, vote } = body;

    if (!reviewId || typeof reviewId !== 'string') {
      return NextResponse.json({ error: 'reviewId is required' }, { status: 400 });
    }

    if (vote !== 'up' && vote !== 'report') {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    // Determine voter identification key
    let voterKey = '';
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (session) {
      try {
        const decoded = await adminAuth.verifySessionCookie(session, true);
        if (decoded?.uid) {
          voterKey = `uid_${decoded.uid}`;
        }
      } catch {
        // Fall back to IP hash
      }
    }

    if (!voterKey) {
      const forwarded = request.headers.get('x-forwarded-for') || '';
      const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon_ip';
      const ua = request.headers.get('user-agent') || 'unknown_ua';
      const hash = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 24);
      voterKey = `ip_${hash}`;
    }

    const reviewRef = adminDb.collection('reviews').doc(reviewId);
    const voteRef = reviewRef.collection('votes').doc(voterKey);

    let flagged = false;

    await adminDb.runTransaction(async (transaction) => {
      const [reviewDoc, voteDoc] = await Promise.all([
        transaction.get(reviewRef),
        transaction.get(voteRef),
      ]);

      if (!reviewDoc.exists) {
        throw new Error('NOT_FOUND');
      }

      if (voteDoc.exists) {
        throw new Error('ALREADY_VOTED');
      }

      const reviewData = reviewDoc.data()!;
      const updates: Record<string, any> = {};

      if (vote === 'up') {
        updates.helpfulCount = FieldValue.increment(1);
      } else if (vote === 'report') {
        const currentReports = (reviewData.reportCount || 0) + 1;
        updates.reportCount = FieldValue.increment(1);

        // Auto-moderation: Flag and unpublish review if reported 5 or more times
        if (currentReports >= 5) {
          updates.status = 'flagged';
          updates.approved = false;
          updates.autoFlaggedAt = FieldValue.serverTimestamp();
          flagged = true;
        }
      }

      transaction.update(reviewRef, updates);
      transaction.set(voteRef, {
        voterKey,
        vote,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, flagged });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (err.message === 'ALREADY_VOTED') {
      return NextResponse.json({ error: 'You have already voted on this review' }, { status: 409 });
    }
    console.error('[api/reviews/vote] Error:', err);
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
