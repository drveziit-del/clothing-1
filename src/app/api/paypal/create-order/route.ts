import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { paypalGateway } from '@/lib/paypal/client';
import { createOrderSchema } from '@/lib/utils/validation';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { validateCoupon } from '@/lib/utils/couponValidator';
import { calculateTax } from '@/lib/utils/taxCalculator';
import { appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import type { OrderItem } from '@/types';

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'paypal_create_order', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // 1. Auth check (logged in user OR guest)
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  let uid = `guest_${Date.now()}`;
  let email = 'guest@gerkink.shop';

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      uid   = decoded.uid;
      email = decoded.email ?? email;
    } catch {}
  }

  // 2. Validate request body
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = createOrderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues?.[0]?.message || 'Validation error' }, { status: 400 });
  }

  const { items, referralCode, couponCode, shippingAddress } = result.data;

  // 3. Server-side price validation & atomic stock reservation transaction
  const receipt = `gkink_${Date.now()}`;
  const orderRef = adminDb.collection('orders').doc();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins expiration

  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  try {
    await adminDb.runTransaction(async (transaction) => {
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
      const productRefs = uniqueProductIds.map((id) => adminDb.collection('products').doc(id));
      const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

      const productMap = new Map<string, any>();
      for (const snap of productSnaps) {
        if (snap.exists) productMap.set(snap.id, snap.data());
      }

      subtotal = 0;
      orderItems.length = 0;

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product || !product.isPublished) {
          throw new Error(`Product ${item.productId} is unavailable`);
        }

        const variantIndex = (product.variants || []).findIndex((v: any) => String(v.id) === String(item.variantId));
        if (variantIndex === -1) {
          throw new Error(`Variant ${item.variantId} not found`);
        }

        const variant = product.variants[variantIndex];
        if (!variant.available) {
          throw new Error(`Variant ${variant.title || item.variantId} is sold out`);
        }

        // Verify stock if stock management is enabled
        if (typeof variant.stock === 'number' && variant.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.title}`);
        }

        const lineTotal = variant.price * item.quantity;
        subtotal += lineTotal;

        orderItems.push({
          productId:         item.productId,
          title:             product.title,
          variant,
          quantity:          item.quantity,
          price:             variant.price,
          image:             Array.isArray(product.images) ? (typeof product.images[0] === 'string' ? product.images[0] : (product.images[0]?.src || '')) : (typeof product.images === 'string' ? product.images : ''),
          printifyProductId: product.printifyId,
        });

        // Reserve stock
        if (typeof variant.stock === 'number') {
          product.variants[variantIndex].stock = variant.stock - item.quantity;
          transaction.update(adminDb.collection('products').doc(item.productId), {
            variants:  product.variants,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });
  } catch (stockErr: any) {
    return NextResponse.json({ error: stockErr.message || 'Stock reservation failed' }, { status: 400 });
  }

  // 4. Calculate Tax & Coupon Discounts
  const tax = calculateTax(shippingAddress.country, subtotal);
  let total = subtotal + tax;
  let discount = 0;

  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, uid, subtotal, tax);
    if (!couponResult.valid) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }
    discount = couponResult.discount;
    total = Math.max(0, subtotal + tax - discount);
  }

  // 5. Create Pending Firestore Order
  const baseOrderData = {
    userId:          uid,
    userEmail:       email,
    items:           orderItems,
    subtotal,
    tax,
    discount,
    total,
    paymentGateway:  'paypal',
    paymentCaptured: false,
    paypalOrderId:   '',
    status:          'pending',
    referralCode:    referralCode ?? null,
    couponCode:      couponCode ?? null,
    shippingAddress,
    expiresAt,
    emailSent:       false,
    createdAt:       FieldValue.serverTimestamp(),
  };

  // 5. Create PayPal REST v2 Order Token & Firestore Order in Parallel
  let paypalOrderToken: { id: string; amount: number; currency: string };
  try {
    const [tokenResult] = await Promise.all([
      paypalGateway.createOrder(total, receipt, shippingAddress, email),
      orderRef.set(baseOrderData),
    ]);
    paypalOrderToken = tokenResult;
  } catch (err: any) {
    await orderRef.delete().catch(() => {});
    console.error('[paypal/create-order] Error creating PayPal order:', err);
    return NextResponse.json({ error: err.message || 'PayPal gateway error' }, { status: 500 });
  }

  // Asynchronously record timeline history without blocking response
  Promise.all([
    orderRef.update({ paypalOrderId: paypalOrderToken.id }),
    appendOrderHistory(orderRef.id, 'order_created_pending', 'customer', { receipt, total }),
    appendOrderHistory(orderRef.id, 'paypal_order_token_created', 'system', { paypalOrderId: paypalOrderToken.id }),
  ]).catch((e) => console.error('Background order history update error:', e));

  return NextResponse.json({
    orderId:       orderRef.id,
    paypalOrderId: paypalOrderToken.id,
    amount:        paypalOrderToken.amount,
    currency:      paypalOrderToken.currency,
    total,
    discount,
  });
}
