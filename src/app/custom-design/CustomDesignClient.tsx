'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRoast } from '@/hooks/useRoast';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  type CustomDesignProductType,
  type CustomDesignPlan,
  type CustomDesignUpload,
  PLAN_PRICING,
  CURRENT_POLICY_VERSION,
} from '@/lib/custom-design/types';
import styles from './custom-design.module.css';

const PRODUCT_TYPES: CustomDesignProductType[] = [
  'T-Shirt',
  'Hoodie',
  'Sweatshirt',
  'Accessory',
  'Other',
];

const PREDEFINED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'];
const PREDEFINED_COLORS = ['Black', 'White', 'Off-White', 'Grey', 'Custom'];

type Step = 1 | 2 | 3;

export default function CustomDesignClient() {
  const { user } = useAuth();
  const { toast } = useRoast();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  // Stepper State
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: Form State
  const [productType, setProductType] = useState<CustomDesignProductType>('T-Shirt');
  const [selectedSizeOption, setSelectedSizeOption] = useState<string>('');
  const [customSizeText, setCustomSizeText] = useState<string>('');
  const [selectedColorOption, setSelectedColorOption] = useState<string>('');
  const [customColorText, setCustomColorText] = useState<string>('');
  const [productPreference, setProductPreference] = useState('');
  const [description, setDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Step 1: Upload State
  const [uploads, setUploads] = useState<CustomDesignUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Plan Selection State (Default to 'regular' $15)
  const [plan, setPlan] = useState<CustomDesignPlan>('regular');

  // Step 3: Policy & Payment State
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

  // Calculate resolved size and color
  const resolvedSize =
    selectedSizeOption === 'Custom' ? customSizeText.trim() : selectedSizeOption;
  const resolvedColor =
    selectedColorOption === 'Custom' ? customColorText.trim() : selectedColorOption;

  // Initialize or restore session draft and idempotency key
  useEffect(() => {
    let key = sessionStorage.getItem('gk_custom_design_idem_key');
    if (!key) {
      key = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('gk_custom_design_idem_key', key);
    }
    setIdempotencyKey(key);

    // Restore draft state if present
    try {
      const savedDraft = sessionStorage.getItem('gk_custom_design_draft');
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.productType) setProductType(draft.productType);
        if (draft.selectedSizeOption) setSelectedSizeOption(draft.selectedSizeOption);
        if (draft.customSizeText) setCustomSizeText(draft.customSizeText);
        if (draft.selectedColorOption) setSelectedColorOption(draft.selectedColorOption);
        if (draft.customColorText) setCustomColorText(draft.customColorText);
        if (draft.productPreference) setProductPreference(draft.productPreference);
        if (draft.description) setDescription(draft.description);
        if (draft.additionalNotes) setAdditionalNotes(draft.additionalNotes);
        if (draft.plan) setPlan(draft.plan);
        if (Array.isArray(draft.uploads)) setUploads(draft.uploads);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // Sync draft to sessionStorage on changes
  useEffect(() => {
    const draft = {
      productType,
      selectedSizeOption,
      customSizeText,
      selectedColorOption,
      customColorText,
      productPreference,
      description,
      additionalNotes,
      plan,
      uploads,
    };
    try {
      sessionStorage.setItem('gk_custom_design_draft', JSON.stringify(draft));
    } catch {
      // non-fatal
    }
  }, [
    productType,
    selectedSizeOption,
    customSizeText,
    selectedColorOption,
    customColorText,
    productPreference,
    description,
    additionalNotes,
    plan,
    uploads,
  ]);

  // Handle Multi-file Upload
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!user) {
      toast('Please sign in to upload your design files.', 'error');
      return;
    }

    if (uploads.length + files.length > 5) {
      toast('Maximum 5 files allowed per custom request.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast(`File "${file.name}" exceeds maximum allowed 25MB limit.`, 'error');
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/custom-design/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        setUploads((prev) => [
          ...prev,
          {
            fileId: data.fileId,
            originalName: data.originalName,
            mimeType: data.mimeType,
            size: data.size,
            storagePath: data.storagePath,
            uploadedAt: new Date().toISOString(),
          },
        ]);
        toast(`Uploaded ${file.name}`, 'success');
      }
    } catch (err: any) {
      toast(err?.message || 'File upload failed', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeUpload = (fileId: string) => {
    setUploads((prev) => prev.filter((u) => u.fileId !== fileId));
  };

  // Step 1 -> Continue to Step 2
  const handleContinueToLevel = () => {
    setCurrentStep(2);
    scrollToSection('stepper');
  };

  // Step 2 Validation -> Continue to Step 3
  const handleContinueToSubmit = () => {
    setCurrentStep(3);
    scrollToSection('stepper');
  };

  // PayPal Create Order Handler (Server-Authoritative Pricing)
  const handleCreatePayPalOrder = async (): Promise<string> => {
    setPaymentError(null);

    if (!isOnline) {
      toast('Cannot submit custom design request while offline. Please check your connection.', 'error');
      throw new Error('Offline');
    }

    if (!user) {
      toast('Authentication required to submit your request.', 'error');
      throw new Error('Not authenticated');
    }

    if (!description.trim() || description.trim().length < 10) {
      toast('Please describe your idea with at least 10 characters.', 'error');
      throw new Error('Description too short');
    }

    if (uploads.length === 0) {
      toast('Please upload at least one artwork or reference file.', 'error');
      throw new Error('Artwork file required');
    }

    if (!policyAccepted) {
      toast('You must acknowledge that this prepayment is non-refundable.', 'error');
      throw new Error('Policy agreement required');
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/custom-design/create-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          productType,
          preferredSize: resolvedSize,
          preferredColor: resolvedColor,
          productPreference: productPreference.trim(),
          description: description.trim(),
          additionalNotes: additionalNotes.trim(),
          plan,
          paymentPolicyAccepted: true,
          policyVersion: CURRENT_POLICY_VERSION,
          uploads,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize request');
      }

      setPendingRequestId(data.requestId);
      return data.paypalOrderId;
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to initialize payment');
      toast(err?.message || 'Initialization error', 'error');
      setIsSubmitting(false);
      throw err;
    }
  };

  // PayPal Approve / Capture Handler
  const handleApprovePayPal = async (data: { orderID: string }) => {
    if (!pendingRequestId) {
      toast('Missing pending request reference.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/custom-design/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: pendingRequestId,
          paypalOrderId: data.orderID,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Payment capture failed');
      }

      // Clear session keys after successful submission
      sessionStorage.removeItem('gk_custom_design_idem_key');
      sessionStorage.removeItem('gk_custom_design_draft');
      toast('Custom design prepayment confirmed!', 'success');
      router.push(`/custom-design/confirmation/${pendingRequestId}`);
    } catch (err: any) {
      console.error('[CustomDesign] Capture error:', err);
      setPaymentError(err?.message || "PAYMENT DIDN'T GO THROUGH.");
      toast(err?.message || 'Payment capture failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayPalError = (err: any) => {
    console.error('[CustomDesign] PayPal SDK error:', err);
    setPaymentError("PAYMENT DIDN'T GO THROUGH. Your request has been saved. You can try payment again.");
    setIsSubmitting(false);
  };

  const scrollToSection = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const navHeight = 90;
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        window.scrollTo({
          top: Math.max(0, rect.top + scrollTop - navHeight),
          behavior: 'smooth',
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  };

  // Active plan details
  const currentPlanDetails = PLAN_PRICING[plan] || PLAN_PRICING.regular;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        {/* ─── Hero Section (Phase 2) ─────────────────── */}
        <section className={styles.hero}>
          <div className={styles.badgeWrap}>
            <span className={styles.badge}>GERKINK ATELIER · CUSTOM PRODUCTION</span>
          </div>
          <h1 className={styles.heroTitle}>
            GOT YOUR OWN IDEA?
            <span className={styles.heroTitleAccent}>WE TURN IT INTO GERKINK.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Send us your design. Your artwork. Your concept. Your weird idea.<br />
            We&apos;ll figure out how to turn it into an authentic GERKINK statement piece.
          </p>

          <div className={styles.heroCtaRow}>
            <button
              type="button"
              onClick={() => scrollToSection('stepper')}
              className={styles.heroCtaBtn}
            >
              START YOUR CUSTOM REQUEST ↓
            </button>
            <span className={styles.heroPrepaymentNote}>
              $15 REGULAR · $20 BETTER QUALITY · NON-REFUNDABLE PREPAYMENT
            </span>
          </div>
        </section>

        {/* ─── How It Works (Phase 3) ─────────────────── */}
        <section className={styles.processSection}>
          <div className={styles.processHeader}>
            <span className={styles.processMeta}>PROTOCOL</span>
            <h2 className={styles.processTitle}>How It Works</h2>
          </div>

          <div className={styles.processStrip}>
            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>01</span>
              <strong className={styles.processStepName}>SEND</strong>
              <p className={styles.processStepDesc}>Upload your design.</p>
            </div>
            <div className={styles.processArrow}>→</div>

            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>02</span>
              <strong className={styles.processStepName}>PAY</strong>
              <p className={styles.processStepDesc}>Choose your custom level.</p>
            </div>
            <div className={styles.processArrow}>→</div>

            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>03</span>
              <strong className={styles.processStepName}>REVIEW</strong>
              <p className={styles.processStepDesc}>GERKINK reviews the request.</p>
            </div>
            <div className={styles.processArrow}>→</div>

            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>04</span>
              <strong className={styles.processStepName}>CREATE</strong>
              <p className={styles.processStepDesc}>We prepare the design.</p>
            </div>
            <div className={styles.processArrow}>→</div>

            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>05</span>
              <strong className={styles.processStepName}>APPROVE</strong>
              <p className={styles.processStepDesc}>You review and approve.</p>
            </div>
            <div className={styles.processArrow}>→</div>

            <div className={styles.processStep}>
              <span className={styles.processStepNumber}>06</span>
              <strong className={styles.processStepName}>PRODUCE</strong>
              <p className={styles.processStepDesc}>Production begins after final requirements are satisfied.</p>
            </div>
          </div>
        </section>

        {/* ─── 3-Step Configurator Progress Bar ───────── */}
        <div id="stepper" className={styles.stepperContainer}>
          <div className={styles.stepperTrack}>
            {/* Step 1 Indicator */}
            <button
              type="button"
              className={`${styles.stepIndicator} ${currentStep === 1 ? styles.stepIndicatorActive : ''} ${currentStep > 1 ? styles.stepIndicatorCompleted : ''}`}
              onClick={() => setCurrentStep(1)}
              aria-current={currentStep === 1 ? 'step' : undefined}
            >
              <span className={styles.stepIndicatorNumber}>01</span>
              <span className={styles.stepIndicatorLabel}>IDEA</span>
            </button>

            <span className={styles.stepDivider}>→</span>

            {/* Step 2 Indicator */}
            <button
              type="button"
              className={`${styles.stepIndicator} ${currentStep === 2 ? styles.stepIndicatorActive : ''} ${currentStep > 2 ? styles.stepIndicatorCompleted : ''}`}
              onClick={() => setCurrentStep(2)}
              aria-current={currentStep === 2 ? 'step' : undefined}
            >
              <span className={styles.stepIndicatorNumber}>02</span>
              <span className={styles.stepIndicatorLabel}>LEVEL</span>
            </button>

            <span className={styles.stepDivider}>→</span>

            {/* Step 3 Indicator */}
            <button
              type="button"
              className={`${styles.stepIndicator} ${currentStep === 3 ? styles.stepIndicatorActive : ''}`}
              onClick={() => setCurrentStep(3)}
              aria-current={currentStep === 3 ? 'step' : undefined}
            >
              <span className={styles.stepIndicatorNumber}>03</span>
              <span className={styles.stepIndicatorLabel}>SUBMIT</span>
            </button>
          </div>
        </div>

        {/* ─── Configurator Shell ─────────────────────── */}
        <div className={styles.configuratorShell}>
          {/* ========================================================= */}
          {/* STEP 01 — IDEA FORM                                       */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className={styles.stepPane}>
              <div className={styles.stepHeader}>
                <span className={styles.stepBadge}>01 / IDEA</span>
                <h2 className={styles.stepTitle}>Start Your Custom Request</h2>
                <p className={styles.stepSubtitle}>Tell us what you&apos;re trying to make.</p>
              </div>

              {/* 4.1 Product Selector Dropdown */}
              <div className={styles.fieldSection}>
                <label htmlFor="product-select" className={styles.fieldLabel}>
                  Garment / Product <span className={styles.requiredAsterisk}>*</span>
                </label>
                <div className={styles.selectWrapper}>
                  <select
                    id="product-select"
                    className={styles.nativeSelect}
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as CustomDesignProductType)}
                  >
                    {PRODUCT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectArrow}>▼</span>
                </div>
              </div>

              {/* 4.2 Design Upload Dropzone */}
              <div className={styles.fieldSection}>
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel}>
                    Design Files <span className={styles.requiredAsterisk}>*</span>
                  </label>
                  <span className={styles.fieldSubLabel}>Max 25MB each · Up to 5 files</span>
                </div>
                <p className={styles.fieldDescription}>
                  Upload your artwork, mockup, sketch, or reference.
                </p>

                <div
                  className={`${styles.uploadDropzone} ${isDragging ? styles.uploadDropzoneDragging : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <span className={styles.uploadGlyph}>📁</span>
                  <p className={styles.uploadPrompt}>
                    {isUploading
                      ? 'UPLOADING & VERIFYING ARTWORK...'
                      : isDragging
                      ? 'DROP FILES HERE'
                      : 'DRAG & DROP YOUR FILES'}
                  </p>
                  <span className={styles.browseLink}>or BROWSE FILES</span>
                  <p className={styles.uploadFormatNotice}>
                    Supported: PNG, JPG, WEBP, PDF, SVG
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,.pdf,.svg"
                    className={styles.hiddenFileInput}
                    onChange={(e) => {
                      if (e.target.files) handleFileUpload(e.target.files);
                    }}
                  />
                </div>

                {/* Uploaded File List with Thumbnails */}
                {uploads.length > 0 && (
                  <div className={styles.uploadedChipsList}>
                    {uploads.map((file) => {
                      const isImage = file.mimeType.startsWith('image/');
                      return (
                        <div key={file.fileId} className={styles.uploadedChip}>
                          <div className={styles.uploadedChipPreview}>
                            {isImage ? (
                              <span className={styles.chipThumbnail}>🖼️</span>
                            ) : (
                              <span className={styles.chipDocIcon}>📄</span>
                            )}
                          </div>
                          <div className={styles.uploadedChipMeta}>
                            <span className={styles.uploadedChipName}>{file.originalName}</span>
                            <span className={styles.uploadedChipSize}>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.uploadedChipRemove}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUpload(file.fileId);
                            }}
                            title="Remove file"
                            aria-label={`Remove ${file.originalName}`}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}

                    {uploads.length < 5 && (
                      <button
                        type="button"
                        className={styles.addMoreFilesBtn}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        + ADD ANOTHER FILE
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Phase 5: Describe Your Idea */}
              <div className={styles.fieldSection}>
                <div className={styles.fieldLabelRow}>
                  <label htmlFor="custom-desc" className={styles.fieldLabel}>
                    Describe Your Idea <span className={styles.requiredAsterisk}>*</span>
                  </label>
                  <span className={styles.charCounter}>
                    {description.length} / 3000
                  </span>
                </div>
                <textarea
                  id="custom-desc"
                  className={styles.ideaTextarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g., "Black oversized heavyweight T-shirt. Put this high-contrast illustration across the chest and the gothic text across the upper back."'
                  rows={5}
                  maxLength={3000}
                />
                <p className={styles.fieldHint}>Minimum 10 characters required.</p>
              </div>

              {/* Phase 6: Optional Product Details */}
              <div className={styles.optionalSection}>
                <h3 className={styles.optionalHeading}>Product Details (Optional)</h3>
                <p className={styles.optionalSub}>
                  Specify your fit, sizing, or finishes. Leave blank if you want the studio to suggest.
                </p>

                <div className={styles.twoColumnGrid}>
                  {/* Size Dropdown */}
                  <div className={styles.fieldSectionCompact}>
                    <label htmlFor="size-select" className={styles.fieldLabelSmall}>
                      Preferred Size
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="size-select"
                        className={styles.nativeSelect}
                        value={selectedSizeOption}
                        onChange={(e) => setSelectedSizeOption(e.target.value)}
                      >
                        <option value="">Select size</option>
                        {PREDEFINED_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                      <span className={styles.selectArrow}>▼</span>
                    </div>

                    {selectedSizeOption === 'Custom' && (
                      <input
                        type="text"
                        className={styles.textInputSub}
                        placeholder="Enter custom size (e.g., Boxy Oversized L, 54cm chest)"
                        value={customSizeText}
                        onChange={(e) => setCustomSizeText(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Color Dropdown */}
                  <div className={styles.fieldSectionCompact}>
                    <label htmlFor="color-select" className={styles.fieldLabelSmall}>
                      Preferred Color
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="color-select"
                        className={styles.nativeSelect}
                        value={selectedColorOption}
                        onChange={(e) => setSelectedColorOption(e.target.value)}
                      >
                        <option value="">Select color</option>
                        {PREDEFINED_COLORS.map((clr) => (
                          <option key={clr} value={clr}>
                            {clr}
                          </option>
                        ))}
                      </select>
                      <span className={styles.selectArrow}>▼</span>
                    </div>

                    {selectedColorOption === 'Custom' && (
                      <input
                        type="text"
                        className={styles.textInputSub}
                        placeholder="Enter custom color (e.g., Washed Moss Green, Acid Grey)"
                        value={customColorText}
                        onChange={(e) => setCustomColorText(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Fit & Finishing */}
                <div className={styles.fieldSectionCompact}>
                  <label htmlFor="custom-fit" className={styles.fieldLabelSmall}>
                    Fit &amp; Finishing
                  </label>
                  <input
                    id="custom-fit"
                    type="text"
                    className={styles.textInput}
                    value={productPreference}
                    onChange={(e) => setProductPreference(e.target.value)}
                    placeholder="e.g. dropped shoulder, heavyweight, washed finish"
                  />
                </div>

                {/* Additional Studio Notes */}
                <div className={styles.fieldSectionCompact}>
                  <label htmlFor="custom-notes" className={styles.fieldLabelSmall}>
                    Additional Notes
                  </label>
                  <textarea
                    id="custom-notes"
                    className={styles.notesTextarea}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Anything else we should know?"
                    rows={2}
                  />
                </div>
              </div>

              {/* Continue to Step 2 */}
              <div className={styles.stepActionBar}>
                <button
                  type="button"
                  onClick={handleContinueToLevel}
                  className={styles.primaryActionBtn}
                >
                  CONTINUE →
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 02 — CHOOSE YOUR LEVEL (PRICING PAGE)               */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className={styles.stepPane}>
              <div className={styles.stepHeaderCenter}>
                <span className={styles.stepBadge}>02 / CHOOSE YOUR LEVEL</span>
                <h2 className={styles.stepTitle}>How Much Do You Want Us to Do?</h2>
                <p className={styles.stepSubtitle}>
                  Choose the level of custom design treatment for your request.
                </p>
              </div>

              {/* Pricing Cards Grid */}
              <div className={styles.pricingCardsGrid}>
                {/* Regular ($15) */}
                <div
                  className={`${styles.pricingCard} ${plan === 'regular' ? styles.pricingCardActive : ''}`}
                  onClick={() => setPlan('regular')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPlan('regular');
                    }
                  }}
                >
                  <div className={styles.pricingCardHeader}>
                    <div>
                      <span className={styles.pricingTierLabel}>REGULAR</span>
                      <span className={styles.pricingSubhead}>STANDARD CUSTOM DESIGN</span>
                    </div>
                    <div className={styles.pricingPriceWrap}>
                      <span className={styles.pricingCurrency}>$</span>
                      <span className={styles.pricingAmount}>15</span>
                    </div>
                  </div>

                  <p className={styles.pricingDesc}>For straightforward custom concepts.</p>

                  <ul className={styles.featureList}>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Standard design review</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Feasibility assessment</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Standard artwork preparation</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Standard digital proof</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>GERKINK studio feedback</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    className={`${styles.planSelectBtn} ${plan === 'regular' ? styles.planSelectBtnActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlan('regular');
                      handleContinueToSubmit();
                    }}
                  >
                    {plan === 'regular' ? 'CHOSEN REGULAR ✓' : 'CHOOSE REGULAR →'}
                  </button>
                </div>

                {/* Better Quality ($20) */}
                <div
                  className={`${styles.pricingCard} ${plan === 'better_quality' ? styles.pricingCardActive : ''}`}
                  onClick={() => setPlan('better_quality')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPlan('better_quality');
                    }
                  }}
                >
                  <div className={styles.pricingCardHeader}>
                    <div>
                      <span className={styles.pricingTierLabel}>BETTER QUALITY</span>
                      <span className={styles.pricingSubhead}>ENHANCED CUSTOM DESIGN</span>
                    </div>
                    <div className={styles.pricingPriceWrap}>
                      <span className={styles.pricingCurrency}>$</span>
                      <span className={styles.pricingAmount}>20</span>
                    </div>
                  </div>

                  <p className={styles.pricingDesc}>
                    For customers who want more attention to the visual execution.
                  </p>

                  <ul className={styles.featureList}>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>More detailed design review</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Enhanced artwork preparation</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>More detailed digital proof</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>Additional refinement</span>
                    </li>
                    <li>
                      <span className={styles.checkGlyph}>✓</span>
                      <span>GERKINK studio feedback</span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    className={`${styles.planSelectBtn} ${plan === 'better_quality' ? styles.planSelectBtnActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlan('better_quality');
                      handleContinueToSubmit();
                    }}
                  >
                    {plan === 'better_quality' ? 'CHOSEN BETTER QUALITY ✓' : 'CHOOSE BETTER QUALITY →'}
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <div className={styles.stepNavigationRow}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    scrollToSection('stepper');
                  }}
                  className={styles.secondaryActionBtn}
                >
                  ← BACK TO IDEA
                </button>
                <button
                  type="button"
                  onClick={handleContinueToSubmit}
                  className={styles.primaryActionBtn}
                >
                  CONTINUE TO REVIEW →
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 03 — REVIEW & SUBMIT                                 */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className={styles.stepPane}>
              <div className={styles.stepHeader}>
                <span className={styles.stepBadge}>03 / REVIEW &amp; SUBMIT</span>
                <h2 className={styles.stepTitle}>Review &amp; Submit Your Request</h2>
                <p className={styles.stepSubtitle}>
                  Confirm your specifications and authorize the non-refundable prepayment.
                </p>
              </div>

              <div className={styles.reviewLayout}>
                {/* Left Column: Request Summary */}
                <div className={styles.reviewSummaryCol}>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <span className={styles.summaryBadge}>YOUR REQUEST</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className={styles.editStepLink}
                      >
                        Edit Details ↗
                      </button>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Product</span>
                      <span className={styles.summaryVal}>{productType}</span>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Design Files</span>
                      <span className={styles.summaryVal}>
                        {uploads.length} uploaded {uploads.length === 1 ? 'file' : 'files'}
                      </span>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Description</span>
                      <p className={styles.summaryDescPreview}>
                        {description.trim().length >= 10 ? (
                          `“${description}”`
                        ) : (
                          <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>
                            Pending (min 10 characters required before submitting)
                          </span>
                        )}
                      </p>
                    </div>

                    {(resolvedSize || resolvedColor || productPreference) && (
                      <div className={styles.summarySpecsGroup}>
                        {resolvedSize && (
                          <span className={styles.summarySpecTag}>Size: {resolvedSize}</span>
                        )}
                        {resolvedColor && (
                          <span className={styles.summarySpecTag}>Color: {resolvedColor}</span>
                        )}
                        {productPreference && (
                          <span className={styles.summarySpecTag}>Fit: {productPreference}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.summaryDivider} />

                    <div className={styles.summaryHeader}>
                      <span className={styles.summaryBadge}>CUSTOM LEVEL</span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className={styles.editStepLink}
                      >
                        Change Level ↗
                      </button>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Selected Level</span>
                      <span className={styles.summaryVal}>{currentPlanDetails.label}</span>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Prepayment Amount</span>
                      <span className={styles.summaryPriceVal}>
                        ${currentPlanDetails.amount}.00 USD
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(2);
                      scrollToSection('stepper');
                    }}
                    className={styles.backLinkBtn}
                  >
                    ← Back to Custom Level
                  </button>
                </div>

                {/* Right Column: Policy & Payment sticky box */}
                <div className={styles.reviewPaymentCol}>
                  <div className={styles.paymentBox}>
                    {/* Non-Refundable Policy Notice */}
                    <div className={styles.policyNotice}>
                      <div className={styles.policyNoticeHeader}>
                        <span>NON-REFUNDABLE PREPAYMENT</span>
                        <span className={styles.policyNoticeAmount}>
                          ${currentPlanDetails.amount}.00 USD
                        </span>
                      </div>
                      <p className={styles.policyNoticeText}>
                        This payment covers the Custom Design review, studio evaluation, and preparation process.
                      </p>

                      <label className={styles.policyCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={policyAccepted}
                          onChange={(e) => setPolicyAccepted(e.target.checked)}
                          className={styles.policyCheckboxInput}
                          required
                        />
                        <span className={styles.policyCheckboxText}>
                          I understand that the ${currentPlanDetails.amount} Custom Design prepayment is non-refundable.
                        </span>
                      </label>
                    </div>

                    {/* Payment Failure Recovery State */}
                    {paymentError && (
                      <div className={styles.paymentErrorBox}>
                        <strong className={styles.paymentErrorTitle}>PAYMENT DIDN&apos;T GO THROUGH.</strong>
                        <p className={styles.paymentErrorText}>
                          {paymentError} Your request has been saved. You can try payment again.
                        </p>
                        <button
                          type="button"
                          className={styles.retryPaymentBtn}
                          onClick={() => setPaymentError(null)}
                        >
                          TRY PAYMENT AGAIN →
                        </button>
                      </div>
                    )}

                    {/* Incomplete Specifications Warning */}
                    {(!description.trim() || description.trim().length < 10 || uploads.length === 0) && (
                      <div className={styles.missingReqsNotice}>
                        <strong>⚠️ INCOMPLETE SPECIFICATIONS</strong>
                        <p style={{ fontSize: '0.8rem', margin: '0.35rem 0 0.75rem', color: '#d1d5db', lineHeight: 1.4 }}>
                          Before authorizing prepayment, please complete:
                          {!description.trim() || description.trim().length < 10 ? ' • Idea description (min 10 characters)' : ''}
                          {uploads.length === 0 ? ' • At least 1 artwork/reference file' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentStep(1);
                            scrollToSection('stepper');
                          }}
                          className={styles.backToStep1Btn}
                        >
                          ← RETURN TO STEP 1 TO COMPLETE
                        </button>
                      </div>
                    )}

                    {/* Auth Gate or PayPal Button */}
                    <div className={styles.paymentTriggerWrap}>
                      {!isOnline && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          background: 'rgba(255, 77, 77, 0.12)',
                          border: '1px solid rgba(255, 77, 77, 0.35)',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                          color: '#ff6b6b',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          marginBottom: '1rem',
                        }}>
                          <span>🔴</span>
                          <span>Offline: Custom design prepayment is paused until connection is restored.</span>
                        </div>
                      )}

                      {!user ? (
                        <div className={styles.authGateBox}>
                          <h3 className={styles.authGateTitle}>SAVE YOUR CUSTOM REQUEST</h3>
                          <p className={styles.authGateText}>
                            Sign in to securely connect your design, payment and request status to your GERKINK account.
                          </p>
                          <Link
                            href={`/auth/login?redirect=${encodeURIComponent('/custom-design')}`}
                            className={styles.authGateBtn}
                          >
                            SIGN IN / CREATE ACCOUNT →
                          </Link>
                        </div>
                      ) : !policyAccepted ? (
                        <div className={styles.policyRequiredPrompt}>
                          Please acknowledge the non-refundable prepayment checkbox above to proceed with PayPal payment.
                        </div>
                      ) : paypalClientId ? (
                        <div className={styles.paypalIntegrationArea} style={{ opacity: isOnline ? 1 : 0.55, pointerEvents: isOnline ? 'auto' : 'none' }}>
                          <p className={styles.paypalAuthorizationNote}>
                            Authorize ${currentPlanDetails.amount} USD prepayment via PayPal:
                          </p>
                          <PayPalScriptProvider options={{ clientId: paypalClientId, currency: 'USD' }}>
                            <PayPalButtons
                              style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                              disabled={isSubmitting || !isOnline || uploads.length === 0 || !description.trim() || description.trim().length < 10}
                              createOrder={handleCreatePayPalOrder}
                              onApprove={handleApprovePayPal}
                              onError={handlePayPalError}
                            />
                          </PayPalScriptProvider>
                        </div>
                      ) : (
                        <div className={styles.gatewayMissingNotice}>
                          Payment gateway configuration is missing. Please contact GERKINK support.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
