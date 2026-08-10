'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { EMPTY_CART_ROAST } from '@/lib/utils/roasts';
import styles from './page.module.css';

export default function CartPage() {
  const { items, subtotal, referralCode, removeItem, updateQty, setReferralCode } = useCart();
  const { firebaseUser } = useAuth();
  const { formatPrice, currency } = useCurrency();

  const [localCode, setLocalCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  // Validate on mount only if referralCode was pre-populated
  useEffect(() => {
    if (referralCode.trim()) {
      setLocalCode(referralCode);
      setValidating(true);
      fetch(`/api/referral/validate?code=${encodeURIComponent(referralCode.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          setIsValid(data.valid);
          if (!data.valid) {
            setReferralCode('');
          }
        })
        .catch(() => {
          setIsValid(false);
          setReferralCode('');
        })
        .finally(() => {
          setValidating(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApplyReferral() {
    const trimmed = localCode.toUpperCase().trim();
    if (!trimmed) {
      setIsValid(null);
      setReferralCode('');
      return;
    }

    setValidating(true);
    setIsValid(null);
    try {
      const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setIsValid(data.valid);
        if (data.valid) {
          setReferralCode(trimmed);
        } else {
          setReferralCode('');
        }
      } else {
        setIsValid(false);
        setReferralCode('');
      }
    } catch {
      setIsValid(false);
      setReferralCode('');
    } finally {
      setValidating(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.emptyPage}>
        <p className={styles.emptyRoast}>{EMPTY_CART_ROAST}</p>
        <Link href="/shop" className="btn btn-primary btn-lg">Browse the Shop →</Link>
      </div>
    );
  }

  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.main}>
          <h1 className="text-title" style={{ marginBottom: '1.5rem' }}>Cart</h1>

          <div className={styles.items}>
            {items.map((item) => (
              <div key={`${item.product.id}-${item.variant.id}`} className={styles.item}>
                <div className={styles.itemImg}>
                  {item.product.images[0] ? (
                    <Image src={item.product.images[0]} alt={item.product.title} fill sizes="80px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.imgBlank}>GK</div>
                  )}
                </div>

                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{item.product.title}</span>
                  <span className={styles.itemVariant}>{item.variant.color} / {item.variant.size}</span>
                </div>

                <div className={styles.itemControls}>
                  <div className={styles.qty}>
                    <button onClick={() => updateQty(item.product.id, item.variant.id, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, item.variant.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                  </div>
                  <span className={styles.itemPrice + ' text-price'}>
                    {formatPrice(item.variant.price * item.quantity)}
                  </span>
                  <button onClick={() => removeItem(item.product.id, item.variant.id)} className={styles.removeBtn} aria-label="Remove item">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>Order Summary</h2>

          {/* Referral Code */}
          <div className={styles.referralRow}>
            <label className="input-label">Referral Code</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="input"
                style={{ flex: 1 }}
                placeholder="GERK-XXXXXX"
                value={localCode}
                onChange={(e) => {
                  setLocalCode(e.target.value);
                  if (isValid !== null) setIsValid(null);
                }}
                maxLength={20}
              />
              <button
                type="button"
                onClick={handleApplyReferral}
                disabled={validating || !localCode.trim()}
                className="btn btn-secondary"
                style={{ padding: '0 1rem', height: '42px' }}
              >
                Apply
              </button>
            </div>
            {validating && (
              <span className="tag tag-mist" style={{ width: 'fit-content' }}>Validating...</span>
            )}
            {!validating && isValid === true && (
              <span className="tag" style={{ width: 'fit-content', background: 'rgba(57, 219, 109, 0.08)', borderColor: 'rgba(57, 219, 109, 0.25)', color: '#3fb950' }}>
                Code applied
              </span>
            )}
            {!validating && isValid === false && (
              <span className="tag tag-coral" style={{ width: 'fit-content' }}>
                Invalid code
              </span>
            )}
          </div>

          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span className="text-price">{formatPrice(subtotal)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Tax (est. 8%)</span>
              <span className="text-price">{formatPrice(tax)}</span>
            </div>
            <div className={styles.divider} />
            <div className={`${styles.totalRow} ${styles.grand}`}>
              <span>Total</span>
              <span className="text-price">{formatPrice(total)}</span>
            </div>
          </div>

          {firebaseUser ? (
            <Link href="/checkout" className="btn btn-primary btn-full btn-lg">
              Proceed to Checkout →
            </Link>
          ) : (
            <Link href="/auth/login?redirect=/checkout" className="btn btn-primary btn-full btn-lg">
              Sign In to Checkout
            </Link>
          )}

          <p className={styles.summaryNote}>
            Shipping calculated at checkout. All prices in {currency}.
          </p>
        </div>
      </div>
    </div>
  );
}
