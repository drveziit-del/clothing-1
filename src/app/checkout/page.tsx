'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useRouter } from 'next/navigation';
import { useRoast } from '@/hooks/useRoast';
import { addressSchema } from '@/lib/utils/validation';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import RazorpayButton from '@/components/checkout/RazorpayButton';
import PayPalMultiButton from '@/components/checkout/PayPalMultiButton';
import { COUNTRIES } from '@/lib/utils/countries';
import styles from './page.module.css';
import type { Address } from '@/types';

type Step = 'address' | 'payment';

export default function CheckoutPage() {
  const { items, subtotal, referralCode, clearCart } = useCart();
  const { firebaseUser, user } = useAuth();
  const { formatPrice, currency: selectedCurrency, setCurrency } = useCurrency();
  const router = useRouter();
  const { toast } = useRoast();

  const orderCompletedRef = useRef(false);
  const [step, setStep]               = useState<Step>('address');
  const [address, setAddress]         = useState<Address | null>(null);
  const [orderData, setOrderData]     = useState<{ orderId: string; razorpayOrderId: string; amount: number; currency: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [usePayPal, setUsePayPal]     = useState(false);

  // Coupon state
  const [couponInput, setCouponInput]         = useState('');
  const [appliedCoupon, setAppliedCoupon]     = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount]   = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [promoOpen, setPromoOpen]             = useState(false);

  // Shipping config (loaded from Firestore settings)
  const [shippingFee, setShippingFee]                 = useState(15);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(100);

  const isFreeShipping = subtotal >= freeShippingThreshold;
  const shippingCharge = isFreeShipping ? 0 : shippingFee;
  const tax = subtotal * 0.08;
  const totalBeforeDiscount = subtotal + tax + shippingCharge;
  const discountAmount = Math.min(couponDiscount, totalBeforeDiscount);
  const grandTotal = Math.max(0, totalBeforeDiscount - discountAmount);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load shipping settings from Firestore
    async function loadShippingSettings() {
      try {
        const { doc, getDoc } = getFirestoreModule();
        const db = getFirestoreDb();
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.standardShippingFee === 'number') setShippingFee(data.standardShippingFee);
          if (typeof data.freeShippingThreshold === 'number') setFreeShippingThreshold(data.freeShippingThreshold);
        }
      } catch (err) {
        console.error('Failed to load shipping settings:', err);
      }
    }
    loadShippingSettings();
  }, []);

  useEffect(() => {
    if (mounted && items.length === 0 && !orderCompletedRef.current) {
      router.replace('/cart');
    }
  }, [mounted, items, router]);

  if (!mounted) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          {/* Left Column Skeleton */}
          <div className={styles.main}>
            {/* Steps Skeleton */}
            <div className={styles.stepsSkeleton}>
              <div className={styles.skeletonStep} />
              <div className={styles.skeletonStepSep} />
              <div className={styles.skeletonStep} />
            </div>

            {/* Form Skeleton */}
            <div className={styles.formSkeleton}>
              <div className={styles.skeletonTitle} />
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={styles.skeletonField}>
                  <div className={styles.skeletonLabel} />
                  <div className={styles.skeletonInput} />
                </div>
              ))}
              <div className={styles.skeletonButton} />
            </div>
          </div>

          {/* Right Column Skeleton */}
          <div className={styles.summarySkeleton}>
            <div className={styles.skeletonSummaryTitle} />
            <div className={styles.skeletonSummaryItems}>
              {[1, 2].map((i) => (
                <div key={i} className={styles.skeletonSummaryItem}>
                  <div className={styles.skeletonSummaryItemName} />
                  <div className={styles.skeletonSummaryItemPrice} />
                </div>
              ))}
            </div>
            <div className={styles.skeletonDivider} />
            <div className={styles.skeletonSummaryTotals}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonTotalRow} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    if (orderCompletedRef.current) {
      return (
        <div className={styles.page}>
          <div className={styles.processingWrapper}>
            <div className={styles.processingCard}>
              <div className={styles.processingSpinner} />
              <div className={styles.processingInfo}>
                <span className={styles.processingBadge}>PAYMENT CONFIRMED</span>
                <h2 className={styles.processingTitle}>Securing Your Order</h2>
                <p className={styles.processingDesc}>Preparing your official thermal receipt & ticket...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setValidatingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal,
          tax,
          userId: user?.uid || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Invalid coupon code.', 'error');
        setAppliedCoupon(null);
        setCouponDiscount(0);
        return;
      }

      setAppliedCoupon(data.code);
      setCouponDiscount(data.discountUSD);
      setOrderData(null); // Invalidate any previous order created before coupon was applied
      toast(
        `${data.type === 'percentage' ? `${data.value}%` : formatPrice(data.discountUSD)} discount applied!`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Error validating coupon', 'error');
    } finally {
      setValidatingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput('');
    setOrderData(null);
    toast('Coupon removed', 'success');
  }

  async function handleAddressSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const rawData = {
      name:    (formData.get('name') as string) || '',
      street:  (formData.get('street') as string) || '',
      city:    (formData.get('city') as string) || '',
      state:   (formData.get('state') as string) || '',
      zip:     (formData.get('zip') as string) || '',
      country: (formData.get('country') as string) || '',
      phone:   (formData.get('phone') as string) || undefined,
    };

    const result = addressSchema.safeParse(rawData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setAddress(result.data);
    const countryCode = result.data.country.trim().toUpperCase();
    const isIndia = countryCode === 'IN';

    const isFree = grandTotal <= 0;

    // If order total is $0.00 (e.g. 100% discount applied) -> Create free order and skip payment gateways!
    if (isFree || isIndia) {
      setUsePayPal(false);
      setLoading(true);
      try {
        const res = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.product.id,
              variantId: i.variant.id,
              quantity:  i.quantity,
            })),
            referralCode: referralCode || undefined,
            couponCode: appliedCoupon || undefined,
            shippingAddress: result.data,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Order creation failed');
        }

        const data = await res.json();
        setOrderData(data);
        setStep('payment');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        toast(msg, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // International / USD Routing -> Direct PayPal & Standalone Cards
      setUsePayPal(true);
      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleFreeCheckout() {
    setLoading(true);
    try {
      let currentOrderId = orderData?.orderId;

      // If no order data or existing order was created with a non-zero price before coupon was applied
      if (!currentOrderId || orderData?.razorpayOrderId !== 'free_order') {
        if (!address) {
          throw new Error('Please provide your shipping address');
        }
        const createRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.product.id,
              variantId: i.variant.id,
              quantity: i.quantity,
            })),
            referralCode: referralCode || undefined,
            couponCode: appliedCoupon || undefined,
            shippingAddress: address,
          }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Order creation failed');
        }

        const data = await createRes.json();
        currentOrderId = data.orderId;
        setOrderData(data);
      }

      const res = await fetch('/api/payment/verify-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: currentOrderId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Free order checkout failed');
      }

      orderCompletedRef.current = true;
      toast('Order placed successfully! Printing receipt...', 'success');
      clearCart();
      router.push(`/receipt?orderId=${currentOrderId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Left — Steps */}
        <div className={styles.main}>
          <div className={styles.steps}>
            <span className={`${styles.step} ${step === 'address' ? styles.stepActive : styles.stepDone}`}>1 Shipping</span>
            <span className={styles.stepSep}>→</span>
            <span className={`${styles.step} ${step === 'payment' ? styles.stepActive : ''}`}>2 Payment</span>
          </div>

          {step === 'address' && (
            <form onSubmit={handleAddressSubmit} noValidate className={styles.form}>
              <h2 className={styles.formTitle}>Shipping Address</h2>

              {[
                { id: 'name',    label: 'Full Name',    placeholder: 'Jane Smith',         type: 'text' },
                { id: 'street',  label: 'Street',       placeholder: '123 Main St',        type: 'text' },
                { id: 'city',    label: 'City',         placeholder: 'New York',           type: 'text' },
                { id: 'state',   label: 'State / Region', placeholder: 'NY',              type: 'text' },
                { id: 'zip',     label: 'ZIP / Postal', placeholder: '10001',              type: 'text' },
                { id: 'phone',   label: 'Phone (optional)', placeholder: '+1 555 0000',   type: 'tel'  },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="input-label">{field.label}</label>
                  <input id={field.id} name={field.id} type={field.type}
                    className="input" placeholder={field.placeholder} />
                  {errors[field.id] && <span className={styles.fieldError}>{errors[field.id]}</span>}
                </div>
              ))}

              <div>
                <label htmlFor="country" className="input-label">Country</label>
                <select
                  id="country"
                  name="country"
                  className="input"
                  defaultValue="US"
                  onChange={(e) => {
                    const country = e.target.value;
                    const countryCurrencyMap: Record<string, string> = {
                      IN: 'INR',
                      US: 'USD',
                      GB: 'GBP',
                      CA: 'CAD',
                      AU: 'AUD',
                      DE: 'EUR',
                      FR: 'EUR',
                      ES: 'EUR',
                      NL: 'EUR',
                      IT: 'EUR',
                      IE: 'EUR',
                      AT: 'EUR',
                      BE: 'EUR',
                      PT: 'EUR',
                      FI: 'EUR',
                    };
                    const mappedCurrency = countryCurrencyMap[country];
                    if (mappedCurrency) {
                      setCurrency(mappedCurrency, false);
                    }
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                {errors.country && <span className={styles.fieldError}>{errors.country}</span>}
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
                {loading ? 'Processing...' : 'Continue to Payment →'}
              </button>
            </form>
          )}

          {step === 'payment' && (
            <div className={styles.paymentStep}>
              <h2 className={styles.formTitle}>Payment</h2>
              {grandTotal <= 0 || (orderData && orderData.razorpayOrderId === 'free_order') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    background: 'rgba(255, 71, 87, 0.08)',
                    border: '1px solid rgba(255, 71, 87, 0.35)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: '#ff6b81', fontWeight: 800 }}>
                      🎉 100% Discount Applied — Zero Payment Required!
                    </p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Your order is completely free. No payment gateway, credit card, or PayPal authorization is needed.
                    </p>
                  </div>

                  <button
                    onClick={handleFreeCheckout}
                    disabled={loading}
                    className={`btn btn-lg btn-full ${styles.freeOrderBtn}`}
                  >
                    {loading ? 'Confirming Order & Printing...' : "🎁 It's Free — Complete Order →"}
                  </button>
                </div>
              ) : usePayPal ? (
                <>
                  <p className={styles.paymentNote}>
                    International USD Order. Pay via <strong>Direct PayPal</strong> or <strong>Debit / Credit Card</strong>.
                  </p>
                  <PayPalMultiButton
                    amountUSD={grandTotal}
                    items={items.map((i) => ({ productId: i.product.id, variantId: i.variant.id, quantity: i.quantity }))}
                    referralCode={referralCode || undefined}
                    couponCode={appliedCoupon || undefined}
                    shippingAddress={address}
                    onSuccess={(orderId) => {
                      orderCompletedRef.current = true;
                      clearCart();
                      router.push(`/receipt?orderId=${orderId || orderData?.orderId || ''}`);
                    }}
                    onError={(msg) => toast(msg, 'error')}
                  />
                </>
              ) : orderData ? (
                <>
                  <p className={styles.paymentNote}>
                    You&apos;re paying <strong>{formatPrice(grandTotal)}</strong> via Razorpay.
                  </p>
                  <RazorpayButton
                    razorpayOrderId={orderData.razorpayOrderId}
                    amount={orderData.amount}
                    currency={orderData.currency}
                    firestoreOrderId={orderData.orderId}
                    userEmail={firebaseUser?.email ?? undefined}
                    userName={user?.displayName ?? undefined}
                    amountUSD={grandTotal}
                    onSuccess={() => {
                      orderCompletedRef.current = true;
                      clearCart();
                      router.push(`/receipt?orderId=${orderData.orderId}`);
                    }}
                    onError={(msg) => toast(msg, 'error')}
                  />
                </>
              ) : null}
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setStep('address');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ marginTop: '1rem' }}
              >
                ← Back to shipping
              </button>
            </div>
          )}
        </div>

        {/* Right — Summary */}
        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order Summary</h2>
          <div className={styles.summaryItems}>
            {items.map((item) => (
              <div key={`${item.product.id}-${item.variant.id}`} className={styles.summaryItem}>
                <span className={styles.summaryItemName}>{item.product.title} × {item.quantity}</span>
                <span className={styles.summaryItemPrice + ' text-price'}>{formatPrice(item.variant.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className={styles.summaryTotals}>
            <div className={styles.totalRow}><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className={styles.totalRow}>
              <span>Shipping</span>
              <span className={isFreeShipping ? styles.freeShipping : ''}>
                {isFreeShipping ? 'FREE' : formatPrice(shippingCharge)}
              </span>
            </div>
            <div className={styles.totalRow}><span>Tax (8%)</span><span>{formatPrice(tax)}</span></div>
            {couponDiscount > 0 && (
              <div className={styles.totalRow} style={{ color: 'var(--coral-200)' }}>
                <span>Discount</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className={styles.divider} />
            <div className={`${styles.totalRow} ${styles.grand}`}><span>Total</span><span>{formatPrice(grandTotal)}</span></div>
          </div>

          {/* Coupon Input Block */}
          {step === 'address' && (
            <div className={styles.couponSection}>
              <div className={styles.divider} style={{ margin: '0.5rem 0 1rem' }} />
              {appliedCoupon ? (
                <div className={styles.couponBadge}>
                  <span className={styles.couponBadgeText}>Coupon Applied: <strong>{appliedCoupon}</strong></span>
                  <button onClick={handleRemoveCoupon} className={styles.removeCouponBtn}>Remove</button>
                </div>
              ) : promoOpen ? (
                <form onSubmit={handleApplyCoupon} className={styles.couponForm}>
                  <input
                    type="text"
                    placeholder="ENTER REWARD CODE"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="input input-sm"
                    style={{ textTransform: 'uppercase', flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="submit"
                    disabled={validatingCoupon}
                    className="btn btn-secondary btn-sm"
                  >
                    {validatingCoupon ? '...' : 'Apply'}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.promoToggle}
                  onClick={() => setPromoOpen(true)}
                >
                  Have a promo code?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
