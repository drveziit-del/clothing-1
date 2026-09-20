'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import RatingStars from '@/components/reviews/RatingStars';
import { normalizeMediaUrl } from '@/lib/utils/videoThumbnail';
import type { Review } from '@/types';
import styles from './page.module.css';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'approved' | 'rejected' | 'flagged'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?admin=true&status=all`);
      if (!res.ok) throw new Error('Failed to load reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err: any) {
      console.error('Error fetching admin reviews:', err);
      showToast(err.message || 'Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleModeration = async (reviewId: string, action: 'approve' | 'reject' | 'flag' | 'delete') => {
    if (action === 'delete' && !window.confirm('Are you sure you want to permanently delete this review?')) {
      return;
    }

    setActionLoading(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update review');
      }

      showToast(
        action === 'approve'
          ? '✓ Review approved and published to product page.'
          : action === 'reject'
          ? 'Review rejected and hidden from store.'
          : action === 'flag'
          ? 'Review flagged for audit.'
          : 'Review deleted.'
      );

      await fetchReviews();
    } catch (err: any) {
      console.error(`Moderation ${action} error:`, err);
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) return;

    setActionLoading(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          action: 'reply',
          replyText: replyText.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send reply');
      }

      showToast('✓ Official GERKINK reply posted.');
      setReplyingId(null);
      setReplyText('');
      await fetchReviews();
    } catch (err: any) {
      console.error('Reply error:', err);
      showToast(err.message || 'Failed to post reply', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const totalReviews = reviews.length;
  const pendingReviews = reviews.filter((r) => r.status === 'pending');
  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const rejectedReviews = reviews.filter((r) => r.status === 'rejected');
  const flaggedReviews = reviews.filter((r) => r.status === 'flagged');
  const verifiedCount = reviews.filter((r) => r.verifiedPurchase).length;
  const mediaCount = reviews.reduce((acc, r) => acc + (r.media?.length || 0), 0);
  const avgRating = totalReviews > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) : '0.0';

  // Filter list by tab & search query
  const filteredList = reviews.filter((r) => {
    if (activeTab === 'pending' && r.status !== 'pending') return false;
    if (activeTab === 'approved' && r.status !== 'approved') return false;
    if (activeTab === 'rejected' && r.status !== 'rejected') return false;
    if (activeTab === 'flagged' && r.status !== 'flagged') return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.userName?.toLowerCase().includes(q) ||
      r.userEmailMasked?.toLowerCase().includes(q) ||
      r.productTitle?.toLowerCase().includes(q) ||
      r.productId?.toLowerCase().includes(q) ||
      r.orderId?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.text?.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.container}>
      {toastMsg && (
        <div className={`${styles.toast} ${toastMsg.type === 'error' ? styles.toastError : ''}`}>
          {toastMsg.text}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.adminBadge}>MODERATION CENTER</span>
            {pendingReviews.length > 0 && (
              <span className={styles.pendingBadge}>
                {pendingReviews.length} Action Needed
              </span>
            )}
          </div>
          <h1 className={styles.title}>Customer Reviews & UGC</h1>
          <p className={styles.subtitle}>
            Review authentic customer verdicts, verify purchase integrity, manage media consent, and reply to community feedback.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchReviews}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : '↻ Refresh Data'}
        </button>
      </div>

      {/* ── STATS CARDS ── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>TOTAL REVIEWS</span>
          <span className={styles.statVal}>{totalReviews}</span>
          <span className={styles.statSub}>{verifiedCount} verified buyers</span>
        </div>
        <div className={`${styles.statCard} ${pendingReviews.length > 0 ? styles.statCardAlert : ''}`}>
          <span className={styles.statLabel}>PENDING MODERATION</span>
          <span className={styles.statVal}>{pendingReviews.length}</span>
          <span className={styles.statSub}>Awaiting approval</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>APPROVED LIVE</span>
          <span className={styles.statVal}>{approvedReviews.length}</span>
          <span className={styles.statSub}>Visible on store</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>AVG RATING</span>
          <span className={styles.statVal}>{avgRating} ★</span>
          <span className={styles.statSub}>Across all submissions</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>UGC MEDIA</span>
          <span className={styles.statVal}>{mediaCount}</span>
          <span className={styles.statSub}>Photos & Videos</span>
        </div>
      </div>

      {/* ── TABS & SEARCH BAR ── */}
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'pending' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Moderation ({pendingReviews.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({totalReviews})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'approved' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved ({approvedReviews.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'rejected' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            Rejected ({rejectedReviews.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'flagged' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('flagged')}
          >
            Flagged ({flaggedReviews.length})
          </button>
        </div>

        <div className={styles.searchWrap}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by customer, product, order ID, or text…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── REVIEWS LIST ── */}
      {loading ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <span>Loading reviews…</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>★</div>
          <h3 className={styles.emptyTitle}>
            {activeTab === 'pending'
              ? 'No Reviews Awaiting Moderation'
              : 'No Reviews Found'}
          </h3>
          <p className={styles.emptyDesc}>
            {activeTab === 'pending'
              ? 'All incoming reviews have been processed and published.'
              : 'No customer reviews match the selected tab or search query.'}
          </p>
        </div>
      ) : (
        <div className={styles.reviewsList}>
          {filteredList.map((review) => {
            const isPending = review.status === 'pending';
            const isApproved = review.status === 'approved';
            const isRejected = review.status === 'rejected';
            const isFlagged = review.status === 'flagged';
            const isBusy = actionLoading === review.id;

            return (
              <div
                key={review.id}
                className={`${styles.reviewCard} ${
                  isPending ? styles.cardPending : isRejected ? styles.cardRejected : isFlagged ? styles.cardFlagged : ''
                }`}
              >
                {/* Card Header */}
                <div className={styles.cardTop}>
                  <div className={styles.customerMeta}>
                    <div className={styles.avatar}>
                      {review.userName?.slice(0, 1).toUpperCase() || 'C'}
                    </div>
                    <div>
                      <div className={styles.nameRow}>
                        <span className={styles.userName}>{review.userName || 'Customer'}</span>
                        {review.verifiedPurchase ? (
                          <span className={styles.verifiedBadge}>
                            ✓ VERIFIED PURCHASE
                          </span>
                        ) : (
                          <span className={styles.unverifiedBadge}>UNVERIFIED</span>
                        )}
                        <span
                          className={`${styles.statusPill} ${
                            isApproved
                              ? styles.statusApproved
                              : isPending
                              ? styles.statusPending
                              : isRejected
                              ? styles.statusRejected
                              : styles.statusFlagged
                          }`}
                        >
                          {review.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      <div className={styles.subInfo}>
                        {review.userEmailMasked && <span>{review.userEmailMasked} · </span>}
                        {review.orderId && (
                          <span className={styles.orderPill}>Order: {review.orderId} · </span>
                        )}
                        <span>
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.ratingBox}>
                    <RatingStars rating={review.rating} size="sm" />
                    <span className={styles.ratingNumber}>{review.rating} / 5</span>
                  </div>
                </div>

                {/* Product Reference */}
                <div className={styles.productRef}>
                  <span className={styles.productRefLabel}>PRODUCT:</span>
                  {review.productId ? (
                    <Link
                      href={`/shop/${review.productId}`}
                      target="_blank"
                      className={styles.productLink}
                    >
                      {review.productTitle || review.productId} ↗
                    </Link>
                  ) : (
                    <span className={styles.productLink}>
                      {review.productTitle || 'General Brand Review'}
                    </span>
                  )}
                  {review.fit && (
                    <span className={styles.fitTag}>
                      FIT: {review.fit === 'runs_small' ? 'Runs Small' : review.fit === 'runs_large' ? 'Runs Large' : 'True to Size'}
                    </span>
                  )}
                  {review.marketingConsent && (
                    <span className={styles.consentTag}>✓ UGC Consent Granted</span>
                  )}
                </div>

                {/* Review Body */}
                <div className={styles.contentBody}>
                  {review.title && <h4 className={styles.reviewTitle}>{review.title}</h4>}
                  <p className={styles.reviewText}>{review.text}</p>
                </div>

                {/* Customer UGC Media */}
                {review.media && review.media.length > 0 && (
                  <div className={styles.mediaGallery}>
                    <span className={styles.mediaHeading}>
                      ATTACHED MEDIA ({review.media.length}):
                    </span>
                    <div className={styles.mediaThumbRow}>
                      {review.media.map((m, idx) => (
                        <div
                          key={idx}
                          className={styles.mediaThumbWrap}
                          onClick={() => setPreviewMedia(m)}
                        >
                          {m.type === 'video' ? (
                            <div className={styles.videoThumbBox}>
                              {m.thumbnailUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={m.thumbnailUrl} alt="Video thumbnail" className={styles.mediaThumb} />
                              ) : (
                                <video src={normalizeMediaUrl(m.url)} className={styles.mediaThumb} muted playsInline preload="auto" />
                              )}
                              <span className={styles.videoPlayOverlay}>▶</span>
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={normalizeMediaUrl(m.url)} alt="Customer upload" className={styles.mediaThumb} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Official Staff Reply */}
                {review.officialReply && (
                  <div className={styles.officialReplyBox}>
                    <div className={styles.officialReplyHeader}>
                      <span className={styles.officialTag}>GERKINK OFFICIAL RESPONSE</span>
                      <span className={styles.replyDate}>
                        {new Date(review.officialReply.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className={styles.officialReplyText}>{review.officialReply.text}</p>
                  </div>
                )}

                {/* Inline Reply Box */}
                {replyingId === review.id && (
                  <div className={styles.replyForm}>
                    <label className={styles.replyLabel}>WRITE OFFICIAL RESPONSE AS GERKINK:</label>
                    <textarea
                      className={styles.replyTextarea}
                      placeholder="Thank the customer or address sizing/delivery feedback..."
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className={styles.replyActions}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setReplyingId(null);
                          setReplyText('');
                        }}
                        disabled={isBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSendReply(review.id)}
                        disabled={isBusy || !replyText.trim()}
                      >
                        {isBusy ? 'Posting…' : 'Publish Official Reply →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Moderation Actions Bar */}
                <div className={styles.actionsBar}>
                  <div className={styles.actionLeft}>
                    {!isApproved && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.btnApprove}`}
                        onClick={() => handleModeration(review.id, 'approve')}
                        disabled={isBusy}
                      >
                        ✓ Approve & Publish
                      </button>
                    )}
                    {!isRejected && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.btnReject}`}
                        onClick={() => handleModeration(review.id, 'reject')}
                        disabled={isBusy}
                      >
                        ✕ Reject
                      </button>
                    )}
                    {!isFlagged && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.btnFlag}`}
                        onClick={() => handleModeration(review.id, 'flag')}
                        disabled={isBusy}
                      >
                        🚩 Flag
                      </button>
                    )}
                    {replyingId !== review.id && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.btnReply}`}
                        onClick={() => {
                          setReplyingId(review.id);
                          setReplyText(review.officialReply?.text || '');
                        }}
                        disabled={isBusy}
                      >
                        💬 {review.officialReply ? 'Edit Reply' : 'Reply'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.btnDelete}`}
                    onClick={() => handleModeration(review.id, 'delete')}
                    disabled={isBusy}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MEDIA PREVIEW MODAL ── */}
      {previewMedia && (
        <div className={styles.previewOverlay} onClick={() => setPreviewMedia(null)}>
          <div className={styles.previewContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.previewClose}
              onClick={() => setPreviewMedia(null)}
            >
              ✕
            </button>
            {previewMedia.type === 'video' ? (
              <video
                src={normalizeMediaUrl(previewMedia.url)}
                controls
                autoPlay
                playsInline
                preload="auto"
                className={styles.previewMedia}
              >
                <source src={normalizeMediaUrl(previewMedia.url)} type="video/mp4" />
              </video>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={normalizeMediaUrl(previewMedia.url)} alt="Review upload full" className={styles.previewMedia} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
