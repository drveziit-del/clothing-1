import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { paypalGateway } from '@/lib/paypal/client';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import z from 'zod';

const createPrebookPayPalSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'paypal_create_prebook', { limit: 10, windowMs: 15 * 60 * 1000 })) {
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

  const result = createPrebookPayPalSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid body' }, { status: 400 });
  }

  const { orderId } = result.data;

  // 3. Fetch pre-booking order from Firestore
  try {
    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data()!;
    const depositAmount = Number(orderData.total || 500);

    const receipt = `prebook_pp_${Date.now()}`;
    const dummyAddress = {
      name: orderData.prebookName || 'Client',
      street: 'Private Allocation Suite',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
    };

    // Create PayPal order
    const paypalOrder = await paypalGateway.createOrder(
      depositAmount,
      receipt,
      dummyAddress,
      orderData.prebookEmail || email
    );

    // Save paypalOrderId to Firestore order
    await orderRef.update({
      paymentGateway: 'paypal',
      paypalOrderId: paypalOrder.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await appendOrderHistory(orderId, 'paypal_order_created_for_prebooking', 'customer', {
      uid,
      paypalOrderId: paypalOrder.id,
      amount: depositAmount,
    });

    return NextResponse.json({
      orderId,
      paypalOrderId: paypalOrder.id,
      amount: depositAmount,
      currency: 'USD',
    });
  } catch (err) {
    console.error('Error creating PayPal prebook order:', err);
    return NextResponse.json({ error: 'Failed to initialize PayPal order' }, { status: 500 });
  }
}
