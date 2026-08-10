import { adminDb } from '@/lib/firebase/admin';

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  couponRef?: FirebaseFirestore.DocumentReference;
  error?: string;
  couponData?: any;
}

/**
 * Validates a coupon code against Firestore, verifying ownership, limits, active status,
 * and minimum spend requirements, then calculates the final discount.
 */
export async function validateCoupon(
  code: string,
  userId: string,
  subtotal: number,
  tax: number
): Promise<CouponValidationResult> {
  const cleanCode = code.trim();

  // 1. Check user-specific coupon first
  let couponSnap = await adminDb.collection('coupons')
    .where('code', '==', cleanCode)
    .where('userId', '==', userId)
    .where('isUsed', '==', false)
    .limit(1)
    .get();

  // 2. Fallback to global coupon
  if (couponSnap.empty) {
    couponSnap = await adminDb.collection('coupons')
      .where('code', '==', cleanCode)
      .where('isGlobal', '==', true)
      .where('isActive', '==', true)
      .limit(1)
      .get();
  }

  if (couponSnap.empty) {
    return { valid: false, discount: 0, error: 'Invalid, inactive, or already used coupon code' };
  }

  const couponDoc = couponSnap.docs[0];
  const couponData = couponDoc.data();

  // 3. Check max uses for global coupons
  if (couponData.isGlobal && couponData.maxUses) {
    const timesUsed = couponData.timesUsed || 0;
    if (timesUsed >= couponData.maxUses) {
      return { valid: false, discount: 0, error: 'This coupon code has reached its maximum usage limit.' };
    }
  }

  // 4. Check min spend subtotal
  const minSpend = couponData.minSubtotal ?? 0;
  if (minSpend > 0 && subtotal < minSpend) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order subtotal of $${minSpend} required for this coupon.`
    };
  }

  // 5. Calculate discount
  const appliesTo = couponData.appliesTo || 'subtotal';
  const couponType = couponData.type || 'fixed';
  const couponVal = couponData.value ?? 0;
  const baseAmount = appliesTo === 'grand_total' ? (subtotal + tax) : subtotal;

  let discount = 0;
  if (couponType === 'percentage') {
    discount = Math.round((baseAmount * (couponVal / 100)) * 100) / 100;
  } else {
    discount = couponVal;
  }

  discount = Math.min(discount, baseAmount);

  return {
    valid: true,
    discount,
    couponRef: couponDoc.ref,
    couponData,
  };
}
