'use client';

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
            <div className={styles.referralInput}>
              <input
                type="text"
                className="input"
                placeholder="GERK-XXXXXX"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                maxLength={14}
              />
            </div>
            {referralCode && <span className="tag tag-coral">Code applied</span>}
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
