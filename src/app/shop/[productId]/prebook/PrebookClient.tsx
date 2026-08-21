'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { useRoast } from '@/hooks/useRoast';
import type { Product, Variant } from '@/types';
import { sortSizes, getSmallVariant } from '@/lib/utils/sizes';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import styles from './PrebookClient.module.css';

interface PrebookClientProps {
  product: Product;
}

const TIER_DATA: Record<number, {
  name: string;
  auraClass: string;
  badgeClass: string;
  cardBorderClass: string;
  btnClass: string;
  quotaText: string;
  serialText: string;
  perks: { icon: string; title: string; desc: string }[];
}> = {
  1: {
    name: 'God Tier',
    auraClass: styles.tierAuraGold,
    badgeClass: styles.badgeGold,
    cardBorderClass: styles.cardBorderGold,
    btnClass: styles.btnGold,
    quotaText: '1 OF 1 GLOBAL EDITION',
    serialText: 'MINT ALLOCATION #001 / 001',
    perks: [
      { icon: '🔒', title: 'Titanium Flight Vault', desc: 'Locked ballistic case' },
      { icon: '✈️', title: 'Armed Courier Transit', desc: 'Hand-delivered globally' },
      { icon: '👑', title: 'NFC Cryptographic Seal', desc: '1/1 blockchain chip' },
      { icon: '📞', title: 'Direct Phone to Nobody', desc: 'Private line access' },
    ],
  },
  2: {
    name: 'Obscene',
    auraClass: styles.tierAuraPlatinum,
    badgeClass: styles.badgePlatinum,
    cardBorderClass: styles.cardBorderPlatinum,
    btnClass: styles.btnPlatinum,
    quotaText: '2 PIECES WORLDWIDE',
    serialText: 'MINT ALLOCATION #00X / 002',
    perks: [
      { icon: '📜', title: 'Archival Certificate', desc: '600GSM cotton print' },
      { icon: '🌐', title: 'White-Glove Courier', desc: 'Tracked priority express' },
      { icon: '💎', title: 'Serialized Plaque', desc: 'Woven bespoke label' },
    ],
  },
  3: {
    name: 'Delusional',
    auraClass: styles.tierAuraRose,
    badgeClass: styles.badgeCoral,
    cardBorderClass: '',
    btnClass: styles.btnCoral,
    quotaText: '5 PIECES WORLDWIDE',
    serialText: 'MINT ALLOCATION #00X / 005',
    perks: [
      { icon: '📦', title: 'Matte Display Vault', desc: 'Collector display box' },
      { icon: '🏷️', title: 'NFC Authentication', desc: 'Authenticity verification' },
    ],
  },
  4: {
    name: 'Wannabe',
    auraClass: styles.tierAuraCoral,
    badgeClass: styles.badgeCoral,
    cardBorderClass: '',
    btnClass: styles.btnCoral,
    quotaText: '10 PIECES WORLDWIDE',
    serialText: 'MINT ALLOCATION #00X / 010',
    perks: [
      { icon: '🛡️', title: '240GSM Heavyweight', desc: 'Double-needle structural yarn' },
      { icon: '🚀', title: 'Tracked Dispatch', desc: 'Priority express transit' },
    ],
  },
  5: {
    name: 'Peasant Premium',
    auraClass: styles.tierAuraSteel,
    badgeClass: '',
    cardBorderClass: '',
    btnClass: '',
    quotaText: '999 PIECES WORLDWIDE',
    serialText: 'MINT ALLOCATION #XXX / 999',
    perks: [
      { icon: '👕', title: 'Zero-Fade Ink', desc: 'DTG pigment direct injection' },
      { icon: '🌍', title: 'Global Dispatch', desc: 'Printify international hubs' },
    ],
  },
};

