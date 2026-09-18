'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import styles from './page.module.css';

interface OrderData {
  id: string;
  items: Array<{
    title: string;
    price: number;
    quantity: number;
    variant?: { size?: string; color?: string };
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status?: string;
  customerNumber?: number | null;
  isFounding500?: boolean | null;
  userReferralCode?: string | null;
  paymentGateway?: string;
  shippingAddress?: { name?: string };
}

function MinimalThankYouContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('id') || '';
  const guestToken = searchParams.get('token') || '';
  const { user } = useAuth();
  const { toast } = useRoast();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    async function loadOrder() {
      try {
        const query = new URLSearchParams({ orderId });
        if (guestToken) query.set('token', guestToken);
        const res = await fetch(`/api/order?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setOrder(data);
        }
      } catch (err) {
        console.error('Failed to load order:', err);
      }
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId, guestToken]);

  const activeOrderId = orderId || order?.id || 'GERKINK-ORDER';
  const displayId = activeOrderId.slice(0, 16).toUpperCase();

  const referralCode = order?.userReferralCode || user?.referralCode || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gerkink.shop';
  const referralUrl = referralCode ? `${origin}/r/${referralCode}` : '';

  const handleCopyId = () => {
    if (!activeOrderId) return;
    navigator.clipboard.writeText(activeOrderId);
    setCopiedId(true);
    toast('Order ID copied to clipboard', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyReferralLink = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    toast('Referral link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!referralUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'GERKINK — Wear Your Worth',
          text: 'Two collections. Zero apologies. Make someone else make a bad decision.',
          url: referralUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyReferralLink();
        }
      }
    } else {
      handleCopyReferralLink();
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { generateAndDownloadReceiptPdf } = await import('@/lib/utils/generateReceiptPdf');
      generateAndDownloadReceiptPdf({
        orderId: activeOrderId,
        receiptDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName: order?.shippingAddress?.name || user?.displayName || 'Valued Client',
        items: order?.items || [],
        subtotal: order?.subtotal ?? 33.0,
        tax: order?.tax ?? 2.64,
        discount: order?.discount ?? 0,
        total: order?.total ?? 0,
        paymentMethod: order?.paymentGateway ? order.paymentGateway.toUpperCase() : 'ONLINE PAYMENT',
      });
    } catch (err) {
      console.error('PDF Download error:', err);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.minimalCard}>
        {/* Minimal Subtle Check Icon */}
        <div className={styles.iconWrap}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Clean Minimal Typography */}
        <div className={styles.textBlock}>
          <span className={styles.pillTag}>ORDER CONFIRMED</span>
          <h1 className={styles.headline}>Thank you for your order.</h1>
          <p className={styles.subtext}>
            We have received your order and queued your garments for production. A confirmation email has been sent.
          </p>
        </div>

        {/* Customer Sequence Badge (Rendered ONLY if genuine atomic number exists) */}
        {typeof order?.customerNumber === 'number' && (
          <div className={styles.campaignBadge}>
            <span className={styles.campaignTag}>
              {order.customerNumber <= 500 ? "YOU'RE IN." : 'VERIFIED CLIENT'}
            </span>
            <span className={styles.campaignTitle}>
              {order.customerNumber <= 500
                ? `GERKINK CUSTOMER #${order.customerNumber} / 500`
                : `GERKINK CLIENT #${order.customerNumber}`}
            </span>
          </div>
        )}

        {/* Minimal Order ID Badge */}
        <button
          type="button"
          onClick={handleCopyId}
          className={styles.orderIdBadge}
          title="Click to copy Order ID"
        >
          <span className={styles.orderIdLabel}>Order No.</span>
          <span className={styles.orderIdText}>#{displayId}</span>
          <span className={styles.copyNotice}>{copiedId ? '✓ Copied' : 'Copy'}</span>
        </button>

        {/* Post-Purchase Referral Entry Point A */}
        <div className={styles.referralCard}>
          <h3 className={styles.referralHeadline}>NOW GET YOUR FRIEND TO FAIL TOO.</h3>
          <p className={styles.referralSub}>
            Spread the noise. Every 10 friends who purchase using your link unlocks an instant{' '}
            <strong>$100 USD cash commission</strong>.
          </p>

          {referralCode ? (
            <>
              <div className={styles.referralLinkBox}>
                <span className={styles.referralUrlText}>{referralUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyReferralLink}
                  className={styles.copyReferralBtn}
                >
                  {copiedLink ? '✓ LINK COPIED' : 'COPY REFERRAL LINK →'}
                </button>
              </div>

              <div className={styles.shareRow}>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className={styles.nativeShareBtn}
                  >
                    Share Link ↗
                  </button>
                )}
                <span className={styles.rewardNotice}>$100 FOR EVERY 10 SALES</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              <Link href="/auth/signup" style={{ textDecoration: 'underline', color: 'var(--accent, #ff6b81)' }}>
                Create an account
              </Link>{' '}
              to generate your personal /r/ link and start earning $100 commissions.
            </p>
          )}
        </div>

        {/* Minimal Action Buttons */}
        <div className={styles.actions}>
          <Link href="/shop" className={styles.primaryBtn}>
            Continue Shopping →
          </Link>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className={styles.secondaryBtn}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{downloading ? 'Downloading...' : 'Download PDF Receipt'}</span>
          </button>

          <Link href="/account" className={styles.ghostBtn}>
            View in Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <div className={styles.page}>
      <Suspense
        fallback={
          <div className={styles.loading}>
            <span>Loading...</span>
          </div>
        }
      >
        <MinimalThankYouContent />
      </Suspense>
    </div>
  );
}
