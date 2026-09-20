'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import { useFocusTrap } from '@/lib/utils/useFocusTrap';
import RatingStars from './RatingStars';
import ReviewMediaUploader from './ReviewMediaUploader';
import type { ReviewMedia, FitFeedback } from '@/types';
import styles from './WriteReviewModal.module.css';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string | null;
  productTitle?: string;
  orderId?: string;
  reviewToken?: string;
  initialRating?: number;
  onReviewSubmitted?: () => void;
}

export default function WriteReviewModal({
  isOpen,
  onClose,
  productId,
  productTitle,
  orderId,
  reviewToken,
  initialRating = 5,
  onReviewSubmitted,
}: WriteReviewModalProps) {
  const modalOverlayRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const { firebaseUser, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState(initialRating);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fit, setFit] = useState<FitFeedback | null>('true_to_size');
  const [mediaList, setMediaList] = useState<ReviewMedia[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedReferralCode, setSubmittedReferralCode] = useState<string | null>(null);
  const [verifiedPurchase, setVerifiedPurchase] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gerkink.shop';
  const effectiveReferralCode = submittedReferralCode || user?.referralCode || null;
  const referralUrl = effectiveReferralCode ? `${origin}/r/${effectiveReferralCode}` : '';

  const handleCopyLink = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
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
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and pause top marquee when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-review-modal-open', 'true');

    setRating(initialRating);
    setTitle('');
    setText('');
    setFit('true_to_size');
    setMediaList([]);
    setErrorMsg(null);
    setIsSubmitted(false);
    setSubmittedReferralCode(null);
    setVerifiedPurchase(false);
    setCopiedLink(false);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.removeAttribute('data-review-modal-open');
    };
  }, [isOpen, initialRating]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setErrorMsg('You are currently offline. Please reconnect before submitting your review.');
      return;
    }
    if (!text.trim()) {
      setErrorMsg('Please enter your review feedback.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
        } catch (tokenErr) {
          console.warn('[WriteReviewModal] ID token fetch non-fatal error:', tokenErr);
        }
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: productId || null,
          productTitle: productTitle || undefined,
          orderId: orderId || undefined,
          reviewToken: reviewToken || undefined,
          rating,
          title: title.trim() || undefined,
          text: text.trim(),
          fit: fit || undefined,
          media: mediaList,
          marketingConsent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      if (data.referralCode) {
        setSubmittedReferralCode(data.referralCode);
      }
      setVerifiedPurchase(!!data.verifiedPurchase);
      setIsSubmitted(true);
      onReviewSubmitted?.();
    } catch (err: any) {
      console.error('Review submit error:', err);
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      ref={modalOverlayRef}
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={isSubmitted ? 'review-success-title' : 'review-modal-title'}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close review modal"
        >
          ✕
        </button>

        {/* Verification Context & Title (hidden on success) */}
        {!isSubmitted && (
          <div className={styles.header}>
            <div className={styles.verifiedContextBadge}>
              <span className={styles.checkIcon}>✓</span>
              <span>
                {productTitle ? `VERIFIED PURCHASE · Reviewing: ${productTitle}` : 'VERIFIED CUSTOMER REVIEW'}
              </span>
            </div>
            <h3 id="review-modal-title" className={styles.title}>Write a Review</h3>
          </div>
        )}

        {isSubmitted ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>✓</div>
            <span className={styles.viralBadge}>VERDICT RECEIVED.</span>
            <h4 id="review-success-title" className={styles.viralTitle}>NOW GET YOUR FRIEND TO FAIL TOO.</h4>
            <p className={styles.successDesc}>
              {verifiedPurchase
                ? "Your verified verdict is now live. Turn your friends' bad decisions into cash commissions."
                : 'Your verdict is registered. Spread the noise and earn $100 for every 10 sales.'}
            </p>

            {effectiveReferralCode && (
              <div className={styles.viralCard}>
                <div className={styles.referralLinkBox}>
                  <span className={styles.referralUrlText}>{referralUrl}</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
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
              </div>
            )}

            <div className={styles.secondaryActions}>
              {productId && (
                <Link
                  href={`/shop/${productId}`}
                  onClick={onClose}
                  className={styles.secondaryBtn}
                >
                  View Product Page →
                </Link>
              )}
              <Link
                href="/shop"
                onClick={onClose}
                className={styles.secondaryBtn}
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* 1. Rating (Neutral score) */}
            <div className={styles.fieldRow}>
              <span className={styles.label}>HOW WOULD YOU RATE IT? *</span>
              <div className={styles.ratingRow}>
                <RatingStars rating={rating} interactive size="md" onChange={setRating} />
                <span className={styles.scoreText}>{rating} / 5</span>
              </div>
            </div>

            {/* 2. Fit Feedback */}
            <div className={styles.fieldRow}>
              <span className={styles.label}>FIT (OPTIONAL)</span>
              <div className={styles.fitGrid}>
                <button
                  type="button"
                  className={`${styles.fitBtn} ${fit === 'runs_small' ? styles.fitActive : ''}`}
                  onClick={() => setFit(fit === 'runs_small' ? null : 'runs_small')}
                >
                  Runs Small
                </button>
                <button
                  type="button"
                  className={`${styles.fitBtn} ${fit === 'true_to_size' ? styles.fitActive : ''}`}
                  onClick={() => setFit(fit === 'true_to_size' ? null : 'true_to_size')}
                >
                  True to Size
                </button>
                <button
                  type="button"
                  className={`${styles.fitBtn} ${fit === 'runs_large' ? styles.fitActive : ''}`}
                  onClick={() => setFit(fit === 'runs_large' ? null : 'runs_large')}
                >
                  Runs Large
                </button>
              </div>
            </div>

            {/* 3. Review Headline (Optional) */}
            <div className={styles.fieldRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Headline (optional)"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* 4. Review Body (Required) */}
            <div className={styles.fieldRow}>
              <div className={styles.bodyHeader}>
                <span className={styles.label}>YOUR REVIEW *</span>
                <span className={styles.charCount}>{text.length}/2000</span>
              </div>
              <textarea
                className={styles.textarea}
                placeholder="Tell us what you actually think — fit, fabric, comfort, print, durability, or whatever stood out..."
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </div>

            {/* 5. UGC Media Upload Area */}
            <div className={styles.fieldRow}>
              <span className={styles.label}>PHOTO / VIDEO (OPTIONAL)</span>
              <ReviewMediaUploader mediaList={mediaList} onChange={setMediaList} maxFiles={4} token={reviewToken} />
            </div>

            {/* 6. Marketing Consent Checkbox */}
            <label className={styles.consentLabel}>
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Allow GERKINK to feature this photo/video in community galleries.</span>
            </label>

            {!isOnline && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(255, 77, 77, 0.12)',
                border: '1px solid rgba(255, 77, 77, 0.35)',
                borderRadius: '6px',
                padding: '0.65rem 0.85rem',
                color: '#ff6b6b',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: '0.75rem',
              }}>
                <span>🔴</span>
                <span>Offline: Review submission paused until connection is restored.</span>
              </div>
            )}

            {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

            {/* 7. Action Buttons */}
            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={submitting || !isOnline}
                style={!isOnline ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                {submitting ? 'Publishing…' : !isOnline ? 'Offline — Reconnect to Submit' : 'Submit Review →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
