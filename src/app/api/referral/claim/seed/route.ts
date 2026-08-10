import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function performSeeding(uid: string) {
  const batch = adminDb.batch();

  // 1. Update user profile to have 10 referrals
  const userRef = adminDb.collection('users').doc(uid);
  batch.update(userRef, {
    referralCount: 10,
  });

  // 2. Create a mock order with a mock payment reference
  const orderId = 'order_mock_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderRef = adminDb.collection('orders').doc(orderId);
  batch.set(orderRef, {
    userId: uid,
    status: 'paid',
    total: 65.50,
    razorpayOrderId: 'order_rzp_mock_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    razorpayPaymentId: 'pay_mock_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    items: [
      {
        productId: 'society-fuckers-tee',
        title: 'Delusional Rich Tee',
        quantity: 1,
        price: 65.50,
      }
    ],
    createdAt: FieldValue.serverTimestamp(),
  });

  // 3. Create a pending referral commission reward
  const referralId = 'ref_mock_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const referralRef = adminDb.collection('referrals').doc(referralId);
  batch.set(referralRef, {
    affiliateUid: uid,
    referredUid: 'referred_mock_user_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    orderId: 'order_referred_mock',
    commission: 100,
    status: 'eligible_for_claim',
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return { orderId, referralId };
}

async function handleRequest(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  let uid = '';
  const { searchParams } = new URL(request.url);
  const queryUid = searchParams.get('uid');

  if (queryUid) {
    uid = queryUid;
  } else {
    // Try to find test affiliate account
    const usersSnap = await adminDb.collection('users')
      .where('email', '==', 'test_affiliate@gerkink.shop')
      .limit(1)
      .get();
    
    if (!usersSnap.empty) {
      uid = usersSnap.docs[0].id;
    } else {
      // Try session cookie
      try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (session) {
          const decoded = await adminAuth.verifySessionCookie(session, true);
          uid = decoded.uid;
        }
      } catch {}
    }
  }

  if (!uid) {
    return NextResponse.json({ error: 'No user ID found to seed. Register or sign in first.' }, { status: 400 });
  }

  try {
    const details = await performSeeding(uid);
    return NextResponse.json({
      status: 'ok',
      message: 'Seeded test user stats, mock paid order, and eligible referral reward.',
      uid,
      ...details,
    });
  } catch (err: any) {
    console.error('Error seeding test data:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleRequest(request);
}
