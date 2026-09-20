import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { verifyReviewToken } from '@/lib/reviews/token';
import type { Review, ReviewMedia, FitFeedback, ReviewStatus, ProductReviewSummary } from '@/types';

function toPublicSafeReviewDto(r: Review): Partial<Review> {
  return {
    id: r.id,
    productId: r.productId || undefined,
    productTitle: r.productTitle,
    userName: r.userName || 'Customer',
    userEmailMasked: r.userEmailMasked,
    userPhoto: r.userPhoto || undefined,
    rating: r.rating,
    title: r.title || '',
    text: r.text || '',
    fit: r.fit,
    media: r.media || [],
    verifiedPurchase: !!r.verifiedPurchase,
    helpfulCount: r.helpfulCount || 0,
    officialReply: r.officialReply || undefined,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt,
  };
}

function maskEmail(email?: string): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name.slice(0, 1)}***`;
  return `${maskedName}@${domain}`;
}

async function getAuthenticatedUser(request: NextRequest) {
  // 1. Try session cookie first
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (session) {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      if (decoded) return decoded;
    }
  } catch {
    // continue to bearer
  }

  // 2. Fallback to Authorization header Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = await adminAuth.verifyIdToken(token, true);
      if (decoded) return decoded;
    } catch {
      // failed
    }
  }

  return null;
}

// GET: Fetch reviews & aggregate statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const sort = searchParams.get('sort') || 'recent'; // recent | highest | lowest | media | verified
    const ratingFilter = searchParams.get('rating') ? Number(searchParams.get('rating')) : null;
    const mediaOnly = searchParams.get('mediaOnly') === 'true';
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10));

    let query: FirebaseFirestore.Query = adminDb.collection('reviews');

    if (productId) {
      query = query.where('productId', '==', productId.trim());
    }

    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      // Limit to 200 documents max to prevent unbounded Firestore reads and memory bloat
      snapshot = await query.limit(200).get();
    } catch (err: any) {
      console.warn('[api/reviews] query failed:', err?.message || err);
      return NextResponse.json({
        reviews: [],
        summary: {
          averageRating: 0,
          totalReviews: 0,
          verifiedReviewsCount: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          fitDistribution: { runs_small: 0, true_to_size: 0, runs_large: 0 },
          mediaCount: 0,
        },
        totalPages: 0,
        currentPage: 1,
        totalCount: 0,
      });
    }

    const allRawReviews = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
      const updatedAt = data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : undefined;
      const publishedAt = data.publishedAt?.toDate?.() ? data.publishedAt.toDate().toISOString() : undefined;

      return {
        id: doc.id,
        productId: data.productId || null,
        productTitle: data.productTitle,
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        userId: data.userId || 'anonymous',
        userName: data.userName || 'Customer',
        userEmailMasked: data.userEmailMasked || (data.userEmail ? maskEmail(data.userEmail) : undefined),
        userPhoto: data.userPhoto || null,
        rating: Number(data.rating) || 5,
        title: data.title || '',
        text: data.text || data.body || '',
        fit: data.fit as FitFeedback | undefined,
        media: (data.media || []) as ReviewMedia[],
        verifiedPurchase: !!data.verifiedPurchase,
        status: (data.status || (data.approved !== false ? 'approved' : 'pending')) as ReviewStatus,
        approved: data.approved !== false,
        marketingConsent: !!data.marketingConsent,
        helpfulCount: Number(data.helpfulCount) || 0,
        reportCount: Number(data.reportCount) || 0,
        officialReply: data.officialReply || null,
        createdAt,
        updatedAt,
        publishedAt,
      } as Review;
    });

    const isAdminQuery = searchParams.get('admin') === 'true';
    if (isAdminQuery) {
      const decoded = await getAuthenticatedUser(request);
      if (!decoded?.admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      const adminStatusFilter = searchParams.get('status');
      let adminReviews = allRawReviews;
      if (adminStatusFilter && adminStatusFilter !== 'all') {
        adminReviews = adminReviews.filter((r) => r.status === adminStatusFilter);
      }
      adminReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ reviews: adminReviews });
    }

    // Filter to approved reviews only for public queries
    const approvedReviews = allRawReviews.filter(
      (r) => r.status === 'approved' || (r.approved && r.status !== 'rejected' && r.status !== 'flagged')
    );

    // Calculate Summary Statistics from ONLY approved reviews
    const ratingDistribution: { [star: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const fitDistribution = { runs_small: 0, true_to_size: 0, runs_large: 0 };
    let totalScore = 0;
    let verifiedCount = 0;
    let totalMediaCount = 0;

    for (const r of approvedReviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      ratingDistribution[star] = (ratingDistribution[star] || 0) + 1;
      totalScore += r.rating;
      if (r.verifiedPurchase) verifiedCount += 1;
      if (r.media && r.media.length > 0) totalMediaCount += r.media.length;
      if (r.fit && fitDistribution[r.fit] !== undefined) {
        fitDistribution[r.fit] += 1;
      }
    }

    const totalReviews = approvedReviews.length;
    const averageRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : 0;

    const summary: ProductReviewSummary = {
      averageRating,
      totalReviews,
      verifiedReviewsCount: verifiedCount,
      ratingDistribution,
      fitDistribution,
      mediaCount: totalMediaCount,
    };

    // Apply Client Filter & Sort Parameters
    let filteredReviews = [...approvedReviews];

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      filteredReviews = filteredReviews.filter((r) => Math.round(r.rating) === ratingFilter);
    }
    if (mediaOnly) {
      filteredReviews = filteredReviews.filter((r) => r.media && r.media.length > 0);
    }
    if (verifiedOnly) {
      filteredReviews = filteredReviews.filter((r) => r.verifiedPurchase);
    }

    // Sort Logic
    filteredReviews.sort((a, b) => {
      if (sort === 'highest') return b.rating - a.rating;
      if (sort === 'lowest') return a.rating - b.rating;
      if (sort === 'media') return (b.media?.length || 0) - (a.media?.length || 0);
      if (sort === 'verified') return (b.verifiedPurchase ? 1 : 0) - (a.verifiedPurchase ? 1 : 0);
      // Default: Most Recent
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const totalCount = filteredReviews.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = filteredReviews.slice(startIndex, startIndex + limit).map(toPublicSafeReviewDto);

    return NextResponse.json({
      reviews: paginatedReviews,
      summary,
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (err: any) {
    console.error('[api/reviews] GET Error:', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST: Create or Update a Review with Server-Side Verification
export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'reviews_post', { limit: 20, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      reviewId,
      productId,
      productTitle,
      rating,
      title,
      text,
      fit,
      media,
      orderId,
      reviewToken,
      marketingConsent,
    } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5 stars' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Review text cannot be empty' }, { status: 400 });
    }

    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 120) : '';
    const cleanText = text.trim().slice(0, 2000);
    const cleanFit: FitFeedback | undefined = ['runs_small', 'true_to_size', 'runs_large'].includes(fit) ? fit : undefined;
    const targetProductId = typeof productId === 'string' && productId.trim() ? productId.trim() : null;

    // Validate media array
    const cleanMedia: ReviewMedia[] = [];
    if (Array.isArray(media)) {
      for (const item of media.slice(0, 5)) {
        if (item && typeof item.url === 'string' && item.url.trim()) {
          const mediaObj: ReviewMedia = {
            type: item.type === 'video' ? 'video' : 'image',
            url: item.url.trim(),
          };
          if (item.playbackUrl && typeof item.playbackUrl === 'string' && item.playbackUrl.trim()) {
            mediaObj.playbackUrl = item.playbackUrl.trim();
          }
          if (item.originalUrl && typeof item.originalUrl === 'string' && item.originalUrl.trim()) {
            mediaObj.originalUrl = item.originalUrl.trim();
          }
          if (item.thumbnailUrl && typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.trim()) {
            mediaObj.thumbnailUrl = item.thumbnailUrl.trim();
          }
          cleanMedia.push(mediaObj);
        }
      }
    }

    // Determine Authenticated User or Token Verification
    let uid = 'anonymous';
    let userName = 'Verified Customer';
    let userEmail: string | undefined;
    let verifiedPurchase = false;
    let verifiedOrderId = typeof orderId === 'string' ? orderId.trim() : undefined;

    // 1. Check if token authentication is provided
    let hasValidToken = false;
    if (reviewToken && typeof reviewToken === 'string') {
      const tokenPayload = verifyReviewToken(reviewToken);
      if (tokenPayload) {
        hasValidToken = true;
        verifiedOrderId = tokenPayload.orderId;
        if (tokenPayload.email) {
          userEmail = tokenPayload.email;
          const parts = tokenPayload.email.split('@');
          userName = parts[0] ? `${parts[0].slice(0, 1).toUpperCase()}${parts[0].slice(1)}` : 'Customer';
        }
      }
    }

    // 2. Check session/Bearer authentication if token was not used
    const decoded = await getAuthenticatedUser(request);
    if (decoded) {
      uid = decoded.uid;
      // Only fallback to session email if a verified review token was NOT provided
      if (!hasValidToken) {
        userEmail = decoded.email || userEmail;
      }
      
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      if (!hasValidToken) {
        userName = userData?.displayName || decoded.name || decoded.email?.split('@')[0] || userName;
      }
    }

    // 3. Resolve reviewer's referral code for post-review viral bridge loop
    let reviewerReferralCode: string | null = null;
    if (uid && uid !== 'anonymous') {
      const uDoc = await adminDb.collection('users').doc(uid).get();
      if (uDoc.exists) reviewerReferralCode = uDoc.data()?.referralCode || null;
    }
    if (!reviewerReferralCode && userEmail) {
      const emailSnap = await adminDb.collection('users').where('email', '==', userEmail.trim().toLowerCase()).limit(1).get();
      if (!emailSnap.empty) {
        reviewerReferralCode = emailSnap.docs[0].data()?.referralCode || null;
      }
    }

    // 4. Strict Server-Side Purchase Verification Rule
    if (verifiedOrderId) {
      const orderDoc = await adminDb.collection('orders').doc(verifiedOrderId).get();
      if (orderDoc.exists) {
        const orderData = orderDoc.data()!;
        if (!reviewerReferralCode && orderData.userReferralCode) {
          reviewerReferralCode = orderData.userReferralCode;
        }

        // Must match either HMAC review token or authenticated session user
        const matchesUser =
          hasValidToken ||
          (uid !== 'anonymous' && orderData.userId === uid) ||
          (userEmail && orderData.userEmail?.toLowerCase() === userEmail.toLowerCase());

        // Order must be completed payment AND not refunded or cancelled
        const isCompletedPayment =
          (orderData.paymentCaptured === true ||
            orderData.paymentStatus === 'completed' ||
            ['paid', 'in_production', 'shipped', 'delivered', 'queued_for_printify'].includes(orderData.status)) &&
          !['refunded', 'cancelled', 'failed'].includes(orderData.status) &&
          !orderData.refunded &&
          orderData.refundStatus !== 'refunded';

        if (matchesUser && isCompletedPayment) {
          const items: any[] = Array.isArray(orderData.items) ? orderData.items : [];
          const matchesProduct =
            !targetProductId ||
            items.some((i) => i.productId === targetProductId || i.slug === targetProductId || i.id === targetProductId);
          if (matchesProduct) {
            verifiedPurchase = true;
          }
        }
      }
    }

    // Ensure reviewer has a referral code for the viral bridge loop
    if (!reviewerReferralCode) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'GERK-';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      reviewerReferralCode = code;
      if (verifiedOrderId) {
        await adminDb.collection('orders').doc(verifiedOrderId).update({
          userReferralCode: code,
        }).catch(() => {});
      }
      if (uid && uid !== 'anonymous') {
        await adminDb.collection('users').doc(uid).set({
          referralCode: code,
        }, { merge: true }).catch(() => {});
      }
    }

    const userEmailMasked = maskEmail(userEmail) || null;

    // Initial Moderation Status: Verified purchases publish immediately as approved, unverified enter pending queue
    const status: ReviewStatus = verifiedPurchase ? 'approved' : 'pending';
    const approved = verifiedPurchase;

    if (reviewId && typeof reviewId === 'string') {
      // Edit existing review
      const reviewRef = adminDb.collection('reviews').doc(reviewId);
      const reviewDoc = await reviewRef.get();
      if (!reviewDoc.exists) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }

      const reviewData = reviewDoc.data()!;
      const isReviewOwner = uid !== 'anonymous' && reviewData.userId === uid;
      const hasMatchingToken = hasValidToken && verifiedOrderId && reviewData.orderId === verifiedOrderId;
      const isAdmin = !!decoded?.admin;

      if (!isReviewOwner && !hasMatchingToken && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this review' }, { status: 403 });
      }

      const updateData: Record<string, any> = {
        rating,
        title: cleanTitle,
        text: cleanText,
        fit: cleanFit || null,
        media: cleanMedia,
        productId: targetProductId,
        productTitle: typeof productTitle === 'string' && productTitle.trim() ? productTitle.trim() : reviewData.productTitle || null,
        marketingConsent: !!marketingConsent,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (verifiedPurchase) {
        updateData.verifiedPurchase = true;
        updateData.status = 'approved';
        updateData.approved = true;
      }

      await reviewRef.update(updateData);

      return NextResponse.json({
        success: true,
        id: reviewId,
        verifiedPurchase,
        status: verifiedPurchase ? 'approved' : reviewData.status,
        referralCode: reviewerReferralCode,
      });
    } else {
      // Duplicate prevention: check if user/order combination already reviewed this product
      if (uid !== 'anonymous' || verifiedOrderId) {
        try {
          let existingQuery: FirebaseFirestore.Query = adminDb.collection('reviews');
          if (uid !== 'anonymous') {
            existingQuery = existingQuery.where('userId', '==', uid);
          } else if (verifiedOrderId) {
            existingQuery = existingQuery.where('orderId', '==', verifiedOrderId);
          }

          if (targetProductId) {
            existingQuery = existingQuery.where('productId', '==', targetProductId);
          }

          const existingSnap = await existingQuery.limit(1).get();

          if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            const existingData = existingDoc.data();
            const updateData: Record<string, any> = {
              rating,
              title: cleanTitle,
              text: cleanText,
              fit: cleanFit || null,
              media: cleanMedia,
              productId: targetProductId,
              productTitle: typeof productTitle === 'string' && productTitle.trim() ? productTitle.trim() : existingData.productTitle || null,
              marketingConsent: !!marketingConsent,
              updatedAt: FieldValue.serverTimestamp(),
            };

            if (verifiedPurchase) {
              updateData.verifiedPurchase = true;
              updateData.status = 'approved';
              updateData.approved = true;
            }

            await existingDoc.ref.update(updateData);

            return NextResponse.json({
              success: true,
              id: existingDoc.id,
              verifiedPurchase,
              status: verifiedPurchase ? 'approved' : (existingData.status || 'pending'),
              updated: true,
              referralCode: reviewerReferralCode,
            });
          }
        } catch (dupErr) {
          console.warn('[api/reviews] Duplicate query non-fatal fallback:', dupErr);
        }
      }

      // Create new review with guaranteed non-undefined fields
      const newDocData: Record<string, any> = {
        productId: targetProductId || null,
        productTitle: typeof productTitle === 'string' && productTitle.trim() ? productTitle.trim() : null,
        orderId: verifiedOrderId || null,
        userId: uid || 'anonymous',
        userName: userName || 'Customer',
        userEmailMasked: userEmailMasked || null,
        rating: Number(rating),
        title: cleanTitle || '',
        text: cleanText,
        fit: cleanFit || null,
        media: cleanMedia || [],
        verifiedPurchase: !!verifiedPurchase,
        status: status || 'pending',
        approved: !!approved,
        marketingConsent: !!marketingConsent,
        helpfulCount: 0,
        reportCount: 0,
        officialReply: null,
        createdAt: FieldValue.serverTimestamp(),
        publishedAt: approved ? FieldValue.serverTimestamp() : null,
      };

      const newReviewDoc = await adminDb.collection('reviews').add(newDocData);

      return NextResponse.json({
        success: true,
        id: newReviewDoc.id,
        verifiedPurchase,
        status,
        referralCode: reviewerReferralCode,
      });
    }
  } catch (err: any) {
    console.error('[api/reviews] POST Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to submit review' }, { status: 500 });
  }
}

// PATCH: Admin Moderation Actions & Staff Replies
export async function PATCH(request: NextRequest) {
  try {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded?.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');

    if (filterStatus) {
      // List reviews for Admin Moderation Queue
      let query: FirebaseFirestore.Query = adminDb.collection('reviews');
      if (filterStatus !== 'all') {
        if (filterStatus === 'pending') {
          query = query.where('status', '==', 'pending');
        } else if (filterStatus === 'approved') {
          query = query.where('status', '==', 'approved');
        } else if (filterStatus === 'flagged') {
          query = query.where('status', '==', 'flagged');
        } else if (filterStatus === 'rejected') {
          query = query.where('status', '==', 'rejected');
        }
      }

      let snap: FirebaseFirestore.QuerySnapshot;
      try {
        snap = await query.limit(100).get();
      } catch {
        snap = await adminDb.collection('reviews').limit(100).get();
      }

      const list = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          productId: data.productId,
          productTitle: data.productTitle,
          orderId: data.orderId,
          userId: data.userId,
          userName: data.userName,
          userEmailMasked: data.userEmailMasked,
          rating: data.rating,
          title: data.title,
          text: data.text,
          fit: data.fit,
          media: data.media || [],
          verifiedPurchase: !!data.verifiedPurchase,
          status: data.status || (data.approved ? 'approved' : 'pending'),
          officialReply: data.officialReply,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      });

      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      return NextResponse.json(list);
    }

    const body = await request.json();
    const { reviewId, action, replyText } = body;

    if (!reviewId || !['approve', 'reject', 'flag', 'reply', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Valid reviewId and action required' }, { status: 400 });
    }

    const reviewRef = adminDb.collection('reviews').doc(reviewId);
    const doc = await reviewRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (action === 'approve') {
      await reviewRef.update({
        status: 'approved',
        approved: true,
        moderatedBy: decoded.uid,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'reject') {
      await reviewRef.update({
        status: 'rejected',
        approved: false,
        moderatedBy: decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'flag') {
      await reviewRef.update({
        status: 'flagged',
        moderatedBy: decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'reply') {
      if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
        return NextResponse.json({ error: 'Reply text cannot be empty' }, { status: 400 });
      }
      await reviewRef.update({
        officialReply: {
          text: replyText.trim().slice(0, 1000),
          author: 'GERKINK Team',
          createdAt: new Date().toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'delete') {
      await reviewRef.delete();
    }

    return NextResponse.json({ success: true, action });
  } catch (err: any) {
    console.error('[api/reviews] PATCH Error:', err);
    return NextResponse.json({ error: 'Moderation action failed' }, { status: 500 });
  }
}

// DELETE: Delete a Review (Owner or Admin)
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await getAuthenticatedUser(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });

    const reviewRef = adminDb.collection('reviews').doc(id);
    const reviewDoc = await reviewRef.get();
    if (!reviewDoc.exists) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const data = reviewDoc.data()!;
    if (data.userId !== decoded.uid && !decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await reviewRef.delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[api/reviews] DELETE Error:', err);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
