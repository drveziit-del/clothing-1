'use client';

/* eslint-disable @next/next/no-img-element -- dynamic customer uploads & avatars */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import RatingStars from './RatingStars';
import WriteReviewModal from './WriteReviewModal';
import { normalizeMediaUrl } from '@/lib/utils/videoThumbnail';
import type { Review, ReviewMedia } from '@/types';
import styles from './ReviewsSection.module.css';

interface ReviewsSectionProps {
  productId?: string;
  onReviewsLoaded?: (reviews: Review[]) => void;
}

// Business Rule: Prioritize verified reviews + media + useful substantive content
function scoreReviewQuality(r: Review): number {
  let score = 0;
  if (r.verifiedPurchase) score += 25;
  if (r.media && r.media.length > 0) score += 30;
  const len = (r.text || '').length;
  if (len >= 25 && len <= 350) score += 15;
  else if (len > 350) score += 8;
  if (r.rating >= 4) score += 10;
  else if (r.rating >= 3) score += 6;
  return score;
}

// Assign visual card archetype: 'media' | 'quote' | 'text'
function getCardType(review: Review, index: number): 'media' | 'quote' | 'text' {
  if (review.media && review.media.length > 0) return 'media';
  const textLen = (review.text || '').length;
  // If very punchy and short, render as a large typography quote card
  if (textLen > 0 && textLen <= 80 && (index % 3 === 1 || review.rating === 5)) {
    return 'quote';
  }
  return 'text';
}

