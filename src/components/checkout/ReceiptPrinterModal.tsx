'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from '@/components/ui/ReceiptPrinter';
import { useCurrency } from '@/context/CurrencyContext';
import type { Address } from '@/types';
import styles from './ReceiptPrinterModal.module.css';

interface ReceiptItem {
  product: {
    id: string;
    title: string;
    images?: string[];
  };
  variant: {
    id: string;
    size?: string;
    color?: string;
    price: number;
  };
  quantity: number;
}

interface ReceiptPrinterModalProps {
  isOpen: boolean;
  orderId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discount: number;
  shippingCharge: number;
  grandTotal: number;
  couponCode?: string | null;
  shippingAddress: Address | null;
  customerName?: string;
  customerEmail?: string;
  onVerifyAndComplete: () => Promise<string | void>;
  onClose?: () => void;
}

export default function ReceiptPrinterModal({
  isOpen,
  orderId: initialOrderId,
  items,
  subtotal,
  tax,
  discount,
  shippingCharge,
  grandTotal,
  couponCode,
  shippingAddress,
  customerName,
  customerEmail,
  onVerifyAndComplete,
}: ReceiptPrinterModalProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [stage, setStage] = useState<ReceiptPrinterStage>('processing');
  const [finalOrderId, setFinalOrderId] = useState(initialOrderId || '');
  const [receiptDate, setReceiptDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (initialOrderId) {
      setFinalOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  useEffect(() => {
    if (!isOpen) return;

    setReceiptDate(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );

    let isMounted = true;

    async function executeFlow() {
      try {
        setStage('processing');
        // Verify order on backend
        const resolvedId = await onVerifyAndComplete();
        if (resolvedId && typeof resolvedId === 'string') {
          setFinalOrderId(resolvedId);
        }

        // Transition to printing stage
        if (!isMounted) return;
        setStage('printing');

        // Allow receipt animation to feed out paper
        setTimeout(() => {
          if (isMounted) {
            setStage('complete');
          }
        }, 2400);
      } catch (err) {
        console.error('Receipt printer flow error:', err);
        if (isMounted) {
          setStage('complete');
        }
      }
    }

    executeFlow();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const activeOrderId = finalOrderId || initialOrderId || 'GKINK-FREE';

  const handleDownloadReceipt = () => {
    setDownloading(true);
    try {
      // Build printable receipt HTML
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>GERKINK Receipt #${activeOrderId}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              background: #f4f4f5;
              color: #111;
              display: flex;
              justify-content: center;
              padding: 2rem;
              margin: 0;
            }
            .slip {
              width: 340px;
              background: #fff;
              padding: 24px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              border: 1px dashed #ccc;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #444; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
            .title { font-size: 18px; letter-spacing: 2px; }
            .footer { font-size: 11px; text-align: center; margin-top: 18px; color: #555; }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="center bold title">GERKINK</div>
            <div class="center" style="font-size: 11px; margin-top: 2px;">LUXURY & STREETWEAR VAULT</div>
            <div class="center" style="font-size: 10px; color: #666;">gerkink.shop</div>
            <div class="divider"></div>
            <div class="row"><span>ORDER NO:</span><span class="bold">#${activeOrderId.slice(0, 14)}</span></div>
            <div class="row"><span>DATE:</span><span>${receiptDate}</span></div>
            <div class="row"><span>CUSTOMER:</span><span>${customerName || shippingAddress?.name || 'Valued Client'}</span></div>
            <div class="divider"></div>
            ${items
              .map(
                (i) => `
              <div class="row">
                <span>${i.product.title} (${i.variant?.size || 'Standard'}) x${i.quantity}</span>
                <span>$${(i.variant.price * i.quantity).toFixed(2)}</span>
              </div>
            `
              )
              .join('')}
            <div class="divider"></div>
            <div class="row"><span>SUBTOTAL:</span><span>$${subtotal.toFixed(2)}</span></div>
            <div class="row"><span>TAX (8%):</span><span>$${tax.toFixed(2)}</span></div>
            <div class="row"><span>SHIPPING:</span><span>FREE</span></div>
            <div class="row" style="color: #d63031; font-weight: bold;"><span>PROMO DISCOUNT:</span><span>-$${discount.toFixed(2)}</span></div>
            <div class="divider"></div>
            <div class="row bold" style="font-size: 15px;"><span>TOTAL PAID:</span><span>$0.00 (FREE)</span></div>
            <div class="row" style="font-size: 11px; color: #27ae60;"><span>METHOD:</span><span>100% STORE CREDIT</span></div>
            <div class="divider"></div>
            <div class="footer">
              *** OFFICIAL ORDER CONFIRMATION ***<br/>
              WEAR YOUR WORTH. NO BORING FASHION.<br/>
              Thank you for ordering with GERKINK!
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      // Forward to Thank You page
      setTimeout(() => {
        router.push(`/thank-you?orderId=${activeOrderId}`);
      }, 500);
    }
  };

  const handleContinue = () => {
    router.push(`/thank-you?orderId=${activeOrderId}`);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalContent}>
        <ReceiptPrinter.Root stage={stage} feedMotion="stepped">
          {/* Printer Machine Top */}
          <ReceiptPrinter.Machine>
            <ReceiptPrinter.Header>
              <div className={styles.printerBrand}>
                <span className={styles.brandDot} />
                <span className={styles.brandText}>GERKINK PRINTER</span>
              </div>
              <span className={styles.receiptModelBadge}>GK-TERM 0.0</span>
            </ReceiptPrinter.Header>

            <ReceiptPrinter.Screen>
              <div className={styles.screenBody}>
                <div className={styles.screenInfoRow}>
                  <div>
                    <span className={styles.screenOrderLabel}>100% PROMO ORDER</span>
                    <h4 className={styles.screenOrderTitle}>
                      {items.length} Item{items.length > 1 ? 's' : ''} • Fully Covered
                    </h4>
                  </div>
                  <div className={styles.screenPricePill}>
                    <span>$0.00</span>
                  </div>
                </div>
                <ReceiptPrinter.Status />
              </div>
            </ReceiptPrinter.Screen>
          </ReceiptPrinter.Machine>

          {/* Paper Output Slot */}
          <ReceiptPrinter.Output>
            <ReceiptPrinter.Paper>
              <div className={styles.slipInner}>
                {/* Receipt Header */}
                <div className={styles.slipHeader}>
                  <h3 className={styles.slipBrandTitle}>GERKINK</h3>
                  <p className={styles.slipBrandTagline}>
                    LUXURY &amp; STREETWEAR VAULT
                  </p>
                  <p className={styles.slipUrl}>gerkink.shop</p>
                </div>

                <div className={styles.dashedDivider} />

                {/* Receipt Meta */}
                <div className={styles.slipMetaGrid}>
                  <div className={styles.metaRow}>
                    <span>ORDER NO:</span>
                    <strong className={styles.boldText}>
                      #{activeOrderId.slice(0, 12)}
                    </strong>
                  </div>
                  <div className={styles.metaRow}>
                    <span>DATE:</span>
                    <span>{receiptDate}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span>RECIPIENT:</span>
                    <span className={styles.truncateText}>
                      {customerName || shippingAddress?.name || 'Valued Customer'}
                    </span>
                  </div>
                  {shippingAddress?.city && (
                    <div className={styles.metaRow}>
                      <span>DESTINATION:</span>
                      <span>
                        {shippingAddress.city}, {shippingAddress.country}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.dashedDivider} />

                {/* Items List */}
                <div className={styles.slipItemsList}>
                  {items.map((item, idx) => (
                    <div
                      key={`${item.product.id}-${idx}`}
                      className={styles.slipItemRow}
                    >
                      <div className={styles.itemTitleCol}>
                        <span className={styles.itemTitle}>
                          {item.product.title}
                        </span>
                        <span className={styles.itemVariant}>
                          {item.variant.size || 'Standard'} • Qty: {item.quantity}
                        </span>
                      </div>
                      <div className={styles.itemPriceCol}>
                        {formatPrice(item.variant.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.dashedDivider} />

                {/* Numbers & Calculations */}
                <div className={styles.slipTotalsGrid}>
                  <div className={styles.totalsRow}>
                    <span>SUBTOTAL</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className={styles.totalsRow}>
                    <span>TAX (8%)</span>
                    <span>{formatPrice(tax)}</span>
                  </div>
                  <div className={styles.totalsRow}>
                    <span>SHIPPING</span>
                    <span className={styles.freeGreen}>FREE</span>
                  </div>
                  <div className={`${styles.totalsRow} ${styles.discountRed}`}>
                    <span>PROMO CREDIT {couponCode ? `(${couponCode})` : ''}</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                </div>

                <div className={styles.doubleDivider} />

                <div className={styles.slipGrandTotalRow}>
                  <span className={styles.grandTotalLabel}>TOTAL PAID</span>
                  <span className={styles.grandTotalVal}>$0.00</span>
                </div>

                <div className={styles.slipPaymentTag}>
                  <span>METHOD: 100% STORE CREDIT REWARD</span>
                </div>

                {/* Barcode Graphic */}
                <div className={styles.barcodeSection}>
                  <div className={styles.barcodeLines} />
                  <span className={styles.barcodeNum}>
                    *GKINK-{activeOrderId.slice(0, 8).toUpperCase()}*
                  </span>
                </div>

                <div className={styles.slipFooterNotes}>
                  <p>NO BORING FASHION ALLOWED.</p>
                  <p>ALL ORDERS QUEUED FOR DISCREET LUXURY PACKAGING.</p>
                </div>
              </div>
            </ReceiptPrinter.Paper>
          </ReceiptPrinter.Output>
        </ReceiptPrinter.Root>

        {/* Interactive Action Buttons (Revealed when complete) */}
        {stage === 'complete' && (
          <div className={styles.actionsContainer}>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className={styles.downloadBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? 'Preparing Slip...' : 'Download Receipt'}
            </button>

            <button
              type="button"
              onClick={handleContinue}
              className={styles.continueBtn}
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
