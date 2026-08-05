'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useRouter } from 'next/navigation';
import { useRoast } from '@/hooks/useRoast';
import { addressSchema } from '@/lib/utils/validation';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import RazorpayButton from '@/components/checkout/RazorpayButton';
import styles from './page.module.css';
import type { Address } from '@/types';

type Step = 'address' | 'payment';

export default function CheckoutPage() {
  const { items, subtotal, referralCode, clearCart } = useCart();
  const { firebaseUser, user } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const { toast } = useRoast();

  const [step, setStep]               = useState<Step>('address');
  const [address, setAddress]         = useState<Address | null>(null);
  const [orderData, setOrderData]     = useState<{ orderId: string; razorpayOrderId: string; amount: number; currency: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  // Coupon state
  const [couponInput, setCouponInput]         = useState('');
  const [appliedCoupon, setAppliedCoupon]     = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount]   = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const tax = subtotal * 0.08;
  const totalBeforeDiscount = subtotal + tax;
  const discountAmount = Math.min(couponDiscount, totalBeforeDiscount);
  const grandTotal = Math.max(0, totalBeforeDiscount - discountAmount);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && items.length === 0) {
      router.replace('/cart');
    }
  }, [mounted, items, router]);

  if (!mounted) {
    return (
      <div className={styles.loading}>
        <span>Preparing checkout...</span>
      </div>
    );
  }

  if (items.length === 0) {
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
    toast('Coupon removed', 'success');
  }

  async function handleAddressSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const raw = {
      name:    fd.get('name') as string,
      street:  fd.get('street') as string,
      city:    fd.get('city') as string,
      state:   fd.get('state') as string,
      zip:     fd.get('zip') as string,
      country: fd.get('country') as string,
      phone:   (fd.get('phone') as string) || undefined,
    };

    const result = addressSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

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
      setAddress(result.data);
      setOrderData(data);
      setStep('payment');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFreeCheckout() {
    if (!orderData) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/verify-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Free order checkout failed');
      }

      toast('Order placed successfully!', 'success');
      clearCart();
      router.push('/account');
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
                { id: 'country', label: 'Country',      placeholder: 'US',                 type: 'text' },
                { id: 'phone',   label: 'Phone (optional)', placeholder: '+1 555 0000',   type: 'tel'  },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="input-label">{field.label}</label>
                  <input id={field.id} name={field.id} type={field.type}
                    className="input" placeholder={field.placeholder} />
                  {errors[field.id] && <span className={styles.fieldError}>{errors[field.id]}</span>}
                </div>
              ))}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
                {loading ? 'Processing...' : 'Continue to Payment →'}
              </button>
            </form>
          )}

          {step === 'payment' && orderData && (
            <div className={styles.paymentStep}>
              <h2 className={styles.formTitle}>Payment</h2>
              {orderData.razorpayOrderId === 'free_order' ? (
                <>
                  <p className={styles.paymentNote}>
                    Your order is fully covered by your store coupon. No payment required.
                  </p>
                  <button
                    onClick={handleFreeCheckout}
                    disabled={loading}
                    className="btn btn-primary btn-lg btn-full"
                  >
                    {loading ? 'Placing Order...' : 'Confirm Free Order →'}
                  </button>
                </>
              ) : (
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
                      clearCart();
                      router.push('/account');
                    }}
                    onError={(msg) => toast(msg, 'error')}
                  />
                </>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => setStep('address')}
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
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
