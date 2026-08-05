import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderDoc.data()!;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    if (!shopId) {
      return NextResponse.json({ error: 'PRINTIFY_SHOP_ID not configured' }, { status: 500 });
    }

    const addr = order.shippingAddress || {};
    const nameParts = (addr.name || 'Customer').trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '-';

    const printifyOrder = await createPrintifyOrder(shopId, {
      external_id: orderId,
      label: `GERKINK-${orderId}`,
      line_items: (order.items || []).map((i: any) => ({
        product_id: i.printifyProductId ?? '',
        variant_id: Number(i.variant?.printifyVariantId ?? i.variant?.id),
        quantity: i.quantity || 1,
      })),
      shipping_method: 1,
      address_to: {
        first_name: firstName,
        last_name: lastName,
        email: order.userEmail || 'customer@gerkink.shop',
        country: (addr.country || 'US').toUpperCase().trim(),
        region: (addr.state || 'NY').toUpperCase().trim(),
        address1: addr.street || '123 Main St',
        city: addr.city || 'New York',
        zip: String(addr.zip || '10001').trim(),
      },
    });

    await orderRef.update({
      printifyOrderId: printifyOrder.id,
      status: 'in_production',
      fulfillmentAttempted: true,
      fulfillmentError: null,
    });

    return NextResponse.json({
      success: true,
      printifyOrderId: printifyOrder.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Printify order submission failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