export default function ReviewsSection({ productId, onReviewsLoaded }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxMedia, setLightboxMedia] = useState<{ media: ReviewMedia; review: Review } | null>(null);

  const onReviewsLoadedRef = useRef(onReviewsLoaded);
  useEffect(() => {
    onReviewsLoadedRef.current = onReviewsLoaded;
  }, [onReviewsLoaded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lastFetchedKeyRef = useRef<string>('');

  const fetchApiReviews = useCallback(async (force = false) => {
    const cacheKey = `${productId || 'homepage'}`;
    if (!force && lastFetchedKeyRef.current === cacheKey) {
      return;
    }
    lastFetchedKeyRef.current = cacheKey;

    try {
      const url = productId
        ? `/api/reviews?productId=${encodeURIComponent(productId)}&limit=24`
        : '/api/reviews?limit=24';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const items: Review[] = Array.isArray(data) ? data : data.reviews || [];
        setReviews(items);
        onReviewsLoadedRef.current?.(items);
      }
    } catch (err) {
      console.warn('API reviews fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchApiReviews();
  }, [fetchApiReviews]);

  // Ranked reviews according to authenticity & substance
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const scoreDiff = scoreReviewQuality(b) - scoreReviewQuality(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [reviews]);

  // Ensure we have at least 8 items for a smooth, seamless infinite continuous marquee loop
  const marqueeItems = useMemo(() => {
    if (sortedReviews.length === 0) return [];
    let items = [...sortedReviews];
    while (items.length < 8) {
      items = [...items, ...sortedReviews];
    }
    return items;
  }, [sortedReviews]);

  // Metrics summary
  const totalCount = reviews.length;
  const verifiedCount = reviews.filter((r) => r.verifiedPurchase).length;
  const avgRating = totalCount > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(1)
    : '5.0';

  const renderCard = (rev: Review, keyPrefix: string, index: number) => {
    const cardType = getCardType(rev, index);
    const dateFormatted = rev.createdAt
      ? new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'RECENT';

    const authorInitials = rev.userName?.slice(0, 1).toUpperCase() || 'C';

    if (cardType === 'media' && rev.media && rev.media.length > 0) {
      const firstMedia = rev.media[0];
      return (
        <article
          key={`${keyPrefix}-${rev.id}-${index}`}
          className={`${styles.card} ${styles.cardMedia}`}
          onClick={() => setLightboxMedia({ media: firstMedia, review: rev })}
        >
          <div className={styles.mediaBackdrop}>
            {firstMedia.type === 'video' ? (
              firstMedia.thumbnailUrl ? (
                <img src={firstMedia.thumbnailUrl} alt="Customer video thumbnail" className={styles.mediaImg} />
              ) : (
                <video
                  src={normalizeMediaUrl(firstMedia.url)}
                  className={styles.mediaImg}
                  muted
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    try {
                      e.currentTarget.currentTime = 0.05;
                    } catch {}
                  }}
                />
              )
            ) : (
              <img src={normalizeMediaUrl(firstMedia.url)} alt="Customer wearing GERKINK" className={styles.mediaImg} />
            )}
            <div className={styles.mediaGradient} />
            {firstMedia.type === 'video' && <span className={styles.videoBadge}>▶ VIDEO</span>}
          </div>

          <div className={styles.mediaCardContent}>
            <div className={styles.cardHeader}>
              <RatingStars rating={rev.rating} size="sm" />
              {rev.verifiedPurchase && <span className={styles.verifiedTag}>✓ VERIFIED</span>}
            </div>

            <p className={styles.mediaQuote}>
              &ldquo;{rev.title || rev.text.slice(0, 75)}&rdquo;
            </p>

            <div className={styles.cardFooter}>
              <span className={styles.authorName}>{rev.userName || 'Customer'}</span>
              <span className={styles.metaDate}>{dateFormatted}</span>
            </div>
          </div>
        </article>
      );
    }

    if (cardType === 'quote') {
      return (
        <article key={`${keyPrefix}-${rev.id}-${index}`} className={`${styles.card} ${styles.cardQuote}`}>
          <div className={styles.cardHeader}>
            <RatingStars rating={rev.rating} size="sm" />
            {rev.verifiedPurchase && <span className={styles.verifiedTag}>✓ VERIFIED</span>}
          </div>

          <div className={styles.quoteBody}>
            <p className={styles.boldQuoteText}>
              &ldquo;{rev.title || rev.text}&rdquo;
            </p>
            {rev.title && rev.text && rev.text !== rev.title && (
              <p className={styles.subTextSnippet}>
                {rev.text.length > 90 ? `${rev.text.slice(0, 90)}…` : rev.text}
              </p>
            )}
          </div>

          <div className={styles.cardFooter}>
            <div className={styles.authorGroup}>
              <span className={styles.authorInitialCircle}>{authorInitials}</span>
              <span className={styles.authorName}>{rev.userName || 'Customer'}</span>
            </div>
            <span className={styles.metaDate}>{dateFormatted}</span>
          </div>
        </article>
      );
    }

    // Default: Text Card
    return (
      <article key={`${keyPrefix}-${rev.id}-${index}`} className={`${styles.card} ${styles.cardText}`}>
        <div className={styles.cardHeader}>
          <RatingStars rating={rev.rating} size="sm" />
          {rev.verifiedPurchase ? (
            <span className={styles.verifiedTag}>✓ VERIFIED</span>
          ) : (
            <span className={styles.neutralTag}>CUSTOMER</span>
          )}
        </div>

        {rev.title && <h4 className={styles.cardTitle}>{rev.title}</h4>}
        <p className={styles.standardBodyText}>
          &ldquo;{rev.text.length > 130 ? `${rev.text.slice(0, 130)}…` : rev.text}&rdquo;
        </p>

        <div className={styles.cardFooter}>
          <div className={styles.authorGroup}>
            <span className={styles.authorInitialCircle}>{authorInitials}</span>
            <span className={styles.authorName}>{rev.userName || 'Customer'}</span>
          </div>
          <span className={styles.metaDate}>{dateFormatted}</span>
        </div>
      </article>
    );
  };

  return (
    <section className={styles.section} aria-label="Customer Reviews">
      <div className={styles.glowBg} aria-hidden />

      <div className={styles.inner}>
        {/* ── HEADER ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className="text-label" style={{ color: 'var(--coral-200)' }}>
              AUTHENTIC CUSTOMER VERDICTS
            </p>
            <div className={styles.scoreRow}>
              <span className={styles.bigScore}>{avgRating} ★</span>
              <span className={styles.verifiedCountPill}>
                {verifiedCount > 0 ? `${verifiedCount} VERIFIED REVIEWS` : `${totalCount} CUSTOMER VERDICTS`}
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.preventDefault();
                setIsWriteModalOpen(true);
              }}
            >
              Write a Review →
            </button>
          </div>
        </div>

        {/* ── CONTENT AREA ── */}
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <span>Loading authentic verdicts…</span>
          </div>
        ) : sortedReviews.length === 0 ? (
          /* 0 Reviews: Compact Launch State */
          <div className={styles.emptyLaunchState}>
            <div className={styles.launchTag}>FIRST CUSTOMER OPPORTUNITY</div>
            <h3 className={styles.launchTitle}>NO REVIEWS. YET.</h3>
            <p className={styles.launchDesc}>
              Be the first GERKINK customer to leave your mark.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.preventDefault();
                setIsWriteModalOpen(true);
              }}
            >
              WRITE THE FIRST REVIEW →
            </button>
          </div>
        ) : (
          /* Seamless Continuous Infinite Marquee Loop (Set A + Set B) */
          <div className={styles.marqueeViewport}>
            <div className={styles.marqueeTrack}>
              {marqueeItems.map((rev, i) => renderCard(rev, `track1-${i}`, i))}
              {marqueeItems.map((rev, i) => renderCard(rev, `track2-${i}`, i))}
            </div>
          </div>
        )}

        {/* ── BOTTOM LINK ── */}
        {sortedReviews.length > 0 && (
          <div className={styles.footerLinkWrap}>
            <Link href="/shop" className={styles.seeAllLink}>
              EXPLORE ALL GERKINK COLLECTIONS →
            </Link>
          </div>
        )}
      </div>

      {/* ── WRITE REVIEW MODAL (PORTALED) ── */}
      <WriteReviewModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        productId={productId}
        onReviewSubmitted={fetchApiReviews}
      />

      {/* ── MEDIA LIGHTBOX (PORTALED) ── */}
      {lightboxMedia && mounted && createPortal(
        <div className={styles.lightboxOverlay} onClick={() => setLightboxMedia(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setLightboxMedia(null)}
            >
              ✕
            </button>
            <div className={styles.lightboxMediaBox}>
              {lightboxMedia.media.type === 'video' ? (
                <video
                  src={normalizeMediaUrl(lightboxMedia.media.url)}
                  poster={lightboxMedia.media.thumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className={styles.lightboxMedia}
                />
              ) : (
                <img src={normalizeMediaUrl(lightboxMedia.media.url)} alt="Review upload full" className={styles.lightboxMedia} />
              )}
            </div>
            <div className={styles.lightboxSidebar}>
              <div className={styles.lightboxUserRow}>
                <span className={styles.lightboxUserName}>{lightboxMedia.review.userName || 'Customer'}</span>
                {lightboxMedia.review.verifiedPurchase && (
                  <span className={styles.verifiedTag}>✓ VERIFIED PURCHASE</span>
                )}
              </div>
              <RatingStars rating={lightboxMedia.review.rating} size="sm" />
              {lightboxMedia.review.title && (
                <h4 className={styles.lightboxTitle}>{lightboxMedia.review.title}</h4>
              )}
              <p className={styles.lightboxBody}>{lightboxMedia.review.text}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
