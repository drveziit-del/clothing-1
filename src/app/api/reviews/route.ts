import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function getAuthenticatedUser(request: NextRequest) {
  // 1. Try session cookie first
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (session) {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      if (decoded) return decoded;
    }
  } catch (err) {
    console.warn('[api/reviews] Session cookie verification failed, checking bearer token...');
  }

  // 2. Fallback to Authorization header Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded) return decoded;
    } catch (err) {
      console.warn('[api/reviews] Bearer token verification failed:', err);
    }
  }

  return null;
}

// GET: Fetch all reviews (public)
export async function GET() {
  try {
    const snapshot = await adminDb.collection('reviews').orderBy('createdAt', 'desc').get();
    const reviews = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    return NextResponse.json(reviews);
  } catch (err: any) {
    console.error('[api/reviews] Error fetching reviews:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST: Create or Update a Review
export async function POST(request: NextRequest) {
  try {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to write a review.' }, { status: 401 });
    }

    const uid = decoded.uid;
    const body = await request.json();
    const { reviewId, rating, text } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5 stars' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Review text cannot be empty' }, { status: 400 });
    }

    const cleanText = text.trim().slice(0, 1000);

    // Fetch user details from Firebase Auth or Firestore user doc
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    let userName = userData?.displayName || decoded.name || decoded.email?.split('@')[0] || 'Customer';
    let userPhoto = userData?.photoURL || decoded.picture || null;

    if (reviewId) {
      // Edit existing review
      const reviewRef = adminDb.collection('reviews').doc(reviewId);
      const reviewDoc = await reviewRef.get();
      if (!reviewDoc.exists) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }

      const reviewData = reviewDoc.data()!;
      if (reviewData.userId !== uid && !decoded.admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await reviewRef.update({
        rating,
        text: cleanText,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: reviewId });
    } else {
      // Create new review — check if user already wrote one
      const existingSnap = await adminDb.collection('reviews')
        .where('userId', '==', uid)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        // Update existing instead of creating duplicate
        const existingId = existingSnap.docs[0].id;
        await existingSnap.docs[0].ref.update({
          rating,
          text: cleanText,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ success: true, id: existingId });
      }

      const newRef = await adminDb.collection('reviews').add({
        userId: uid,
        userName,
        userPhoto,
        rating,
        text: cleanText,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: newRef.id });
    }
  } catch (err: any) {
    console.error('[api/reviews] Error processing review:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit review' }, { status: 500 });
  }
}

// DELETE: Delete a Review
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    const reviewRef = adminDb.collection('reviews').doc(id);
    const reviewDoc = await reviewRef.get();

    if (!reviewDoc.exists) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const reviewData = reviewDoc.data()!;
    if (reviewData.userId !== decoded.uid && !decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await reviewRef.delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/reviews] Error deleting review:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete review' }, { status: 500 });
  }
}
