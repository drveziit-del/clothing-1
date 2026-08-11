import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';

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
      const decoded = await adminAuth.verifyIdToken(token, true);
      if (decoded) return decoded;
    } catch (err) {
      console.warn('[api/reviews] Bearer token verification failed:', err);
    }
  }

  return null;
}

// GET: Fetch reviews (public, optionally filtered by productId, limited to 50 latest)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    let query: FirebaseFirestore.Query = adminDb.collection('reviews');
    if (productId) {
      query = query.where('productId', '==', productId);
    }

    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      snapshot = await query.orderBy('createdAt', 'desc').limit(50).get();
    } catch (indexErr: any) {
      console.warn('[api/reviews] orderBy query failed (missing index?), falling back to unordered query:', indexErr?.message || indexErr);
      snapshot = await query.limit(50).get();
    }

    const reviews = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });

    // In-memory sort fallback (descending by createdAt)
    reviews.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(reviews);
  } catch (err: any) {
    console.error('[api/reviews] Error fetching reviews:', err);
    return NextResponse.json([], { status: 200 });
  }
}

// POST: Create or Update a Review (scoped per product if productId is provided)
export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'reviews', { limit: 15, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to write a review.' }, { status: 401 });
    }

    const uid = decoded.uid;
    const body = await request.json();
    const { reviewId, productId, rating, text } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5 stars' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Review text cannot be empty' }, { status: 400 });
    }

    const cleanText = text.trim().slice(0, 1000);
    const targetProductId = typeof productId === 'string' && productId.trim() ? productId.trim() : null;

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
        productId: targetProductId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: reviewId });
    } else {
      // Create new review — check if user already wrote one for this product
      let existingQuery: FirebaseFirestore.Query = adminDb.collection('reviews').where('userId', '==', uid);
      if (targetProductId) {
        existingQuery = existingQuery.where('productId', '==', targetProductId);
      } else {
        existingQuery = existingQuery.where('productId', '==', null);
      }

      const existingSnap = await existingQuery.limit(1).get();

      if (!existingSnap.empty) {
        // Update existing instead of creating duplicate
        const existingId = existingSnap.docs[0].id;
        await existingSnap.docs[0].ref.update({
          rating,
          text: cleanText,
          productId: targetProductId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ success: true, id: existingId });
      }

      const newRef = await adminDb.collection('reviews').add({
        userId: uid,
        productId: targetProductId,
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
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}

// DELETE: Delete a Review
export async function DELETE(request: NextRequest) {
  if (isRateLimited(request, 'reviews_delete', { limit: 15, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

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
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
