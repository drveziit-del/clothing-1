'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Subscribe to reviews collection (real-time)
  useEffect(() => {
    const { collection, query, orderBy, onSnapshot } = getFirestoreModule();
    const db = getFirestoreDb();

    const q = query(
      collection(db, 'reviews'),
      orderBy('createdAt', 'desc')
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
      setReviews(items);
    }, (err: any) => {
      console.warn('Reviews snapshot error:', err);
    });

    return () => unsub();
  }, []);

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
    if (!firebaseUser || !formText.trim()) return;
    setSubmitting(true);

    try {
      const { doc, collection, addDoc, updateDoc, serverTimestamp } = getFirestoreModule();
      const db = getFirestoreDb();

      if (editingReview) {
        // Update existing review
        await updateDoc(doc(db, 'reviews', editingReview.id), {
          rating: formRating,
          text: formText.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new review
        await addDoc(collection(db, 'reviews'), {
          userId: firebaseUser.uid,
          userName: user?.displayName || firebaseUser.displayName || 'Anonymous',
          userPhoto: firebaseUser.photoURL || null,
          rating: formRating,
          text: formText.trim(),
          createdAt: serverTimestamp(),
        });
      }

      closeForm();
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      const { doc, deleteDoc } = getFirestoreModule();
      const db = getFirestoreDb();
      await deleteDoc(doc(db, 'reviews', reviewId));
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  // Check if current user already has a review
  const userReview = firebaseUser
    ? reviews.find((r) => r.userId === firebaseUser.uid)
    : null;

  const canWriteReview = firebaseUser && !userReview;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
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
          {(canWriteReview || isAdmin) && (
            <button
              className={`btn btn-primary btn-sm ${styles.writeBtn}`}
              onClick={openAddForm}
            >
              Write a Review
            </button>
          )}
        </div>

        {/* Reviews Grid */}
        {reviews.length === 0 ? (
          <div className={styles.empty}>
            No reviews yet. Be the first to say something we can&apos;t delete.
          </div>
        ) : (
          <div className={styles.grid}>
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
