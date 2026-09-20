import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';

export async function POST(request: NextRequest) {
  // Anti-enumeration: throttle code guessing (in-memory, per-instance)
  if (isRateLimited(request, 'coupon_validate', { limit: 15, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const code = (body.code || '').trim().toUpperCase();
    const subtotal = Math.max(0, parseFloat(body.subtotal) || 0);

    // Resolve uid from the verified session cookie — never trust a client-supplied userId.
    let uid: string | null = null;
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (session) {
      try {
        const decoded = await adminAuth.verifySessionCookie(session, true);
        uid = decoded.uid;
      } catch {
        uid = null;
      }
    }

    if (!code) {
      return NextResponse.json({ error: 'Please enter a coupon code.' }, { status: 400 });
    }

    // 1. Search user-specific coupon
    let couponSnap = null;
    if (uid) {
      couponSnap = await adminDb
        .collection('coupons')
        .where('code', '==', code)
        .where('userId', '==', uid)
        .where('isUsed', '==', false)
        .limit(1)
        .get();
    }

    // 2. Fallback to global active coupon
    if (!couponSnap || couponSnap.empty) {
      couponSnap = await adminDb
        .collection('coupons')
        .where('code', '==', code)
        .where('isGlobal', '==', true)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    }

    if (!couponSnap || couponSnap.empty) {
      return NextResponse.json(
        { error: 'Invalid, inactive, or already used coupon code.' },
        { status: 400 }
      );
    }

    const couponData = couponSnap.docs[0].data();

    // Check if coupon is inactive
    if (couponData.isActive === false) {
      return NextResponse.json(
        { error: 'This coupon is currently inactive.' },
        { status: 400 }
      );
    }

    // Check max uses if specified for global coupon
    if (couponData.isGlobal && couponData.maxUses) {
      const timesUsed = couponData.timesUsed || 0;
      if (timesUsed >= couponData.maxUses) {
        return NextResponse.json(
          { error: 'This coupon code has reached its maximum usage limit.' },
          { status: 400 }
        );
      }
    }

    // Check min subtotal requirement
    const minSpend = couponData.minSubtotal ?? 0;
    if (minSpend > 0 && subtotal < minSpend) {
      return NextResponse.json(
        { error: `Minimum order subtotal of $${minSpend} required for this coupon.` },
        { status: 400 }
      );
    }

    const tax = parseFloat(body.tax) || (subtotal * 0.08);
    const type = couponData.type || 'percentage';

    // Expiry check (supports Firestore Timestamp and string dates)
    if (couponData.expiresAt) {
      const expiryDate = typeof couponData.expiresAt?.toDate === 'function'
        ? couponData.expiresAt.toDate()
        : new Date(couponData.expiresAt);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
        return NextResponse.json({ error: 'This coupon has expired.' }, { status: 400 });
      }
    }

    // No magic-value fallbacks — coupons must have an explicit value configured.
    const val = couponData.value ?? 0;
    if (val <= 0) {
      return NextResponse.json({ error: 'Coupon has no value configured.' }, { status: 400 });
    }
    const appliesTo = couponData.appliesTo || (val >= 100 ? 'grand_total' : 'subtotal');

    const baseAmount = (appliesTo === 'grand_total' || (type === 'percentage' && val >= 100))
      ? (subtotal + tax)
      : subtotal;
    let calculatedDiscountUSD = 0;

    if (type === 'percentage') {
      calculatedDiscountUSD = baseAmount * (val / 100);
    } else {
      calculatedDiscountUSD = val;
    }

    // Cap discount at subtotal + tax
    calculatedDiscountUSD = Math.min(calculatedDiscountUSD, subtotal + tax);

    return NextResponse.json({
      valid: true,
      code,
      type,
      value: val,
      appliesTo,
      discountUSD: calculatedDiscountUSD,
    });
  } catch (err: unknown) {
    console.error('Coupon validation error:', err);
    return NextResponse.json({ error: 'Error validating coupon' }, { status: 500 });
  }
}
