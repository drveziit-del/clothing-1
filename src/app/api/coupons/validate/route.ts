import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = (body.code || '').trim().toUpperCase();
    const subtotal = parseFloat(body.subtotal) || 0;
    const uid = body.userId || null;

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
    const val = couponData.value ?? (code.toUpperCase() === 'T100' ? 100 : 0);
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
