import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createRazorpayOrder } from '@/lib/razorpay/client';
import { createOrderSchema } from '@/lib/utils/validation';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { validateCoupon } from '@/lib/utils/couponValidator';
import type { OrderItem } from '@/types';

const TAX_RATE = 0.08;

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'create_order', { limit: 10, windowMs: 15 * 60 * 1000 })) {
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

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = createOrderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const { items, referralCode, couponCode, shippingAddress } = result.data;

  // 3. Validate prices against Firestore (prevent tampering)
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  // Batch read all unique products
  const uniqueProductIds = Array.from(new Set(items.map(item => item.productId)));
  const productRefs = uniqueProductIds.map(id => adminDb.collection('products').doc(id));
  let productSnapshots: any[] = [];

  try {
    productSnapshots = await adminDb.getAll(...productRefs);
  } catch (err) {
    console.error('Error fetching products in batch:', err);
    return NextResponse.json({ error: 'Failed to retrieve product details' }, { status: 500 });
  }

  // Map product snapshots by their ID
  const productMap = new Map<string, any>();
  for (const doc of productSnapshots) {
    if (doc.exists) {
      productMap.set(doc.id, doc.data());
    }
  }

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
    }

    if (!product.isPublished) {
      return NextResponse.json({ error: `Product is not available` }, { status: 400 });
    }

    const variant = product.variants?.find((v: { id: string }) => v.id === item.variantId);
    if (!variant || !variant.available) {
      return NextResponse.json({ error: `Variant not available` }, { status: 400 });
    }

    const lineTotal = variant.price * item.quantity;
    subtotal += lineTotal;

    orderItems.push({
      productId: item.productId,
      title: product.title,
      variant,
      quantity: item.quantity,
      price: variant.price,
      image: product.images?.[0] ?? '',
      printifyProductId: product.printifyId,
    });
  }

  const tax = subtotal * TAX_RATE;
  let total = subtotal + tax;
  let discount = 0;

  // Validate coupon code
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, uid, subtotal, tax);
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }
    discount = couponResult.discount;
    total = Math.max(0, (subtotal + tax) - discount);
  }

  // 4. Create Firestore order (pending)
  const receipt = `gkink_${Date.now()}`;
  const orderRef = adminDb.collection('orders').doc();

  const baseOrderData = {
    userId:          uid,
    userEmail:       email,
    items:           orderItems,
    subtotal,
    tax,
    discount,
    total,
    razorpayOrderId: '', // filled next
    status:          'pending',
    referralCode:    referralCode ?? null,
    couponCode:      couponCode ?? null,
    shippingAddress,
    createdAt:       FieldValue.serverTimestamp(),
  };

  await orderRef.set(baseOrderData);

  // 5. Handle free checkout
  if (total <= 0) {
    await orderRef.update({ razorpayOrderId: 'free_order' });
    return NextResponse.json({
      orderId:         orderRef.id,
      razorpayOrderId: 'free_order',
      amount:          0,
      currency:        'USD',
      total:           0,
      discount,
    });
  }

  // 6. Create Razorpay order
  let rzpOrder: { id: string; amount: number; currency: string };
  try {
    rzpOrder = await createRazorpayOrder(total, receipt);
  } catch (err: any) {
    await orderRef.delete();
    const details = err?.error?.description || err?.message || 'Unknown payment gateway error';
    console.error('[create-order] Razorpay order creation failed:');
    console.error('[create-order] Details:', details);
    console.error('[create-order] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    return NextResponse.json({ 
      error: 'Payment gateway error'
    }, { status: 500 });
  }

  // 7. Update Firestore order with Razorpay order ID
  await orderRef.update({ razorpayOrderId: rzpOrder.id });

  return NextResponse.json({
    orderId:         orderRef.id,
    razorpayOrderId: rzpOrder.id,
    amount:          rzpOrder.amount,
    currency:        rzpOrder.currency,
    total,
    discount,
  });
}
