'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Review, ReviewStatus } from '@/types';
import RatingStars from '@/components/reviews/RatingStars';
import { normalizeMediaUrl } from '@/lib/utils/videoThumbnail';
import styles from './ReviewModeration.module.css';

export default function ReviewModeration() {
  const [activeTab, setActiveTab] = useState<ReviewStatus | 'all'>('pending');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyBox, setOpenReplyBox] = useState<Record<string, boolean>>({});
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?status=${activeTab}`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load reviews for moderation:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (reviewId: string, action: 'approve' | 'reject' | 'flag' | 'delete') => {
    setActingOn(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Action failed');
      }
    } catch (err) {
      console.error('Moderation action failed:', err);
    } finally {
      setActingOn(null);
      await load();
    }
  };

  const handleReplySubmit = async (reviewId: string) => {
    const text = replyDrafts[reviewId]?.trim();
    if (!text) return;

    setActingOn(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action: 'reply', replyText: text }),
      });
      if (res.ok) {
        setOpenReplyBox((prev) => ({ ...prev, [reviewId]: false }));
        await load();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'Failed to submit official reply');
      }
    } catch (err) {
      console.error('Reply submit failed:', err);
    } finally {
      setActingOn(null);
    }
  };

  return (
    <section className={styles.sectionRoot}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Customer Review Moderation</h2>
          <p className={styles.subtitle}>
            Approve, reject, flag, or publish official staff responses to verified customer feedback.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        {(['pending', 'approved', 'flagged', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}{' '}
            {activeTab === tab && !loading ? `(${reviews.length})` : ''}
          </button>
        ))}
      </div>

      {/* Queue List */}
      {loading ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <span>Loading moderation queue…</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.emptyBox}>
          <p>No reviews found in the <strong>{activeTab}</strong> queue.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {reviews.map((rev) => (
            <div key={rev.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.metaCol}>
                  <div className={styles.customerNameRow}>
                    <span className={styles.customerName}>{rev.userName || 'Anonymous'}</span>
                    {rev.userEmailMasked && (
                      <span className={styles.customerEmail}>({rev.userEmailMasked})</span>
                    )}
                    {rev.verifiedPurchase && (
                      <span className={styles.verifiedPill}>✓ VERIFIED PURCHASE</span>
                    )}
                    <span className={`${styles.statusBadge} ${styles[`status_${rev.status}`]}`}>
                      {(rev.status || 'pending').toUpperCase()}
                    </span>
                  </div>

                  <div className={styles.productOrderRow}>
                    {rev.productTitle && (
                      <span className={styles.productTag}>Product: {rev.productTitle}</span>
                    )}
                    {rev.orderId && (
                      <span className={styles.orderTag}>Order #{rev.orderId.slice(0, 8)}</span>
                    )}
                    <span className={styles.dateTag}>
                      {new Date(rev.createdAt).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <RatingStars rating={rev.rating} size="sm" />
              </div>

              {/* Review Text */}
              {rev.title && <h4 className={styles.reviewHeadline}>{rev.title}</h4>}
              <p className={styles.reviewBody}>{rev.text}</p>

              {/* Sizing & Fit */}
              {rev.fit && (
                <div className={styles.fitInfo}>
                  <strong>Fit:</strong>{' '}
                  {rev.fit === 'true_to_size'
                    ? 'True to Size'
                    : rev.fit === 'runs_small'
                    ? 'Runs Small'
                    : 'Runs Large (Oversized)'}
                </div>
              )}

              {/* Media Previews */}
              {rev.media && rev.media.length > 0 && (
                <div className={styles.mediaRow}>
                  {rev.media.map((m, mIdx) => (
                    <div
                      key={mIdx}
                      className={styles.mediaThumb}
                      onClick={() => setPreviewMedia(JSON.stringify({ url: m.url, type: m.type }))}
                      title="Click to preview full size"
                    >
                      {m.type === 'video' ? (
                        m.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={m.thumbnailUrl} alt="Customer video preview" className={styles.thumbMedia} />
                        ) : (
                          <video
                            src={normalizeMediaUrl(m.url)}
                            className={styles.thumbMedia}
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
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={normalizeMediaUrl(m.url)} alt="Customer upload" className={styles.thumbMedia} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Official Reply */}
              {rev.officialReply && (
                <div className={styles.existingReply}>
                  <div className={styles.replyHeader}>
                    <strong>GERKINK Staff Response:</strong>
                    <span>{new Date(rev.officialReply.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className={styles.replyText}>{rev.officialReply.text}</p>
                </div>
              )}

              {/* Reply Box Composer */}
              {openReplyBox[rev.id] && (
                <div className={styles.replyComposer}>
                  <textarea
                    className={styles.replyInput}
                    placeholder="Write an official GERKINK reply (visible on product page)..."
                    rows={3}
                    value={replyDrafts[rev.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                  />
                  <div className={styles.replyActions}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setOpenReplyBox((prev) => ({ ...prev, [rev.id]: false }))}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleReplySubmit(rev.id)}
                      disabled={actingOn === rev.id}
                    >
                      Publish Official Reply
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Bar */}
              <div className={styles.cardActions}>
                <div className={styles.mainActions}>
                  {rev.status !== 'approved' && (
                    <button
                      type="button"
                      className={styles.btnApprove}
                      disabled={actingOn === rev.id}
                      onClick={() => handleAction(rev.id, 'approve')}
                    >
                      ✓ Approve
                    </button>
                  )}

                  {rev.status !== 'rejected' && (
                    <button
                      type="button"
                      className={styles.btnReject}
                      disabled={actingOn === rev.id}
                      onClick={() => handleAction(rev.id, 'reject')}
                    >
                      ✕ Reject
                    </button>
                  )}

                  {rev.status !== 'flagged' && (
                    <button
                      type="button"
                      className={styles.btnFlag}
                      disabled={actingOn === rev.id}
                      onClick={() => handleAction(rev.id, 'flag')}
                    >
                      ⚑ Flag
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.btnReply}
                    onClick={() => setOpenReplyBox((prev) => ({ ...prev, [rev.id]: !prev[rev.id] }))}
                  >
                    💬 {rev.officialReply ? 'Edit Reply' : 'Add Reply'}
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.btnDelete}
                  disabled={actingOn === rev.id}
                  onClick={() => {
                    if (confirm('Permanently delete this review?')) {
                      handleAction(rev.id, 'delete');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Fullscreen Preview */}
      {previewMedia && (() => {
        let mediaUrl = previewMedia;
        let mediaType = 'image';
        try {
          const parsed = JSON.parse(previewMedia);
          mediaUrl = parsed.url || previewMedia;
          mediaType = parsed.type || 'image';
        } catch {
          // Legacy: plain URL string
          if (previewMedia.endsWith('.mp4') || previewMedia.endsWith('.webm') || previewMedia.endsWith('.mov') || previewMedia.startsWith('data:video') || previewMedia.includes('type=video')) {
            mediaType = 'video';
          }
        }
        const normalizedUrl = normalizeMediaUrl(mediaUrl);
        return (
          <div className={styles.lightbox} onClick={() => setPreviewMedia(null)}>
            <div className={styles.lightboxFrame} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.lightboxClose} onClick={() => setPreviewMedia(null)}>
                ✕
              </button>
              {mediaType === 'video' ? (
                <video src={normalizedUrl} controls autoPlay playsInline className={styles.previewImage} />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={normalizedUrl} alt="Media Preview" className={styles.previewImage} />
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
