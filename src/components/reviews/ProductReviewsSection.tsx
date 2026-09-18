'use client';

/* eslint-disable @next/next/no-img-element -- dynamic customer uploads & avatars */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { normalizeMediaUrl } from '@/lib/utils/videoThumbnail';
import type { Review, ProductReviewSummary, ReviewMedia } from '@/types';
import styles from './ProductReviewsSection.module.css';

// Dynamically split submission modal and uploader chunk until user clicks 'Write a Review'
const WriteReviewModal = dynamic(() => import('./WriteReviewModal'), {
  ssr: false,
});

interface ProductReviewsSectionProps {
  productId: string;
  productTitle?: string;
  onReviewsLoaded?: (reviews: Review[], summary: ProductReviewSummary) => void;
}

/**
 * Dedicated Interactive Video Player for the Portaled Lightbox
 */
function LightboxVideoPlayer({
  src,
  poster,
}: {
  src: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const [hasError, setHasError] = useState(false);

  const normalizedSrc = normalizeMediaUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    try {
      video.load();
    } catch {}

    // Attempt autoplay
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setShowPlayOverlay(false);
        })
        .catch(() => {
          // Autoplay with sound blocked by browser policy; show play button overlay
          setIsPlaying(false);
          setShowPlayOverlay(true);
        });
    }
  }, [normalizedSrc]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setShowPlayOverlay(false);
        })
        .catch((err) => {
          console.warn('[LightboxVideoPlayer] Play error:', err);
        });
    } else {
      video.pause();
      setIsPlaying(false);
      setShowPlayOverlay(true);
    }
  };

  if (hasError) {
    return (
      <div className={styles.videoFallbackStage} onClick={(e) => e.stopPropagation()}>
        <div className={styles.videoFallbackIconCircle}>
          <span>▶</span>
        </div>
        <span className={styles.videoFallbackBadge}>VIDEO REVIEW</span>
        <h4 className={styles.videoFallbackTitle}>VIDEO PREVIEW UNAVAILABLE</h4>
        <p className={styles.videoFallbackSub}>This video format cannot be previewed directly in this browser.</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.videoFallbackBtn}
          onClick={(e) => e.stopPropagation()}
        >
          OPEN VIDEO ↗
        </a>
      </div>
    );
  }

  return (
    <div className={styles.lightboxVideoWrapper} onClick={togglePlay}>
      <video
        ref={videoRef}
        src={normalizedSrc}
        poster={poster}
        controls
        playsInline
        preload="auto"
        className={styles.lightboxImg}
        onPlay={() => {
          setIsPlaying(true);
          setShowPlayOverlay(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowPlayOverlay(true);
        }}
        onError={(e) => {
          // Only trigger fallback if the video element genuinely failed
          if (e.currentTarget.error) {
            console.warn('[LightboxVideoPlayer] Video load error:', e.currentTarget.error);
            setHasError(true);
          }
        }}
      />

      {showPlayOverlay && !isPlaying && (
        <button
          type="button"
          className={styles.lightboxPlayPrompt}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          aria-label="Play video with sound"
        >
          <span className={styles.lightboxPlayPromptIcon}>▶</span>
          <span className={styles.lightboxPlayPromptText}>PLAY VIDEO</span>
        </button>
      )}
    </div>
  );
}

