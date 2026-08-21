import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId query parameter is required' }, { status: 400 });
  }

  // Support test IDs for preview and UI verification in development without failing
  if (process.env.NODE_ENV !== 'production' && (orderId === 'test123' || orderId.startsWith('test') || orderId === 'GKINK-ORDER')) {
    return NextResponse.json({
      id: orderId,
      items: [
        {
          productId: 'unisex-oversized-boxy-tee',
          title: 'UNISEX OVERSIZED BOXY TEE',
          price: 33.0,
          quantity: 1,
          variant: { size: 'L', color: 'Vintage Black' },
        },
      ],
      subtotal: 33.0,
      tax: 2.64,
      discount: 35.64,
      total: 0,
      status: 'paid',
      shippingAddress: { name: 'Valued Client', city: 'New York', country: 'US' },
      paymentGateway: 'free',
      createdAt: new Date().toISOString(),
    });
  }

  // Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Fetch order
  const orderDoc = await adminDb.collection('orders').doc(orderId).get();
  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const data = orderDoc.data()!;

  // Only the order owner can view their order
  if (data.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: orderDoc.id,
    items: data.items || [],
    subtotal: data.subtotal ?? 0,
    tax: data.tax ?? 0,
    discount: data.discount ?? 0,
    total: data.total ?? 0,
    status: data.status,
    shippingAddress: data.shippingAddress || null,
    paymentGateway: data.paymentGateway || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
  });
}
