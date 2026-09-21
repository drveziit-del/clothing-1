import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';
import type { Product } from '@/types';

async function getAuthenticatedUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * GET /api/favorites
 * Fetches all favorited product IDs and full product details from the authoritative catalog.
 */
export async function GET(request: NextRequest) {
  if (isRateLimited(request, 'favorites_get', { limit: 120, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const uid = await getAuthenticatedUid();
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const favoritesSnap = await adminDb.collection('users').doc(uid).collection('favorites').get();
    const favoriteIds = favoritesSnap.docs.map((doc) => doc.id);

    if (favoriteIds.length === 0) {
      return NextResponse.json({ favoriteIds: [], products: [] });
    }

    // Fetch authoritative product documents in chunks of 30 (Firestore in limit)
    const products: Product[] = [];
    const CHUNK_SIZE = 30;

    for (let i = 0; i < favoriteIds.length; i += CHUNK_SIZE) {
      const chunk = favoriteIds.slice(i, i + CHUNK_SIZE);
      const productDocs = await Promise.all(
        chunk.map((id) => adminDb.collection('products').doc(id).get())
      );

      for (const pDoc of productDocs) {
        if (pDoc.exists) {
          const data = pDoc.data();
          if (data && data.isPublished !== false) {
            products.push({
              id: pDoc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            } as Product);
          }
        }
      }
    }

    return NextResponse.json({
      favoriteIds,
      products,
    });
  } catch (err: any) {
    console.error('Error fetching favorites:', err);
    return NextResponse.json({ error: 'Failed to retrieve favorites.' }, { status: 500 });
  }
}

/**
 * POST /api/favorites
 * Idempotently saves a favorite association in users/{uid}/favorites/{productId}.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'favorites_post', { limit: 60, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const uid = await getAuthenticatedUid();
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  const { productId } = body || {};
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return NextResponse.json({ error: 'Valid productId is required.' }, { status: 400 });
  }

  const cleanProductId = productId.trim();

  // Validate product existence in authoritative catalog
  const productDoc = await adminDb.collection('products').doc(cleanProductId).get();
  if (!productDoc.exists) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  const productData = productDoc.data();
  if (productData?.isPublished === false) {
    return NextResponse.json({ error: 'Product is not available.' }, { status: 400 });
  }

  try {
    const favoriteRef = adminDb.collection('users').doc(uid).collection('favorites').doc(cleanProductId);
    await favoriteRef.set(
      {
        productId: cleanProductId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      isFavorited: true,
      productId: cleanProductId,
    });
  } catch (err: any) {
    console.error('Error adding favorite:', err);
    return NextResponse.json({ error: 'Failed to save favorite.' }, { status: 500 });
  }
}

/**
 * DELETE /api/favorites
 * Idempotently removes a favorite association from users/{uid}/favorites/{productId}.
 */
export async function DELETE(request: NextRequest) {
  if (isRateLimited(request, 'favorites_delete', { limit: 60, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const uid = await getAuthenticatedUid();
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let productId = request.nextUrl.searchParams.get('productId');

  if (!productId) {
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        productId = body.productId;
      }
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }
  }

  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return NextResponse.json({ error: 'Valid productId is required.' }, { status: 400 });
  }

  const cleanProductId = productId.trim();

  try {
    const favoriteRef = adminDb.collection('users').doc(uid).collection('favorites').doc(cleanProductId);
    await favoriteRef.delete();

    return NextResponse.json({
      success: true,
      isFavorited: false,
      productId: cleanProductId,
    });
  } catch (err: any) {
    console.error('Error removing favorite:', err);
    return NextResponse.json({ error: 'Failed to remove favorite.' }, { status: 500 });
  }
}
