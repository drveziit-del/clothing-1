import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createRazorpayOrder } from '@/lib/razorpay/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import type { OrderItem } from '@/types';

export async function POST(request: NextRequest) {
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
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { productId, variantId, name, email: prebookEmail, message } = body;
  if (!productId || !variantId || !name || !prebookEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 3. Fetch product details from Firestore
  try {
    const productDoc = await adminDb.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 400 });
    }

    const product = productDoc.data()!;
    if (!product.isPublished) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    if (product.section !== 'society_fuckers') {
      return NextResponse.json({ error: 'Pre-booking is only available for luxury products' }, { status: 400 });
    }

    const variant = product.variants?.find((v: { id: string }) => v.id === variantId);
    if (!variant || !variant.available) {
      return NextResponse.json({ error: 'Selected variant is not available' }, { status: 400 });
    }

    // Set pre-booking price (default to 500 if not set)
    const prebookingFee = product.prebookingPrice !== undefined && product.prebookingPrice !== null
      ? Number(product.prebookingPrice)
      : 500;

    const orderItems: OrderItem[] = [{
      productId,
      title: product.title,
      variant,
      quantity: 1,
      price: prebookingFee,
      image: product.images?.[0] ?? '',
      printifyProductId: product.printifyId,
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
