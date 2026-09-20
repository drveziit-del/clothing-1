import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { allocateCustomerNumber } from '@/lib/customer/sequence';
import { generateSecureReferralCode } from '@/lib/referral/code';

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
      customerNumber: 184,
      isFounding500: true,
      userReferralCode: 'GERK-TEST184',
      shippingAddress: { name: 'Valued Client', city: 'New York', country: 'US' },
      paymentGateway: 'free',
      createdAt: new Date().toISOString(),
    });
  }

  // Auth: session cookie OR guest recovery token (?token= issued at order creation)
  const token = request.nextUrl.searchParams.get('token');
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  let uid: string | null = null;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      uid = decoded.uid;
    } catch {
      uid = null;
    }
  }

  const orderRef = adminDb.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderData = orderDoc.data()!;

  // Access validation: either matching session uid or matching guest recovery token
  if (!session || !uid) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderData.guestToken || typeof token !== 'string' || token.length < 20 ||
        orderData.guestToken !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    // Only the order owner can view their order
    if (orderData.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Ensure customerNumber is allocated if order is paid
  let customerNumber = orderData.customerNumber ?? null;
  let isFounding500 = orderData.isFounding500 ?? null;
  if (typeof customerNumber !== 'number' && (orderData.status === 'paid' || orderData.paymentCaptured)) {
    const alloc = await allocateCustomerNumber(orderId);
    if (alloc) {
      customerNumber = alloc.customerNumber;
      isFounding500 = alloc.isFounding500;
    }
  }

  // Lookup or generate the purchaser's referral code to show their personal referral link on /thank-you
  let userReferralCode: string | null = orderData.userReferralCode || null;
  if (!userReferralCode && orderData.userId && !orderData.userId.startsWith('guest_')) {
    const userDoc = await adminDb.collection('users').doc(orderData.userId).get();
    if (userDoc.exists) {
      userReferralCode = userDoc.data()?.referralCode || null;
    }
  }
  if (!userReferralCode && orderData.userEmail) {
    const emailSnap = await adminDb.collection('users').where('email', '==', orderData.userEmail.trim().toLowerCase()).limit(1).get();
    if (!emailSnap.empty) {
      userReferralCode = emailSnap.docs[0].data()?.referralCode || null;
    }
  }

  // If order is paid and still has no referral code, generate one uniquely and atomically
  if (!userReferralCode && (orderData.status === 'paid' || orderData.paymentCaptured)) {
    try {
      const assignedCode = await adminDb.runTransaction(async (transaction) => {
        const freshOrderDoc = await transaction.get(orderRef);
        if (!freshOrderDoc.exists) return null;
        const freshOrder = freshOrderDoc.data()!;

        // Idempotency: If another concurrent request already assigned it
        if (freshOrder.userReferralCode) {
          return freshOrder.userReferralCode;
        }

        const isRegUser = Boolean(orderData.userId && !orderData.userId.startsWith('guest_'));
        const userRef = isRegUser ? adminDb.collection('users').doc(orderData.userId) : null;
        const userDoc = userRef ? await transaction.get(userRef) : null;

        if (userDoc?.exists && userDoc.data()?.referralCode) {
          const existingUserCode = userDoc.data()!.referralCode;
          transaction.update(orderRef, { userReferralCode: existingUserCode });
          return existingUserCode;
        }

        // Generate and reserve a unique referral code in referral_codes collection
        let uniqueCode = '';
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generateSecureReferralCode();
          const codeRef = adminDb.collection('referral_codes').doc(candidate);
          const codeDoc = await transaction.get(codeRef);
          if (!codeDoc.exists) {
            uniqueCode = candidate;
            transaction.set(codeRef, {
              code: candidate,
              orderId,
              userId: orderData.userId || null,
              createdAt: FieldValue.serverTimestamp(),
            });
            break;
          }
        }

        if (!uniqueCode) {
          throw new Error('Failed to generate a unique referral code after 5 attempts');
        }

        // Atomically update order and user profile
        transaction.update(orderRef, {
          userReferralCode: uniqueCode,
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (userRef) {
          transaction.set(userRef, {
            referralCode: uniqueCode,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        return uniqueCode;
      });

      if (assignedCode) {
        userReferralCode = assignedCode;
      }
    } catch (refGenErr) {
      console.error(`[OrderAPI] Transactional referral code assignment failed for order ${orderId}:`, refGenErr);
    }
  }

  return NextResponse.json({
    id: orderDoc.id,
    items: orderData.items || [],
    subtotal: orderData.subtotal ?? 0,
    tax: orderData.tax ?? 0,
    discount: orderData.discount ?? 0,
    total: orderData.total ?? 0,
    status: orderData.status,
    customerNumber,
    isFounding500,
    userReferralCode,
    shippingAddress: orderData.shippingAddress || null,
    paymentGateway: orderData.paymentGateway || null,
    createdAt: orderData.createdAt?.toDate?.()?.toISOString?.() || null,
  });
}
