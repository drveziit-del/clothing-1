import 'server-only';
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
  if (!code || typeof code !== 'string') {
    return { valid: false, discount: 0, error: 'Please enter a coupon code.' };
  }

  const cleanCode = code.trim().toUpperCase();
  const safeSubtotal = Math.max(0, typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0);
  const safeTax = Math.max(0, typeof tax === 'number' && !isNaN(tax) ? tax : 0);

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

  // 3. Document-level active check (defends against disabled user-specific coupons)
  if (couponData.isActive === false) {
    return { valid: false, discount: 0, error: 'This coupon is currently inactive.' };
  }

  // 4. Ownership verification for user-specific coupons
  if (!couponData.isGlobal && couponData.userId && couponData.userId !== userId) {
    return { valid: false, discount: 0, error: 'This coupon is not valid for your account.' };
  }

  // 5. Single-use verification
  if (!couponData.isGlobal && couponData.isUsed) {
    return { valid: false, discount: 0, error: 'This coupon has already been used.' };
  }

  // 6. Check max uses for global coupons
  if (couponData.isGlobal && couponData.maxUses) {
    const timesUsed = couponData.timesUsed || 0;
    if (timesUsed >= couponData.maxUses) {
      return { valid: false, discount: 0, error: 'This coupon code has reached its maximum usage limit.' };
    }
  }

  // 7. Expiry check (supports Firestore Timestamp and ISO/string dates)
  if (couponData.expiresAt) {
    const expiryDate = typeof couponData.expiresAt?.toDate === 'function'
      ? couponData.expiresAt.toDate()
      : new Date(couponData.expiresAt);
    if (Number.isNaN(expiryDate.getTime())) {
      return { valid: false, discount: 0, error: 'This coupon has an invalid expiration date configuration.' };
    }
    if (expiryDate < new Date()) {
      return { valid: false, discount: 0, error: 'This coupon has expired.' };
    }
  }

  // 8. Check min spend subtotal
  const minSpend = couponData.minSubtotal ?? 0;
  if (minSpend > 0 && safeSubtotal < minSpend) {
    return {
      valid: false,
      discount: 0,
      error: `Minimum order subtotal of $${minSpend} required for this coupon.`
    };
  }

  // 9. Calculate discount — no magic-value fallbacks; coupons must have an explicit value.
  const couponType = couponData.type || 'percentage';
  const couponVal = couponData.value ?? 0;
  if (couponVal <= 0) {
    return { valid: false, discount: 0, error: 'Coupon has no value configured.' };
  }
  if (couponType === 'percentage' && couponVal > 100) {
    return { valid: false, discount: 0, error: 'Invalid coupon discount configuration.' };
  }
  const appliesTo = couponData.appliesTo || (couponVal >= 100 ? 'grand_total' : 'subtotal');
  const baseAmount = (appliesTo === 'grand_total' || (couponType === 'percentage' && couponVal >= 100))
    ? (safeSubtotal + safeTax)
    : safeSubtotal;

  let discount = 0;
  if (couponType === 'percentage') {
    discount = Math.round((baseAmount * (couponVal / 100)) * 100) / 100;
  } else {
    discount = couponVal;
  }

  discount = Math.min(discount, safeSubtotal + safeTax);

  return {
    valid: true,
    discount,
    couponRef: couponDoc.ref,
    couponData,
  };
}