export default function PrebookClient({ product }: PrebookClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser } = useAuth();
  const { formatPrice } = useCurrency();
  const { toast } = useRoast();

  const tier = product.tier || 1;
  const currentTierData = TIER_DATA[tier] || TIER_DATA[1];

  const safeVariants = useMemo(() => Array.isArray(product.variants) ? product.variants : [], [product.variants]);
  const safeImages = useMemo(() => Array.isArray(product.images) ? product.images : [], [product.images]);

  // Initial variant selection from search params or default
  const initialVariant = useMemo(() => {
    const paramSize = searchParams.get('size');
    const paramColor = searchParams.get('color');
    if (paramSize) {
      const match = safeVariants.find(
        (v) => v.size === paramSize && (!paramColor || v.color === paramColor)
      );
      if (match) return match;
    }
    return getSmallVariant(safeVariants) || safeVariants[0] || ({ id: 'default', price: product.price, size: 'ONE SIZE', color: 'DEFAULT', available: true } as Variant);
  }, [safeVariants, searchParams, product.price]);

  const [selectedVariant, setSelectedVariant] = useState<Variant>(initialVariant);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prebookOrderData, setPrebookOrderData] = useState<any>(null);

  // Payment states
  const [selectedPayMethod, setSelectedPayMethod] = useState<'paypal' | 'wise'>('paypal');
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [senderRef, setSenderRef] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [wireConfirmed, setWireConfirmed] = useState(false);
  const [wireSubmitting, setWireSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-fill user email/name if logged in
  useEffect(() => {
    if (firebaseUser) {
      if (firebaseUser.email && !email) setEmail(firebaseUser.email);
      if (firebaseUser.displayName && !name) setName(firebaseUser.displayName);
    }
  }, [firebaseUser, email, name]);

  // Load public bank details on mount
  useEffect(() => {
    async function loadBankDetails() {
      try {
        const res = await fetch('/api/settings/bank-details');
        if (res.ok) {
          const data = await res.json();
          setBankDetails(data);
        }
      } catch (err) {
        console.error('Failed to load bank details:', err);
      }
    }
    loadBankDetails();
  }, []);

  // Variants grouping
  const colors = useMemo(() => {
    return [...new Set(safeVariants.map((v) => v.color))];
  }, [safeVariants]);

  const sizes = useMemo(() => {
    const raw = [...new Set(
      safeVariants
        .filter((v) => v.color === selectedVariant?.color)
        .map((v) => v.size)
    )];
    return sortSizes(raw);
  }, [safeVariants, selectedVariant?.color]);

  const mainImage = useMemo(() => {
    if (selectedVariant?.color) {
      const activeColorVariant = safeVariants.find((v) => v.color === selectedVariant.color);
      if (activeColorVariant?.images?.[0]) {
        return activeColorVariant.images[0];
      }
    }
    return safeImages[0] || '/logo.png';
  }, [safeVariants, safeImages, selectedVariant?.color]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast('Please enter your full name and email address.', 'error');
      return;
    }
    if (!agreedToTerms) {
      toast('You must agree to the non-refundable deposit terms.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payment/create-prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant?.id || 'default',
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create pre-booking application.');
      }

      const data = await res.json();
      setPrebookOrderData(data);
      toast('Pre-booking initialized! Choose PayPal or Wise Bank Transfer below.', 'success');
    } catch (err: any) {
      toast(err.message || 'Something went wrong while submitting.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderRef.trim()) {
      toast('Please enter your Wire / Wise transaction reference number.', 'error');
      return;
    }
    setWireSubmitting(true);
    try {
      const res = await fetch('/api/payment/confirm-wire-prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: prebookOrderData.orderId,
          senderReference: senderRef.trim(),
          senderName: name.trim(),
          senderBank: senderBank.trim() || 'Wise / Wire Transfer',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit wire transfer confirmation.');
      }
      setWireConfirmed(true);
      toast('Wire transfer registered! Awaiting treasury authorization.', 'success');
    } catch (err: any) {
      toast(err.message || 'Something went wrong.', 'error');
    } finally {
      setWireSubmitting(false);
    }
  };

  const handlePayPalCreateOrder = async () => {
    try {
      const res = await fetch('/api/paypal/create-prebook-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: prebookOrderData.orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PayPal initialization failed');
      return data.paypalOrderId;
    } catch (err: any) {
      toast(err.message || 'Failed to initialize PayPal', 'error');
      throw err;
    }
  };

  const handlePayPalApprove = async (data: { orderID: string }) => {
    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: prebookOrderData.orderId,
          paypalOrderId: data.orderID,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'PayPal capture failed');
      toast('Pre-booking deposit authorized and confirmed!', 'success');
      router.push(`/thank-you?orderId=${prebookOrderData.orderId}`);
    } catch (err: any) {
      toast(err.message || 'PayPal capture error', 'error');
    }
  };

  const prebookFee = product.prebookingPrice ?? 500;
  const remainingBalance = Math.max(0, product.price - prebookFee);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
  const wireMemoCode = prebookOrderData ? `PREBOOK-${prebookOrderData.orderId.slice(-6).toUpperCase()}` : 'PREBOOK-XXXXXX';

  return (
    <div className={`${styles.pageWrapper} ${currentTierData.auraClass}`}>
      <div className={styles.container}>
        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/shop">Shop</Link>
          <span>→</span>
          <Link href="/shop/society-fuckers">Society Fu*kers</Link>
          <span>→</span>
          <Link href={`/shop/${product.slug || product.id}`}>{product.title}</Link>
          <span>→</span>
          <span className={styles.breadcrumbActive}>Private Allocation</span>
        </nav>

        {/* Ultra-Luxury Page Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerBadgeRow}>
            <span className={currentTierData.badgeClass || 'tag'}>
              ✦ TIER {tier} • {currentTierData.name.toUpperCase()}
            </span>
            <span className={styles.serialPill}>
              {currentTierData.quotaText}
            </span>
            <span className={styles.serialPill}>
              {currentTierData.serialText}
            </span>
          </div>

          <h1 className={styles.heading}>
            Apply for Private Allocation: <span className={tier === 1 ? styles.headingGold : ''}>{product.title}</span>
          </h1>

          <p className={styles.subheading}>
            Secure your priority manufacturing slot by authorizing the escrow deposit of{' '}
            <strong>{formatPrice(prebookFee)}</strong>. 100% of this deposit is credited toward your final piece upon allocation approval.
          </p>
        </div>

        <div className={styles.layout}>
          {/* Left Column: Official Asset Passport Card */}
          <aside className={`${styles.summaryCard} ${currentTierData.cardBorderClass}`}>
            <div className={styles.cardHeaderRow}>
              <span className={styles.passportLabel}>OFFICIAL ASSET PASSPORT</span>
              <span className={styles.serialPill}>TIER {tier}</span>
            </div>

            <div className={styles.imageWrap}>
              <Image
                src={mainImage}
                alt={product.title}
                fill
                className={styles.image}
                priority
              />
            </div>

            <div className={styles.passportContent}>
              <h2 className={styles.productTitle}>{product.title}</h2>

              {/* Financial Matrix */}
              <div className={styles.financialMatrix}>
                <div className={styles.financialRow}>
                  <span className={styles.financialLabel}>Full Asset Valuation</span>
                  <span className={styles.financialVal}>{formatPrice(product.price)}</span>
                </div>
                <div className={styles.financialRow}>
                  <span className={styles.financialLabel}>Balance Due Upon Mint</span>
                  <span className={styles.financialValMuted}>{formatPrice(remainingBalance)}</span>
                </div>
                <div className={styles.depositHighlightRow}>
                  <span className={styles.depositHighlightLabel}>Priority Allocation Deposit</span>
                  <span className={styles.depositHighlightVal}>{formatPrice(prebookFee)}</span>
                </div>
              </div>

              {/* Tier Specs */}
              <div className={styles.specsList}>
                {currentTierData.perks.map((perk, idx) => (
                  <div key={idx} className={styles.specItem}>
                    <span>{perk.icon}</span>
                    <div>
                      <strong>{perk.title}:</strong> {perk.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Column: Application Form or Payment / Authorization Flow */}
          <main className={styles.formCard}>
            {wireConfirmed ? (
              /* WAITING FOR PAYMENT AUTHORIZATION SCREEN */
              <div className={styles.waitingScreen}>
                <div className={styles.waitingHeader}>
                  <div className={styles.waitingBadge}>
                    <span className={styles.waitingPulseDot} />
                    ALLOCATION PENDING TREASURY AUTHORIZATION
                  </div>
                  <h2 className={styles.waitingTitle}>Wire Transfer Received &amp; Under Review</h2>
                  <p className={styles.waitingDesc}>
                    Your wire transfer notification has been registered for Order <strong>#{prebookOrderData?.orderId}</strong>.
                    Our executive treasury desk is monitoring the clearing network. Once verified by an administrator, your 1/1 serial allocation certificate will be activated.
                  </p>
                </div>

                {/* 4-Step Progress Tracker */}
                <div className={styles.trackerGrid}>
                  <div className={`${styles.trackerStep} ${styles.trackerStepCompleted}`}>
                    <span className={styles.trackerStepNum}>STEP 01</span>
                    <span className={styles.trackerStepTitle}>Application Transmitted</span>
                    <span className={`${styles.trackerStepStatus} ${styles.statusDone}`}>✓ Completed</span>
                  </div>
                  <div className={`${styles.trackerStep} ${styles.trackerStepCompleted}`}>
                    <span className={styles.trackerStepNum}>STEP 02</span>
                    <span className={styles.trackerStepTitle}>Wire Dispatched</span>
                    <span className={`${styles.trackerStepStatus} ${styles.statusDone}`}>✓ Recorded</span>
                  </div>
                  <div className={`${styles.trackerStep} ${styles.trackerStepActive}`}>
                    <span className={styles.trackerStepNum}>STEP 03</span>
                    <span className={styles.trackerStepTitle}>Treasury Verification</span>
                    <span className={`${styles.trackerStepStatus} ${styles.statusInProgress}`}>⏳ In Progress</span>
                  </div>
                  <div className={styles.trackerStep}>
                    <span className={styles.trackerStepNum}>STEP 04</span>
                    <span className={styles.trackerStepTitle}>Serial Minting &amp; Vault</span>
                    <span className={`${styles.trackerStepStatus} ${styles.statusPending}`}>— Awaiting Approval</span>
                  </div>
                </div>

                {/* Summary Details */}
                <div className={styles.summaryReceipt}>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Allocated Asset:</span>
                    <span className={styles.receiptVal}>{product.title} (Tier {tier})</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Wire Reference Submitted:</span>
                    <span className={styles.receiptVal} style={{ color: '#FFD700' }}>{senderRef}</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Remitting Bank:</span>
                    <span className={styles.receiptVal}>{senderBank || 'Wise / Wire'}</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Deposit Authorized:</span>
                    <span className={styles.receiptVal} style={{ color: '#2ed573' }}>{formatPrice(prebookFee)}</span>
                  </div>
                </div>

                {/* VIP Concierge Expedite Link */}
                <div className={styles.conciergeAssistance} style={{ borderTop: 'none' }}>
                  <Link
                    href={`/contact?subject=Expedite Wire Authorization — Order ${prebookOrderData?.orderId}`}
                    className={`btn btn-secondary btn-lg btn-full ${currentTierData.btnClass}`}
                    style={{ textDecoration: 'none', marginBottom: '0.75rem' }}
                  >
                    👑 Speak With VIP Treasury Concierge for Instant Expedited Confirmation ↗
                  </Link>
                  <Link
                    href={`/shop/${product.slug || product.id}`}
                    style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'underline' }}
                  >
                    ← Return to Product Showcase
                  </Link>
                </div>
              </div>
            ) : prebookOrderData ? (
              /* DUAL PAYMENT METHOD SCREEN (PayPal + Wise / Bank Wire) */
              <div className={styles.paymentBox}>
                <div className={styles.successBanner}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#2ed573' }}>
                    ✓ Allocation Application Initialized for {product.title}!
                  </p>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                    Choose your preferred authorization method to secure your deposit of <strong>{formatPrice(prebookFee)}</strong>.
                  </p>
                </div>

                {/* Method Selector Tabs */}
                <div className={styles.paymentTabs}>
                  <button
                    type="button"
                    className={`${styles.paymentTabBtn} ${selectedPayMethod === 'paypal' ? styles.paymentTabBtnActive : ''}`}
                    onClick={() => setSelectedPayMethod('paypal')}
                  >
                    <span className={styles.tabTitle}>🅿️ PayPal &amp; Cards</span>
                    <span className={styles.tabSubtitle}>Instant Automated Capture</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.paymentTabBtn} ${selectedPayMethod === 'wise' ? styles.paymentTabBtnActive : ''}`}
                    onClick={() => setSelectedPayMethod('wise')}
                  >
                    <span className={styles.tabTitle}>🏦 Wise / Bank Wire</span>
                    <span className={styles.tabSubtitle}>Manual Treasury Clearance</span>
                  </button>
                </div>

                {/* PayPal View */}
                {selectedPayMethod === 'paypal' && (
                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Authorizing your <strong>{formatPrice(prebookFee)}</strong> deposit via PayPal will immediately lock your allocation order in our cryptographic mint ledger.
                    </div>

                    {paypalClientId ? (
                      <PayPalScriptProvider options={{ clientId: paypalClientId, currency: 'USD' }}>
                        <PayPalButtons
                          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                          createOrder={handlePayPalCreateOrder}
                          onApprove={handlePayPalApprove}
                          onError={(err) => toast(`PayPal error: ${err.message || 'Check connection'}`, 'error')}
                        />
                      </PayPalScriptProvider>
                    ) : (
                      <div style={{ color: 'var(--accent)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                        PayPal Client ID is not configured. Please use Wise / Bank Wire transfer below.
                      </div>
                    )}
                  </div>
                )}

                {/* Wise / Bank Wire Transfer View */}
                {selectedPayMethod === 'wise' && (
                  <div className={styles.bankDetailsBox}>
                    <div className={styles.wireMemoAlert}>
                      <span className={styles.wireMemoTitle}>⚠️ MANDATORY WIRE MEMO / PAYMENT REFERENCE:</span>
                      <div className={styles.wireMemoCode}>
                        <span>{wireMemoCode}</span>
                        <button
                          type="button"
                          className={styles.copyPillBtn}
                          onClick={() => handleCopy(wireMemoCode, 'memo')}
                        >
                          {copiedKey === 'memo' ? '✓ Copied' : 'Copy Memo'}
                        </button>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {bankDetails?.referenceInstructions || 'Include this reference code in your bank transfer description so treasury can match your deposit.'}
                      </span>
                    </div>

                    {/* Dynamic Bank Account Information Rows */}
                    <div>
                      <div className={styles.bankDetailRow}>
                        <span className={styles.bankDetailLabel}>Bank Name</span>
                        <div className={styles.bankDetailValueWrap}>
                          <span>{bankDetails?.bankName || 'Wise Payments Ltd / JPMorgan Chase'}</span>
                          <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails?.bankName || 'Wise Payments Ltd', 'bankName')}>
                            {copiedKey === 'bankName' ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className={styles.bankDetailRow}>
                        <span className={styles.bankDetailLabel}>Account Holder</span>
                        <div className={styles.bankDetailValueWrap}>
                          <span>{bankDetails?.accountHolder || 'GERKINK GLOBAL ENTERPRISES LLC'}</span>
                          <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails?.accountHolder || 'GERKINK GLOBAL ENTERPRISES LLC', 'holder')}>
                            {copiedKey === 'holder' ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className={styles.bankDetailRow}>
                        <span className={styles.bankDetailLabel}>Account / IBAN</span>
                        <div className={styles.bankDetailValueWrap}>
                          <span>{bankDetails?.accountNumber || '9876543210'}</span>
                          <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails?.accountNumber || '9876543210', 'acct')}>
                            {copiedKey === 'acct' ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {bankDetails?.routingNumber && (
                        <div className={styles.bankDetailRow}>
                          <span className={styles.bankDetailLabel}>Routing / ABA</span>
                          <div className={styles.bankDetailValueWrap}>
                            <span>{bankDetails.routingNumber}</span>
                            <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails.routingNumber, 'routing')}>
                              {copiedKey === 'routing' ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      {bankDetails?.swiftBic && (
                        <div className={styles.bankDetailRow}>
                          <span className={styles.bankDetailLabel}>SWIFT / BIC</span>
                          <div className={styles.bankDetailValueWrap}>
                            <span>{bankDetails.swiftBic}</span>
                            <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails.swiftBic, 'swift')}>
                              {copiedKey === 'swift' ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      {bankDetails?.wiseEmail && (
                        <div className={styles.bankDetailRow}>
                          <span className={styles.bankDetailLabel}>Wise Pay Email</span>
                          <div className={styles.bankDetailValueWrap}>
                            <span>{bankDetails.wiseEmail}</span>
                            <button type="button" className={styles.copyPillBtn} onClick={() => handleCopy(bankDetails.wiseEmail, 'wiseEmail')}>
                              {copiedKey === 'wiseEmail' ? '✓' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className={styles.bankDetailRow}>
                        <span className={styles.bankDetailLabel}>Deposit Amount</span>
                        <div className={styles.bankDetailValueWrap}>
                          <span style={{ color: '#2ed573', fontWeight: 900 }}>${prebookFee.toFixed(2)} USD</span>
                        </div>
                      </div>
                    </div>

                    {/* Form to submit client's wire transfer reference */}
                    <form onSubmit={handleWireSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                      <div className={styles.fieldGroup}>
                        <label htmlFor="sender-ref" className={styles.label}>Your Wire / Wise Transaction Reference Number (Required)</label>
                        <input
                          id="sender-ref"
                          type="text"
                          className={styles.input}
                          placeholder="e.g. WISE-9872145 or UTR Number"
                          value={senderRef}
                          onChange={(e) => setSenderRef(e.target.value)}
                          required
                        />
                      </div>

                      <div className={styles.fieldGroup}>
                        <label htmlFor="sender-bank" className={styles.label}>Your Remitting Bank / App (Optional)</label>
                        <input
                          id="sender-bank"
                          type="text"
                          className={styles.input}
                          placeholder="e.g. Wise / Bank of America / Revolut"
                          value={senderBank}
                          onChange={(e) => setSenderBank(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={wireSubmitting}
                        className={`btn btn-primary btn-lg ${styles.submitBtn} ${currentTierData.btnClass}`}
                      >
                        {wireSubmitting ? 'Transmitting Wire Confirmation...' : '✓ I Have Sent The Wire / Wise Transfer →'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : !firebaseUser ? (
              <div className={styles.authNotice}>
                <div className={styles.stepHeader} style={{ width: '100%', justifyContent: 'center' }}>
                  <h2 className={styles.sectionTitle}>Authentication Required</h2>
                </div>
                <p className={styles.authNoticeText}>
                  To prevent unauthorized reservations on Tier {tier} pieces, you must be signed in with a verified account.
                </p>
                <Link
                  href={`/auth/login?redirect=/shop/${product.slug || product.id}/prebook`}
                  className={`btn btn-primary btn-lg btn-full ${currentTierData.btnClass}`}
                >
                  Sign In to Authorize Allocation →
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Step 1: Specifications */}
                <div>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>01</span>
                    <h2 className={styles.sectionTitle}>Options &amp; Garment Specifications</h2>
                  </div>

                  {colors.length > 1 && (
                    <div className={styles.fieldGroup} style={{ marginBottom: '1rem' }}>
                      <label className={styles.label}>Selected Color Palette — {selectedVariant?.color}</label>
                      <div className={styles.colorSwatches}>
                        {colors.map((color) => {
                          const v = safeVariants.find((pv) => pv.color === color);
                          if (!v) return null;
                          return (
                            <button
                              key={color}
                              type="button"
                              className={`${styles.swatch} ${selectedVariant?.color === color ? styles.swatchActive : ''}`}
                              onClick={() => {
                                const match = safeVariants.find((pv) => pv.color === color && pv.size === selectedVariant?.size) ?? v;
                                setSelectedVariant(match);
                              }}
                              style={{ background: v.colorHex ?? 'var(--fog)' }}
                              title={color}
                              aria-label={`Select color ${color}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {sizes.length > 0 && (
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Preferred Garment Cut &amp; Size — {selectedVariant?.size}</label>
                      <div className={styles.sizes}>
                        {sizes.map((size) => {
                          const v = safeVariants.find((pv) => pv.size === size && pv.color === selectedVariant?.color);
                          return (
                            <button
                              key={size}
                              type="button"
                              disabled={!v?.available}
                              className={`${styles.sizeBtn} ${selectedVariant?.size === size ? styles.sizeBtnActive : ''}`}
                              onClick={() => v && setSelectedVariant(v)}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Contact & Identification */}
                <div>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>02</span>
                    <h2 className={styles.sectionTitle}>Client Identification &amp; Contact</h2>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="prebook-name" className={styles.label}>Legal Client Name</label>
                      <input
                        id="prebook-name"
                        type="text"
                        className={styles.input}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter full legal name"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="prebook-email" className={styles.label}>Direct Email Address</label>
                      <input
                        id="prebook-email"
                        type="email"
                        className={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter primary contact email"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Bespoke Customization Notes */}
                <div>
                  <div className={styles.stepHeader}>
                    <span className={styles.stepNumber}>03</span>
                    <h2 className={styles.sectionTitle}>Bespoke Inquiries &amp; Customization Notes</h2>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="prebook-message" className={styles.label}>Customization &amp; Delivery Instructions (Optional)</label>
                    <textarea
                      id="prebook-message"
                      className={styles.textarea}
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Specify custom measurements, delivery location requirements, or private requests..."
                    />
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  <span>
                    I authorize the non-refundable allocation deposit of <strong>{formatPrice(prebookFee)}</strong>. I understand this full amount is credited directly toward the final purchase of <strong>{product.title}</strong> upon allocation confirmation.
                  </span>
                </label>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary btn-lg ${styles.submitBtn} ${currentTierData.btnClass}`}
                >
                  {loading
                    ? 'Transmitting Application...'
                    : `Lock Tier ${tier} Allocation — ${formatPrice(prebookFee)} →`}
                </button>

                {/* VIP Concierge Assistance */}
                <div className={styles.conciergeAssistance}>
                  <Link
                    href={`/contact?subject=VIP Allocation Assistance — Tier ${tier} (${product.title})`}
                    className={styles.conciergeLink}
                  >
                    👑 Prefer private wire transfer or phone onboarding? Speak with VIP Concierge →
                  </Link>
                </div>
              </form>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