export default function ProductReviewsSection({
  productId,
  productTitle = 'Product',
  onReviewsLoaded,
}: ProductReviewsSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummary>({
    averageRating: 0,
    totalReviews: 0,
    verifiedReviewsCount: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    fitDistribution: { runs_small: 0, true_to_size: 0, runs_large: 0 },
    mediaCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<'recent' | 'highest' | 'lowest' | 'media' | 'verified'>('recent');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ media: ReviewMedia; review: Review } | null>(null);
  const [votedReviews, setVotedReviews] = useState<Record<string, boolean>>({});

  const onReviewsLoadedRef = useRef(onReviewsLoaded);
  useEffect(() => {
    onReviewsLoadedRef.current = onReviewsLoaded;
  }, [onReviewsLoaded]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and handle Escape key when Lightbox is active
  useEffect(() => {
    if (lightboxMedia) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightboxMedia(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [lightboxMedia]);

  const lastFetchedKeyRef = useRef<string>('');

  const fetchReviews = useCallback(async (isLoadMore = false, targetPage = 1, force = false) => {
    const cacheKey = `${productId}-${sort}-${targetPage}-${ratingFilter}-${mediaOnly}-${verifiedOnly}`;
    if (!force && !isLoadMore && lastFetchedKeyRef.current === cacheKey) {
      return;
    }
    lastFetchedKeyRef.current = cacheKey;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        productId,
        sort,
        page: String(targetPage),
        limit: '6',
      });
      if (ratingFilter) params.append('rating', String(ratingFilter));
      if (mediaOnly) params.append('mediaOnly', 'true');
      if (verifiedOnly) params.append('verifiedOnly', 'true');

      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newReviews = data.reviews || [];
        if (isLoadMore) {
          setReviews((prev) => [...prev, ...newReviews]);
        } else {
          setReviews(newReviews);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
        setTotalPages(data.totalPages || 1);
        if (onReviewsLoadedRef.current && !isLoadMore && data.summary) {
          onReviewsLoadedRef.current(newReviews, data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [productId, sort, ratingFilter, mediaOnly, verifiedOnly]);

  useEffect(() => {
    setPage(1);
    fetchReviews(false, 1);
  }, [fetchReviews]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchReviews(true, nextPage);
    }
  };

  const handleVote = async (e: React.MouseEvent, reviewId: string) => {
    e.stopPropagation();
    if (votedReviews[reviewId]) return;

    const previousCount = reviews.find((r) => r.id === reviewId)?.helpfulCount || 0;
    setVotedReviews((prev) => ({ ...prev, [reviewId]: true }));
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r))
    );

    try {
      const res = await fetch('/api/reviews/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, vote: 'up' }),
      });
      if (!res.ok) {
        throw new Error('Vote request failed');
      }
    } catch (err) {
      console.error('[ProductReviewsSection] Vote failed, rolling back:', err);
      setVotedReviews((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: previousCount } : r))
      );
    }
  };

  return (
    <section className={styles.sectionRoot} id="reviews-section" aria-label="Customer Reviews">
      {/* ── 1. HEADER & ACTIONS ─────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.kicker}>AUTHENTIC CUSTOMER VERDICTS</p>
          <div className={styles.headerRatingRow}>
            {summary.totalReviews > 0 ? (
              <>
                <span className={styles.headerScore}>{summary.averageRating.toFixed(1)}</span>
                <span className={styles.headerStar}>★</span>
                <span className={styles.headerSlash}>/5</span>
              </>
            ) : (
              <span className={styles.headerScore}>NO VERDICTS YET</span>
            )}
            <span className={styles.verifiedCountBadge}>
              <svg className={styles.badgeShield} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              {summary.totalReviews} VERIFIED REVIEWS
            </span>
          </div>
          <p className={styles.headerSubtitle}>Real people. Real fits. Real GERKINK.</p>
        </div>

        <button
          type="button"
          className={styles.leaveVerdictBtn}
          onClick={(e) => {
            e.preventDefault();
            setIsWriteModalOpen(true);
          }}
        >
          LEAVE YOUR VERDICT →
        </button>
      </div>

      {/* ── 2. FILTER & SORT TOOLBAR ─────────────────────── */}
      {summary.totalReviews > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.pill} ${!ratingFilter && !mediaOnly && !verifiedOnly ? styles.pillActive : ''}`}
              onClick={() => {
                setRatingFilter(null);
                setMediaOnly(false);
                setVerifiedOnly(false);
              }}
            >
              ALL ({summary.totalReviews})
            </button>

            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.ratingDistribution[star] || 0;
              if (count === 0 && summary.totalReviews > 3) return null;
              return (
                <button
                  key={star}
                  type="button"
                  className={`${styles.pill} ${ratingFilter === star ? styles.pillActive : ''}`}
                  onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
                >
                  {star}★ ({count})
                </button>
              );
            })}

            {summary.mediaCount > 0 && (
              <button
                type="button"
                className={`${styles.pill} ${mediaOnly ? styles.pillActive : ''}`}
                onClick={() => setMediaOnly(!mediaOnly)}
              >
                📷 PHOTOS ({summary.mediaCount})
              </button>
            )}

            <button
              type="button"
              className={`${styles.pill} ${verifiedOnly ? styles.pillActive : ''}`}
              onClick={() => setVerifiedOnly(!verifiedOnly)}
            >
              🛡 VERIFIED ({summary.verifiedReviewsCount})
            </button>
          </div>

          <div className={styles.sortWrapper}>
            <span className={styles.sortLabel}>SORT:</span>
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="recent">MOST RECENT</option>
              <option value="highest">HIGHEST RATED</option>
              <option value="lowest">LOWEST RATED</option>
              <option value="media">WITH MEDIA</option>
              <option value="verified">VERIFIED FIRST</option>
            </select>
          </div>
        </div>
      )}

      {/* ── 3. LUXURY EDITORIAL REVIEW CARDS GRID ────────── */}
      {loading && !loadingMore ? (
        <div className={styles.cardsGrid}>
          {[1, 2, 3].map((n) => (
            <div key={n} className={`${styles.card} ${styles.skeletonCard}`}>
              <div className={styles.skelHeader} />
              <div className={styles.skelHeadline} />
              <div className={styles.skelBody} />
              <div className={styles.skelMedia} />
              <div className={styles.skelFooter} />
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className={styles.cardsGrid}>
          {reviews.map((rev) => {
            const authorInitial = rev.userName?.slice(0, 1).toUpperCase() || 'C';
            const dateFormatted = rev.createdAt
              ? new Date(rev.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                }).toUpperCase()
              : 'AUG 28, 2026';

            const fitLabel =
              rev.fit === 'runs_small'
                ? 'RUNS SMALL'
                : rev.fit === 'runs_large'
                ? 'RUNS LARGE'
                : 'TRUE TO SIZE';

            const isFitAltered = rev.fit === 'runs_small' || rev.fit === 'runs_large';

            return (
              <article key={rev.id} className={styles.card}>
                {/* ── Top Row: Rating Stars & Date ── */}
                <div className={styles.cardHeader}>
                  <div className={styles.starsWrap}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`${styles.starIcon} ${i < rev.rating ? styles.starFilled : styles.starEmpty}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <span className={styles.cardDate}>{dateFormatted}</span>
                </div>

                {/* ── Verified Purchase Indicator (Only when verified) ── */}
                {rev.verifiedPurchase && (
                  <div className={styles.verifiedRow}>
                    <svg className={styles.shieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 12l2 2 4-4"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={styles.verifiedText}>VERIFIED PURCHASE</span>
                  </div>
                )}

                {/* ── Headline with Faint Background Quotation Mark ── */}
                <div className={styles.headlineArea}>
                  <span className={styles.bgQuoteMark} aria-hidden="true">“</span>
                  <h3 className={styles.headline}>
                    {rev.title || 'The fabric is actually insane.'}
                  </h3>
                </div>

                {/* ── Review Body ── */}
                {rev.text && (
                  <p className={styles.bodyText}>{rev.text}</p>
                )}

                {/* ── Compact Customer Media Thumbnails (150-180px Square) ── */}
                {rev.media && rev.media.length > 0 && (
                  <div className={styles.mediaContainer}>
                    {rev.media.slice(0, 2).map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className={styles.mediaWrapper}
                        onClick={() => setLightboxMedia({ media: m, review: rev })}
                        role="button"
                        tabIndex={0}
                        title={m.type === 'video' ? 'Click to play video' : 'Click to view photo'}
                      >
                        {m.type === 'video' ? (
                          <div className={styles.videoCardBox}>
                            {m.thumbnailUrl ? (
                              <img src={m.thumbnailUrl} alt="Customer video thumbnail" className={styles.mediaElement} />
                            ) : (
                              <video
                                src={normalizeMediaUrl(m.url)}
                                className={styles.mediaElement}
                                muted
                                playsInline
                                preload="auto"
                                onLoadedMetadata={(e) => {
                                  try {
                                    e.currentTarget.currentTime = 0.05;
                                  } catch {}
                                }}
                              />
                            )}
                            <div className={styles.videoOverlay}>
                              <span className={styles.playIcon}>▶</span>
                            </div>
                            <span className={styles.videoLabelTag}>VIDEO</span>
                          </div>
                        ) : (
                          <img src={m.url} alt="Customer review photo" className={styles.mediaElement} />
                        )}
                      </div>
                    ))}
                    {rev.media.length > 2 && (
                      <div className={styles.extraMediaThumbs}>
                        {rev.media.slice(2, 4).map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className={styles.miniExtraThumb}
                            onClick={() => setLightboxMedia({ media: m, review: rev })}
                          >
                            {m.type === 'video' ? (
                              m.thumbnailUrl ? (
                                <img src={m.thumbnailUrl} alt="Customer upload thumbnail" className={styles.miniExtraImg} />
                              ) : (
                                <video src={normalizeMediaUrl(m.url)} className={styles.miniExtraImg} muted playsInline preload="auto" />
                              )
                            ) : (
                              <img src={normalizeMediaUrl(m.url)} alt="Customer upload" className={styles.miniExtraImg} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Official Staff Reply (if exists) ── */}
                {rev.officialReply && (
                  <div className={styles.brandReplyBox}>
                    <span className={styles.brandReplyTag}>GERKINK VERDICT:</span>
                    <p className={styles.brandReplyText}>{rev.officialReply.text}</p>
                  </div>
                )}

                {/* ── Bottom Section: Divider, User Info + Fit & Helpful ── */}
                <div className={styles.cardBottom}>
                  <div className={styles.userFitBar}>
                    <div className={styles.userInfo}>
                      <span className={styles.userAvatar}>{authorInitial}</span>
                      <span className={styles.userName}>{rev.userName || 'Customer'}</span>
                    </div>

                    <div className={styles.fitInfo}>
                      <span className={styles.fitDivider}>|</span>
                      <span className={styles.fitLabel}>
                        FIT: <span className={isFitAltered ? styles.fitValueAlert : styles.fitValue}>{fitLabel}</span>
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <button
                      type="button"
                      className={`${styles.helpfulButton} ${votedReviews[rev.id] ? styles.helpfulVoted : ''}`}
                      onClick={(e) => handleVote(e, rev.id)}
                      disabled={votedReviews[rev.id]}
                    >
                      <svg className={styles.heartIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>HELPFUL ({rev.helpfulCount || 0})</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : summary.totalReviews > 0 ? (
        <div className={styles.emptyFilteredState}>
          <p>No reviews match your selected filter.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setRatingFilter(null);
              setMediaOnly(false);
              setVerifiedOnly(false);
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Launch State: 0 Reviews */
        <div className={styles.launchCard}>
          <span className={styles.launchTag}>FIRST CUSTOMER OPPORTUNITY</span>
          <h3 className={styles.launchTitle}>NO REVIEWS. YET.</h3>
          <p className={styles.launchDesc}>Be the first GERKINK customer to leave your mark.</p>
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
      )}

      {/* ── 4. LOAD MORE BUTTON ──────────────────────────── */}
      {reviews.length > 0 && page < totalPages && (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            className={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'LOAD MORE REVIEWS →'}
          </button>
        </div>
      )}

      {/* ── 5. MEDIA LIGHTBOX (55% MEDIA / 45% INFO SPLIT) ─────────────────── */}
      {lightboxMedia && mounted && createPortal(
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightboxMedia(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Customer review media preview"
        >
          <div className={styles.lightboxDialog} onClick={(e) => e.stopPropagation()}>
            {/* Global Close Button at top-right */}
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setLightboxMedia(null)}
              aria-label="Close media dialog"
            >
              ✕
            </button>

            {/* Left Media Stage (55% Hero) */}
            <div className={styles.lightboxMediaBox}>
              {lightboxMedia.media.type === 'video' ? (
                <LightboxVideoPlayer
                  src={lightboxMedia.media.playbackUrl || lightboxMedia.media.url}
                  poster={lightboxMedia.media.thumbnailUrl}
                />
              ) : (
                <img src={normalizeMediaUrl(lightboxMedia.media.playbackUrl || lightboxMedia.media.url)} alt="Customer review media" className={styles.lightboxImg} />
              )}
            </div>

            {/* Right Review Information Panel (45%) */}
            <div className={styles.lightboxSidebar}>
              <div className={styles.lightboxSidebarTop}>
                {/* Customer Identity */}
                <div className={styles.lightboxAuthorRow}>
                  <span className={styles.lightboxAvatar}>
                    {lightboxMedia.review.userName?.slice(0, 1).toUpperCase() || 'C'}
                  </span>
                  <span className={styles.lightboxAuthor}>
                    {lightboxMedia.review.userName || 'Customer'}
                  </span>
                </div>

                {/* Star Rating */}
                <div className={styles.lightboxRatingRow}>
                  <div className={styles.starsWrap}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`${styles.starIcon} ${i < lightboxMedia.review.rating ? styles.starFilled : styles.starEmpty}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className={styles.lightboxRatingScore}>
                    {lightboxMedia.review.rating}.0 / 5
                  </span>
                </div>

                {/* Review Title Quote */}
                {lightboxMedia.review.title && (
                  <h3 className={styles.lightboxTitle}>
                    &ldquo;{lightboxMedia.review.title}&rdquo;
                  </h3>
                )}

                {/* Review Body */}
                {lightboxMedia.review.text && (
                  <p className={styles.lightboxBody}>{lightboxMedia.review.text}</p>
                )}
              </div>

              {/* Bottom Metadata: Verified + Fit + Date */}
              <div className={styles.lightboxSidebarBottom}>
                {lightboxMedia.review.verifiedPurchase && (
                  <div className={styles.lightboxVerifiedRow}>
                    <svg className={styles.shieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={styles.verifiedText}>VERIFIED PURCHASE</span>
                  </div>
                )}

                <div className={styles.lightboxMetaRow}>
                  {lightboxMedia.review.fit && (
                    <span className={styles.lightboxFitTag}>
                      FIT · <span className={lightboxMedia.review.fit === 'true_to_size' ? styles.fitValue : styles.fitValueAlert}>
                        {lightboxMedia.review.fit === 'runs_small' ? 'RUNS SMALL' : lightboxMedia.review.fit === 'runs_large' ? 'RUNS LARGE' : 'TRUE TO SIZE'}
                      </span>
                    </span>
                  )}

                  <span className={styles.lightboxDate}>
                    {lightboxMedia.review.createdAt
                      ? new Date(lightboxMedia.review.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric',
                        }).toUpperCase()
                      : 'AUG 28, 2026'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 6. WRITE REVIEW MODAL ────────────────────────── */}
      <WriteReviewModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        productId={productId}
        productTitle={productTitle}
        onReviewSubmitted={() => fetchReviews(false, 1)}
      />
    </section>
  );
}
