'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import type { Review } from '@/types';
import styles from './ReviewsSection.module.css';

export default function ReviewsSection() {
  const { firebaseUser, user, isAdmin } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formText, setFormText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const fetchApiReviews = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setReviews(data);
        }
      }
    } catch (err) {
      console.warn('API reviews fetch error:', err);
    }
  }, []);

  // Fetch reviews from API and subscribe to real-time updates
  useEffect(() => {
    fetchApiReviews();

    const { collection, query, orderBy, onSnapshot, getDocs } = getFirestoreModule();
    const db = getFirestoreDb();

    const q = query(
      collection(db, 'reviews')
    );

    const unsub = onSnapshot(q, (snap: any) => {
      const items: Review[] = snap.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? undefined,
        } as Review;
      });

      // Sort client-side to prevent missing/null serverTimestamp index drops
      items.sort((a: any, b: any) => {
        const tA = new Date(a.createdAt).getTime() || 0;
        const tB = new Date(b.createdAt).getTime() || 0;
        return tB - tA;
      });

      if (items.length > 0) {
        setReviews(items);
      }
    }, async (_err: any) => {
      fetchApiReviews();
    });

    return () => unsub();
  }, [fetchApiReviews]);

  const openAddForm = useCallback(() => {
    setEditingReview(null);
    setFormRating(5);
    setFormText('');
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((review: Review) => {
    setEditingReview(review);
    setFormRating(review.rating);
    setFormText(review.text);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingReview(null);
  }, []);

  const handleSubmit = async () => {
    if (!formText.trim()) return;
    setSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewId: editingReview ? editingReview.id : undefined,
          rating: formRating,
          text: formText.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit review');
      }

      closeForm();
      fetchApiReviews();
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert(err.message || 'Failed to submit review. Please ensure you are logged in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      const headers: Record<string, string> = {};
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch(`/api/reviews?id=${reviewId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete review');
      }
      fetchApiReviews();
    } catch (err: any) {
      console.error('Error deleting review:', err);
      alert(err.message || 'Failed to delete review');
    }
  };

  // Check if current user already has a review
  const userReview = firebaseUser
    ? reviews.find((r) => r.userId === firebaseUser.uid)
    : null;

  const canWriteReview = firebaseUser && !userReview;

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>What They Say</h2>
            <p className={styles.subtitle}>
              Real people. Real opinions. We didn&apos;t pay them — they just have taste.
            </p>
          </div>
          
          <div className={styles.headerRight}>
            {reviews.length > 0 && (
              <div className={styles.navControls}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => scroll('left')}
                  aria-label="Scroll left"
                >
                  ←
                </button>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => scroll('right')}
                  aria-label="Scroll right"
                >
                  →
                </button>
              </div>
            )}
            {(canWriteReview || isAdmin) && (
              <button
                className={`btn btn-primary btn-sm ${styles.writeBtn}`}
                onClick={openAddForm}
              >
                Write a Review
              </button>
            )}
          </div>
        </div>

        {/* Reviews Grid */}
        {reviews.length === 0 ? (
          <div className={styles.empty}>
            No reviews yet. Be the first to say something we can&apos;t delete.
          </div>
        ) : (
          <div className={styles.grid} ref={scrollRef}>
            {reviews.map((review) => (
              <div key={review.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {review.userPhoto ? (
                      <img src={review.userPhoto} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      review.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardName}>{review.userName}</span>
                    <span className={styles.cardDate}>{formatDate(review.createdAt)}</span>
                  </div>
                  <div className={styles.stars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={`${styles.star} ${s <= review.rating ? styles.starFilled : ''}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                <p className={styles.cardText}>{review.text}</p>

                {/* Actions — user can edit their own, admin can edit/delete any */}
                {(firebaseUser?.uid === review.userId || isAdmin) && (
                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => openEditForm(review)}
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDelete(review.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────── */}
      {showForm && (
        <div className={styles.overlay} onClick={closeForm}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {editingReview ? 'Edit Your Review' : 'Share Your Experience'}
            </h3>

            <div className={styles.formGroup}>
              <label className="input-label">Rating</label>
              <div className={styles.starsInput}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.starBtn} ${s <= formRating ? styles.starBtnFilled : ''}`}
                    onClick={() => setFormRating(s)}
                    aria-label={`${s} star${s > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className="input-label">Your Review</label>
              <textarea
                className={styles.textarea}
                value={formText}
                onChange={(e) => setFormText(e.target.value.slice(0, 500))}
                placeholder="Tell us what you really think — we can take it."
                maxLength={500}
              />
              <span className={styles.charCount}>{formText.length}/500</span>
            </div>

            <div className={styles.modalActions}>
              <button className="btn btn-secondary btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={submitting || !formText.trim()}
              >
                {submitting ? 'Posting...' : editingReview ? 'Save Changes' : 'Post Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
