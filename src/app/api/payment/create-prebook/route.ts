import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createRazorpayOrder } from '@/lib/razorpay/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { createPrebookSchema } from '@/lib/utils/validation';
import { isRateLimited } from '@/lib/utils/rateLimit';
import type { OrderItem } from '@/types';

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'create_prebook', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // 1. Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid   = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = createPrebookSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { productId, variantId, name, email: prebookEmail, message } = result.data;

  // 3. Fetch product details from Firestore (by Doc ID or by Slug)
  try {
    let product: any = null;
    let actualProductId = productId;

    const productDoc = await adminDb.collection('products').doc(productId).get();
    if (productDoc.exists) {
      product = productDoc.data();
      actualProductId = productDoc.id;
    } else {
      const slugSnap = await adminDb.collection('products').where('slug', '==', productId).limit(1).get();
      if (!slugSnap.empty) {
        product = slugSnap.docs[0].data();
        actualProductId = slugSnap.docs[0].id;
      } else {
        const titleSnap = await adminDb.collection('products').where('title', '==', productId).limit(1).get();
        if (!titleSnap.empty) {
          product = titleSnap.docs[0].data();
          actualProductId = titleSnap.docs[0].id;
        }
      }
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 400 });
    }

    // Resolve or construct variant
    let variant = product.variants?.find((v: { id: string }) => v.id === variantId);
    if (!variant) {
      variant = (Array.isArray(product.variants) && product.variants.length > 0)
        ? product.variants[0]
        : {
            id: variantId || 'default',
            title: 'Bespoke Custom Allocation',
            size: 'ONE SIZE',
            color: 'DEFAULT',
            price: Number(product.price || 500),
            available: true,
          };
    }

    // Set pre-booking price (default to 500 if not set)
    const prebookingFee = product.prebookingPrice !== undefined && product.prebookingPrice !== null
      ? Number(product.prebookingPrice)
      : 500;

    const orderItems: OrderItem[] = [{
      productId: actualProductId,
      title: product.title || 'Society Fu*kers Piece',
      variant,
      quantity: 1,
      price: prebookingFee,
      image: product.images?.[0] ?? '',
      printifyProductId: product.printifyId || '',
    }];

    // 4. Create Firestore prebooking order (pending)
    const receipt = `prebook_${Date.now()}`;
    const orderRef = adminDb.collection('orders').doc();

    const prebookingOrderData = {
      userId:          uid,
      userEmail:       email,
      items:           orderItems,
      subtotal:        prebookingFee,
      tax:             0,
      discount:        0,
      total:           prebookingFee,
      razorpayOrderId: '', // filled next
      status:          'pending',
      isPrebooking:    true,
      prebookName:     name,
      prebookEmail:    prebookEmail,
      prebookMessage:  message || '',
      createdAt:       FieldValue.serverTimestamp(),
    };

    await orderRef.set(prebookingOrderData);

    // 5. Handle free prebooking (in case fee is 0, though highly unlikely)
    if (prebookingFee <= 0) {
      await orderRef.update({ razorpayOrderId: 'free_order' });
      return NextResponse.json({
        orderId:         orderRef.id,
        razorpayOrderId: 'free_order',
        amount:          0,
        currency:        'USD',
        total:           0,
      });
    }

    // 6. Create Razorpay order
    let rzpOrder: { id: string; amount: number; currency: string };
    try {
      rzpOrder = await createRazorpayOrder(prebookingFee, receipt);
    } catch (err) {
      await orderRef.delete();
      console.error('Razorpay order creation failed for prebooking:', err);
      return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
    }

    // 7. Update Firestore order with Razorpay order ID
    await orderRef.update({ razorpayOrderId: rzpOrder.id });

    return NextResponse.json({
      orderId:         orderRef.id,
      razorpayOrderId: rzpOrder.id,
      amount:          rzpOrder.amount,
      currency:        rzpOrder.currency,
      total:           prebookingFee,
    });
  } catch (err) {
    console.error('Pre-booking order creation failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
