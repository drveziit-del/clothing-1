import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

async function checkAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return false;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return !!decoded.admin;
  } catch {
    return false;
  }
}

export async function GET() {
  const isAdmin = await checkAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const snap = await adminDb.collection('coupons').get();
    const coupons = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt || null,
      expiresAt: doc.data().expiresAt?.toDate?.() ? doc.data().expiresAt.toDate().toISOString() : doc.data().expiresAt || null,
    }));

    // Sort by createdAt desc
    coupons.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ coupons });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch coupons';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const isAdmin = await checkAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { action } = body;

    // Toggle active status
    if (action === 'toggle') {
      const { couponId, isActive } = body;
      if (!couponId) return NextResponse.json({ error: 'Missing couponId' }, { status: 400 });

      await adminDb.collection('coupons').doc(couponId).update({
        isActive: Boolean(isActive),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    // Create new coupon
    const code = (body.code || '').trim().toUpperCase();
    const type = body.type === 'percentage' ? 'percentage' : 'fixed';
    const value = parseFloat(body.value);
    const isGlobal = Boolean(body.isGlobal);
    const userId = body.userId?.trim() || null;
    const minSubtotal = body.minSubtotal ? parseFloat(body.minSubtotal) : 0;
    const maxUses = body.maxUses ? parseInt(body.maxUses, 10) : null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }
    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ error: 'Coupon discount value must be greater than 0' }, { status: 400 });
    }
    if (type === 'percentage' && value > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
    }
    if (!isGlobal && !userId) {
      return NextResponse.json({ error: 'Please specify a User ID or make the coupon Global' }, { status: 400 });
    }

    // Check code uniqueness
    const existing = await adminDb.collection('coupons').where('code', '==', code).get();
    if (!existing.empty) {
      return NextResponse.json({ error: `Coupon code "${code}" already exists` }, { status: 400 });
    }

    const newCoupon = {
      code,
      type,
      value,
      isGlobal,
      userId: isGlobal ? null : userId,
      isActive: true,
      isUsed: false,
      timesUsed: 0,
      minSubtotal,
      maxUses,
      expiresAt,
      createdBy: 'admin',
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('coupons').add(newCoupon);

    return NextResponse.json({
      success: true,
      coupon: {
        id: docRef.id,
        ...newCoupon,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save coupon';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const isAdmin = await checkAdminSession();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const couponId = searchParams.get('id');

    if (!couponId) {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    await adminDb.collection('coupons').doc(couponId).delete();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete coupon';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
