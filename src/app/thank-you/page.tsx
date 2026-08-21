'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import { generateAndDownloadReceiptPdf } from '@/lib/utils/generateReceiptPdf';
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
  paymentGateway?: string;
  shippingAddress?: { name?: string };
}

function MinimalThankYouContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('id') || '';
  const { user } = useAuth();
  const { toast } = useRoast();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    async function loadOrder() {
      try {
        const res = await fetch(`/api/order?orderId=${encodeURIComponent(orderId)}`);
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
  }, [orderId]);

  const activeOrderId = orderId || order?.id || 'GERKINK-ORDER';
  const displayId = activeOrderId.slice(0, 16).toUpperCase();

  const handleCopyId = () => {
    if (!activeOrderId) return;
    navigator.clipboard.writeText(activeOrderId);
    setCopiedId(true);
    toast('Order ID copied to clipboard', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
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
        paymentMethod: order?.total === 0 ? 'Store Credit • 100% Free' : 'Authorized Online Payment',
      });
      toast('Receipt PDF downloaded', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      toast('Failed to generate PDF', 'error');
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
      <Suspense fallback={
        <div className={styles.loading}>
          <span>Loading...</span>
        </div>
      }>
        <MinimalThankYouContent />
      </Suspense>
    </div>
  );
}
