import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { createOrder as createPrintifyOrder } from '@/lib/printify/client';
import { cookies } from 'next/headers';
import { normalizeCountryCode, normalizeRegionCode } from '@/lib/utils/isoCodes';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    let decoded: any = null;

    if (session) {
      try {
        decoded = await adminAuth.verifySessionCookie(session, true);
      } catch (err) {
        console.warn('[retry-printify] Session cookie verification failed, checking bearer token...');
      }
    }

    if (!decoded) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const idToken = authHeader.substring(7);
        try {
          decoded = await adminAuth.verifyIdToken(idToken);
        } catch (err) {
          console.warn('[retry-printify] Bearer token verification failed:', err);
        }
      }
    }

    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
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

    const countryCode = normalizeCountryCode(addr.country);
    const regionCode = normalizeRegionCode(addr.state, countryCode);

    let printifyOrderId: string | null = null;

    const printifyItems = (order.items || [])
      .filter((i: any) => i.printifyProductId && !isNaN(Number(i.variant?.printifyVariantId ?? i.variant?.id)));

    if (printifyItems.length === 0) {
      return NextResponse.json({ error: 'This order does not contain any Printify products to submit.' }, { status: 400 });
    }

    try {
      const printifyOrder = await createPrintifyOrder(shopId, {
        external_id: orderId,
        label: `GERKINK-${orderId}`,
        line_items: printifyItems.map((i: any) => ({
          product_id: i.printifyProductId,
          variant_id: Number(i.variant?.printifyVariantId ?? i.variant?.id),
          quantity: i.quantity || 1,
        })),
        shipping_method: 1,
        address_to: {
          first_name: firstName,
          last_name: lastName,
          email: order.userEmail || 'customer@gerkink.shop',
          phone: addr.phone || '0000000000',
          country: countryCode,
          region: regionCode,
          address1: addr.street || '123 Main St',
          city: addr.city || 'New York',
          zip: String(addr.zip || '10001').trim(),
        },
      });
      printifyOrderId = printifyOrder.id;
    } catch (err: any) {
      const errMsg = err?.message || '';
      // Check if error contains 409 / Order already exists with an order ID
      if (errMsg.includes('409') && errMsg.includes('already exists')) {
        const match = errMsg.match(/"id":"([a-z0-9]+)"/i);
        if (match && match[1]) {
          printifyOrderId = match[1];
        } else if (order.printifyOrderId) {
          printifyOrderId = order.printifyOrderId;
        }
      }

      if (!printifyOrderId) {
        // Parse Printify error details if available
        let detailedError = errMsg;
        try {
          const jsonStart = errMsg.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(errMsg.slice(jsonStart));
            detailedError = parsed.message || parsed.errors?.reason || errMsg;
          }
        } catch {}

        return NextResponse.json({ error: `Printify Error: ${detailedError}` }, { status: 400 });
      }
    }

    await orderRef.update({
      printifyOrderId,
      status: 'in_production',
      fulfillmentAttempted: true,
      fulfillmentError: null,
    });

    return NextResponse.json({
      success: true,
      printifyOrderId,
    });
  } catch (err: unknown) {
    console.error('Printify order retry failed:', err);
    return NextResponse.json({ error: 'Printify order submission failed' }, { status: 500 });
  }
}
