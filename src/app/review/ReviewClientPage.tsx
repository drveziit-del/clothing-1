'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import RatingStars from '@/components/reviews/RatingStars';
import ReviewMediaUploader from '@/components/reviews/ReviewMediaUploader';
import type { ReviewMedia, FitFeedback } from '@/types';
import styles from './ReviewPage.module.css';

interface ReviewClientPageProps {
  token: string;
  orderId: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  customerEmail: string;
}

export default function ReviewClientPage({
  token,
  orderId,
  productId,
  productTitle,
  productImage,
  customerEmail,
}: ReviewClientPageProps) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fit, setFit] = useState<FitFeedback | null>('true_to_size');
  const [mediaList, setMediaList] = useState<ReviewMedia[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gerkink.shop';
  const referralUrl = referralCode ? `${origin}/r/${referralCode}` : '';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setErrorMsg('Please write your review feedback.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productTitle,
          orderId,
          reviewToken: token,
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
        throw new Error(data.error || 'Failed to publish review');
      }

      if (data.referralCode) {
        setReferralCode(data.referralCode);
      }
      setSubmitted(true);
    } catch (err: any) {
      console.error('Review submit error:', err);
      setErrorMsg(err.message || 'Something went wrong submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.verifiedHeader}>
          <span className={styles.verifiedIcon}>✓</span>
          <div>
            <span className={styles.verifiedTitle}>VERIFIED PURCHASE INVITATION</span>
            <span className={styles.verifiedSub}>Order #{orderId.slice(0, 8)} · {customerEmail}</span>
          </div>
        </div>

        {/* Product Snapshot */}
        <div className={styles.productSnap}>
          {productImage && (
            <div className={styles.productThumb}>
              <Image src={productImage} alt={productTitle} fill sizes="80px" style={{ objectFit: 'cover' }} />
            </div>
          )}
          <div className={styles.productInfo}>
            <span className={styles.productLabel}>REVIEWING ITEM</span>
            <h2 className={styles.productName}>{productTitle}</h2>
          </div>
        </div>

        {submitted ? (
          <div className={styles.successBlock}>
            <div className={styles.successCheck}>✓</div>
            <span className={styles.viralBadge}>VERDICT RECEIVED.</span>
            <h3 className={styles.viralHeadline}>NOW GET YOUR FRIEND TO FAIL TOO.</h3>
            <p className={styles.successParagraph}>
              Your verified verdict is now live. Turn your friends' bad decisions into cash commissions.
            </p>

            {referralCode && (
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

            <div className={styles.successActions}>
              <Link href={`/shop/${productId}`} className="btn btn-secondary">
                View Product Page →
              </Link>
              <Link href="/shop" className="btn btn-primary">
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Rating */}
            <div className={styles.formSection}>
              <label className={styles.sectionLabel}>OVERALL RATING *</label>
              <div className={styles.ratingBox}>
                <RatingStars rating={rating} interactive size="lg" onChange={setRating} />
                <span className={styles.ratingWord}>
                  {rating} / 5
                </span>
              </div>
            </div>

            {/* Fit Feedback */}
            <div className={styles.formSection}>
              <label className={styles.sectionLabel}>FIT (OPTIONAL)</label>
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

            {/* Headline */}
            <div className={styles.formSection}>
              <label className={styles.sectionLabel} htmlFor="token-review-title">
                HEADLINE (OPTIONAL)
              </label>
              <input
                id="token-review-title"
                type="text"
                className={styles.input}
                placeholder="Headline (optional)"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className={styles.formSection}>
              <div className={styles.labelRow}>
                <label className={styles.sectionLabel} htmlFor="token-review-body">
                  YOUR REVIEW *
                </label>
                <span className={styles.countText}>{text.length}/2000</span>
              </div>
              <textarea
                id="token-review-body"
                className={styles.textarea}
                placeholder="Tell us what you actually think — fit, fabric, comfort, print, durability, or whatever stood out..."
                rows={4}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </div>

            {/* Photos & Videos */}
            <div className={styles.formSection}>
              <label className={styles.sectionLabel}>PHOTO / VIDEO (OPTIONAL)</label>
              <ReviewMediaUploader mediaList={mediaList} onChange={setMediaList} maxFiles={4} token={token} />
            </div>

            {/* Consent */}
            <div className={styles.consentWrap}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>
                  I grant GERKINK permission to feature my submitted photo/video in community galleries and social features.
                </span>
              </label>
            </div>

            {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={submitting}>
              {submitting ? 'Verifying & Publishing…' : 'Publish Verified Review →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
