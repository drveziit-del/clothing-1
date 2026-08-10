import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createProductSchema, updateProductSchema } from '@/lib/utils/validation';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return { error: 'Unauthorized', status: 401 };

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) return { error: 'Forbidden', status: 403 };
    return { uid: decoded.uid };
  } catch {
    return { error: 'Invalid session', status: 401 };
  }
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function generateUniqueSlug(title: string, currentProductId?: string): Promise<string> {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let exists = true;
  let counter = 0;

  while (exists) {
    const snap = await adminDb.collection('products')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (snap.empty || (currentProductId && snap.docs[0].id === currentProductId)) {
      exists = false;
    } else {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }
  return slug;
}

// GET all products or a single product
export async function GET(request: NextRequest) {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const doc = await adminDb.collection('products').doc(id).get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    const snapshot = await adminDb.collection('products').orderBy('createdAt', 'desc').get();
    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(products);
  } catch (err) {
    console.error('Error fetching admin products:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST new custom product
export async function POST(request: NextRequest) {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = createProductSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  try {
    const slug = await generateUniqueSlug(result.data.slug || result.data.title);
    const productData = {
      ...result.data,
      slug,
      images: result.data.images && result.data.images.length > 0 ? result.data.images : ['/placeholder-product.png'],
      videos: result.data.videos || [],
      variants: result.data.variants && result.data.variants.length > 0
        ? result.data.variants
        : [
            {
              id: `custom_${Date.now()}`,
              size: 'One Size',
              color: 'Default',
              price: result.data.price,
              available: true,
            },
          ],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('products').add(productData);
    return NextResponse.json({ id: docRef.id, ...productData });
  } catch (err) {
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

// PUT / PATCH to update an existing product
export async function PUT(request: NextRequest) {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = updateProductSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { id, ...dataToUpdate } = result.data;

  try {
    const docRef = adminDb.collection('products').doc(id);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const existingData = existingDoc.data()!;

    let finalSlug = existingData.slug;
    if (dataToUpdate.slug || dataToUpdate.title || !finalSlug) {
      const baseSlugSource = dataToUpdate.slug || dataToUpdate.title || existingData.title;
      finalSlug = await generateUniqueSlug(baseSlugSource, id);
    }

    const updateData: Record<string, any> = {
      ...dataToUpdate,
      slug: finalSlug,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Error updating product:', err);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE product
export async function DELETE(request: NextRequest) {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  try {
    await adminDb.collection('products').doc(id).delete();
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('Error deleting product:', err);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
