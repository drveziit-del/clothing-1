'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from '@/components/ui/ReceiptPrinter';
import { useCurrency } from '@/context/CurrencyContext';
import { generateAndDownloadReceiptPdf } from '@/lib/utils/generateReceiptPdf';
import styles from './page.module.css';

interface OrderData {
  id: string;
  items: Array<{
    productId: string;
    title: string;
    price: number;
    quantity: number;
    variant?: { size?: string; color?: string };
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  shippingAddress?: { name?: string };
  paymentGateway?: string;
  createdAt?: string;
}

export default function ReceiptClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('id') || '';
  const { formatPrice } = useCurrency();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<ReceiptPrinterStage>('processing');
  const [downloading, setDownloading] = useState(false);
  const [receiptDate, setReceiptDate] = useState('');

  // 1. Load order details via server API (avoids Firestore permission errors)
  useEffect(() => {
    setReceiptDate(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    );

    if (!orderId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadOrder() {
      try {
        const res = await fetch(`/api/order?orderId=${encodeURIComponent(orderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setOrder(data as OrderData);
        } else {
          console.warn('Could not load order:', res.status);
        }
      } catch (err) {
        console.error('Failed to load order for receipt:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // 2. Drive the physical printing animation stages
  useEffect(() => {
    let t1: NodeJS.Timeout;
    let t2: NodeJS.Timeout;

    // Start in processing, switch to printing after 1000ms
    t1 = setTimeout(() => {
      setStage('printing');

      // Allow 2400ms for mechanical stepped paper feed, then complete
      t2 = setTimeout(() => {
        setStage('complete');
      }, 2400);
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const activeOrderId = orderId || order?.id || 'GKINK-ORDER';
  const orderItems = order?.items || [];
  const subtotal = order?.subtotal ?? 33.0;
  const tax = order?.tax ?? 2.64;
  const grandTotal = order?.total ?? 0;
  const discount = order?.discount ?? (grandTotal === 0 ? subtotal + tax : 0);

  const isFree = grandTotal === 0 || order?.paymentGateway === 'free';
  const paymentMethodLabel = isFree
    ? '100% STORE CREDIT'
    : order?.paymentGateway === 'paypal'
    ? 'PAYPAL EXPRESS'
    : order?.paymentGateway === 'razorpay'
    ? 'CARDS & UPI (RAZORPAY)'
    : order?.paymentGateway === 'wise_bank_transfer'
    ? 'WIRE TRANSFER'
    : 'ONLINE PAYMENT';

  const screenTitle = isFree ? '100% Promo Order' : 'Order Confirmed';
  const screenSubtitle =
    orderItems.length > 0
      ? `${orderItems.length} Item${orderItems.length > 1 ? 's' : ''}`
      : isFree
      ? 'Store Reward Order'
      : 'Authorized Payment';

  const handleDownloadReceipt = () => {
    setDownloading(true);
    try {
      generateAndDownloadReceiptPdf({
        orderId: activeOrderId,
        receiptDate,
        customerName: order?.shippingAddress?.name || 'Valued Client',
        items: orderItems,
        subtotal,
        tax,
        discount,
        total: grandTotal,
        paymentMethod: paymentMethodLabel,
      });
    } catch (err) {
      console.error('PDF Download error:', err);
    } finally {
      setTimeout(() => {
        setDownloading(false);
      }, 1000);
    }
  };

  const handleContinue = () => {
    router.push(`/thank-you?orderId=${activeOrderId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <ReceiptPrinter.Root stage={stage} feedMotion="stepped">
          {/* Printer Machine Unit */}
          <ReceiptPrinter.Machine>
            <ReceiptPrinter.Header>
              <div className={styles.brandLogoHeader}>
                <div className={styles.logoSquare}>
                  <Image src="/logo.png" alt="GERKINK" width={28} height={28} style={{ objectFit: 'contain' }} />
                </div>
                <span className={styles.brandText}>GERKINK</span>
              </div>

              <Link href="/" className={styles.homeBtn}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
                <span>Home</span>
              </Link>
            </ReceiptPrinter.Header>

            <ReceiptPrinter.Screen>
              <div className={styles.screenContent}>
                <div className={styles.screenRow}>
                  <div>
                    <h3 className={styles.screenPlanTitle}>{screenTitle}</h3>
                    <p className={styles.screenPlanSub}>{screenSubtitle}</p>
                  </div>
                  <div className={styles.screenTotalCol}>
                    <span className={styles.screenTotalLabel}>Total</span>
                    <strong className={styles.screenTotalValue}>
                      {formatPrice(grandTotal)}
                    </strong>
                  </div>
                </div>

                <ReceiptPrinter.Status />
              </div>
            </ReceiptPrinter.Screen>
          </ReceiptPrinter.Machine>

          {/* Stepped Thermal Output Slot */}
          <ReceiptPrinter.Output>
            <ReceiptPrinter.Paper>
              <div className={styles.slipWrapper}>
                {/* Paper Header Logo */}
                <div className={styles.slipBrandCenter}>
                  <div className={styles.slipLogoBox}>
                    <Image src="/logo.png" alt="GERKINK" width={36} height={36} style={{ objectFit: 'contain' }} />
                  </div>
                </div>

                <div className={styles.dashedDivider} />

                {/* Main Items */}
                <div className={styles.slipItemsGrid}>
                  {orderItems.length > 0 ? (
                    orderItems.map((item, idx) => (
                      <div
                        key={`${item.productId}-${idx}`}
                        className={styles.slipItemRow}
                      >
                        <div className={styles.itemMeta}>
                          <span className={styles.itemTitle}>
                            {item.title.toUpperCase()}
                          </span>
                          <span className={styles.itemSub}>
                            {item.variant?.size || 'Standard'} • Qty: {item.quantity}
                          </span>
                        </div>
                        <strong className={styles.itemPrice}>
                          {formatPrice((item.price || 0) * item.quantity)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <div className={styles.slipItemRow}>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemTitle}>
                          {isFree ? '100% PROMO REWARD' : 'VAULT ORDER'}
                        </span>
                        <span className={styles.itemSub}>Standard Delivery</span>
                      </div>
                      <strong className={styles.itemPrice}>
                        {formatPrice(grandTotal)}
                      </strong>
                    </div>
                  )}
                </div>

                <div className={styles.dashedDivider} />

                {/* Subtotals */}
                <div className={styles.slipTotals}>
                  <div className={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>Tax</span>
                    <span>{formatPrice(tax)}</span>
                  </div>
                  {discount > 0 && (
                    <div className={styles.totalRow}>
                      <span>Promo Discount</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                </div>

                <div className={styles.dashedDivider} />

                {/* Grand Total */}
                <div className={styles.grandTotalRow}>
                  <span>TOTAL PAID</span>
                  <span className={styles.grandTotalAmount}>
                    {formatPrice(grandTotal)}
                  </span>
                </div>

                <div className={styles.dashedDivider} />

                {/* Metadata & Timestamp */}
                <div className={styles.slipMetaBlock}>
                  <div className={styles.metaLine}>
                    <span>Order</span>
                    <strong>#{activeOrderId.slice(0, 8).toUpperCase()}</strong>
                  </div>
                  <div className={styles.metaLine}>
                    <span>Paid with</span>
                    <span>
                      {isFree
                        ? 'Store Credit • 100% Free'
                        : order?.paymentGateway === 'paypal'
                        ? 'PayPal Express'
                        : order?.paymentGateway === 'razorpay'
                        ? 'Cards & UPI (Razorpay)'
                        : 'Authorized Online Payment'}
                    </span>
                  </div>
                  <div className={styles.metaLine}>
                    <span>Date</span>
                    <span>{receiptDate}</span>
                  </div>
                </div>

                {/* Authentic Barcode */}
                <div className={styles.barcodeWrapper}>
                  <div className={styles.barcodeBars} />
                  <span className={styles.barcodeText}>
                    ORD-{activeOrderId.slice(0, 6).toUpperCase()}
                  </span>
                </div>
              </div>
            </ReceiptPrinter.Paper>
          </ReceiptPrinter.Output>
        </ReceiptPrinter.Root>

        {/* Buttons that appear when printing completes */}
        {stage === 'complete' && (
          <div className={styles.actionsRow}>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className={styles.downloadReceiptBtn}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? 'Downloading...' : 'Download Receipt'}
            </button>

            <button
              type="button"
              onClick={handleContinue}
              className={styles.continueToThankYouBtn}
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
