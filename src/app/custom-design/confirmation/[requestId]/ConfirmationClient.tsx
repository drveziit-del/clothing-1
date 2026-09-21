'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatPlanLabel, type CustomDesignRequest } from '@/lib/custom-design/types';
import styles from './confirmation.module.css';

export default function ConfirmationClient({ requestId }: { requestId: string }) {
  const [requestData, setRequestData] = useState<CustomDesignRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/custom-design/${requestId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load request');
        }
        setRequestData(data.request);
      } catch (err: any) {
        setError(err?.message || 'Error loading request');
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [requestId]);

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container} style={{ textAlign: 'center' }}>
          <p>Loading request details...</p>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container} style={{ textAlign: 'center' }}>
          <h2>Request Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>{error || 'Unable to locate custom request.'}</p>
          <Link href="/custom-design" className="btn btn-secondary">Back to Custom Design</Link>
        </div>
      </div>
    );
  }

  const isPaid = requestData.paymentStatus === 'paid' || (requestData.status !== 'PAYMENT_PENDING' && requestData.status !== 'CANCELLED' && requestData.status !== 'PAYMENT_FAILED');
  const isReviewRequired = requestData.paymentStatus === 'review_required' || requestData.status === 'MANUAL_REVIEW';
  const isFailed = requestData.paymentStatus === 'failed' || requestData.status === 'PAYMENT_FAILED';

  const formattedAmount = requestData.currency === 'INR'
    ? `₹${requestData.prepaymentAmount} INR`
    : `$${requestData.prepaymentAmount} USD`;

  const paymentDisplay = isPaid
    ? `${formattedAmount} PAID ✓`
    : isReviewRequired
    ? `${formattedAmount} — REVIEW REQUIRED ⚠️`
    : isFailed
    ? 'PAYMENT FAILED ✗'
    : 'PAYMENT PENDING';

  const paymentColor = isPaid
    ? '#2ed573'
    : isReviewRequired
    ? '#ffab00'
    : isFailed
    ? '#ff4757'
    : '#9ca3af';

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          {isPaid ? (
            <div className={styles.paymentConfirmedPill}>PAYMENT CONFIRMED ✓</div>
          ) : isReviewRequired ? (
            <div className={styles.paymentConfirmedPill} style={{ color: '#ffab00', background: 'rgba(255, 171, 0, 0.1)', borderColor: 'rgba(255, 171, 0, 0.3)' }}>
              PAYMENT UNDER REVIEW ⚠️
            </div>
          ) : isFailed ? (
            <div className={styles.paymentConfirmedPill} style={{ color: '#ff4757', background: 'rgba(255, 71, 87, 0.1)', borderColor: 'rgba(255, 71, 87, 0.3)' }}>
              PAYMENT FAILED ✗
            </div>
          ) : (
            <div className={styles.paymentConfirmedPill} style={{ color: '#9ca3af', background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              PAYMENT PENDING
            </div>
          )}
          <div className={styles.requestNumberBadge}>
            {requestData.requestId}
          </div>
          <h1 className={styles.title}>YOUR REQUEST IS IN.</h1>
          <p className={styles.studioNotice}>
            {isPaid
              ? 'A GERKINK team member will review your request and discuss the design and production requirements with you.'
              : isReviewRequired
              ? 'Your payment was received but is currently under manual studio verification. Our team will verify and begin review shortly.'
              : isFailed
              ? 'Your prepayment could not be captured. Please retry payment or contact GERKINK studio support.'
              : 'Your custom request has been initiated. Prepayment is required before our team begins studio design review.'}
          </p>
        </div>

        {/* Summary Card */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Customer Account</span>
            <span className={styles.summaryVal}>{requestData.customerEmail}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Garment Silhouette</span>
            <span className={styles.summaryVal}>{requestData.productType}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Prepayment Level</span>
            <span className={styles.summaryVal}>{formatPlanLabel(requestData.plan)} ({formattedAmount})</span>
          </div>
          {requestData.paymentProvider && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Payment Gateway</span>
              <span className={styles.summaryVal} style={{ textTransform: 'uppercase' }}>
                {requestData.paymentProvider}
              </span>
            </div>
          )}
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Prepayment Status</span>
            <span className={styles.paidBadge} style={{ color: paymentColor }}>{paymentDisplay}</span>
          </div>
          {requestData.paymentReference && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Transaction Reference</span>
              <span className={styles.summaryVal} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {requestData.paymentReference}
              </span>
            </div>
          )}
        </div>

        {/* 8-Stage Status Timeline */}
        <div className={styles.timeline}>
          <div className={`${styles.timelineItem} ${styles.timelineItemCompleted}`}>
            <span className={styles.timelineIcon} style={{ color: '#2ed573' }}>●</span>
            <span className={styles.timelineText}>REQUEST RECEIVED</span>
          </div>
          <div className={`${styles.timelineItem} ${isPaid ? styles.timelineItemCompleted : isReviewRequired ? styles.timelineItemActive : ''}`}>
            <span className={styles.timelineIcon} style={{ color: paymentColor }}>
              {isPaid ? '●' : isFailed ? '✗' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: isPaid ? undefined : paymentColor }}>
              {isPaid ? 'PREPAYMENT CONFIRMED' : isReviewRequired ? 'PREPAYMENT UNDER REVIEW' : isFailed ? 'PREPAYMENT FAILED' : 'PREPAYMENT PENDING'}
            </span>
          </div>
          <div className={`${styles.timelineItem} ${isPaid && (requestData.status === 'SUBMITTED' || requestData.status === 'UNDER_REVIEW') ? styles.timelineItemActive : ''}`}>
            <span className={styles.timelineIcon} style={{ color: isPaid && (requestData.status === 'SUBMITTED' || requestData.status === 'UNDER_REVIEW') ? 'var(--accent, #ff6b6b)' : '#6b7280' }}>
              {requestData.status === 'UNDER_REVIEW' || requestData.status === 'SUBMITTED' ? '○' : ['DESIGN_IN_PROGRESS', 'APPROVED', 'FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: isPaid && (requestData.status === 'SUBMITTED' || requestData.status === 'UNDER_REVIEW') ? 'var(--accent, #ff6b6b)' : ['DESIGN_IN_PROGRESS', 'APPROVED', 'FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              GERKINK REVIEW
            </span>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineIcon} style={{ color: requestData.status === 'DESIGN_IN_PROGRESS' ? 'var(--accent, #ff6b6b)' : ['APPROVED', 'FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              {['APPROVED', 'FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: requestData.status === 'DESIGN_IN_PROGRESS' ? 'var(--accent, #ff6b6b)' : ['APPROVED', 'FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              DESIGN DISCUSSION
            </span>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineIcon} style={{ color: requestData.status === 'APPROVED' ? 'var(--accent, #ff6b6b)' : ['FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              {['FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: requestData.status === 'APPROVED' ? 'var(--accent, #ff6b6b)' : ['FINAL_PAYMENT_PENDING', 'IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              DESIGN APPROVAL
            </span>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineIcon} style={{ color: requestData.status === 'FINAL_PAYMENT_PENDING' ? 'var(--accent, #ff6b6b)' : ['IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              {['IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: requestData.status === 'FINAL_PAYMENT_PENDING' ? 'var(--accent, #ff6b6b)' : ['IN_PRODUCTION', 'FULFILLED'].includes(requestData.status) ? '#2ed573' : '#6b7280' }}>
              FINAL PAYMENT
            </span>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineIcon} style={{ color: requestData.status === 'IN_PRODUCTION' ? 'var(--accent, #ff6b6b)' : requestData.status === 'FULFILLED' ? '#2ed573' : '#6b7280' }}>
              {requestData.status === 'FULFILLED' ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: requestData.status === 'IN_PRODUCTION' ? 'var(--accent, #ff6b6b)' : requestData.status === 'FULFILLED' ? '#2ed573' : '#6b7280' }}>
              PRODUCTION
            </span>
          </div>
          <div className={styles.timelineItem}>
            <span className={styles.timelineIcon} style={{ color: requestData.status === 'FULFILLED' ? '#2ed573' : '#6b7280' }}>
              {requestData.status === 'FULFILLED' ? '●' : '○'}
            </span>
            <span className={styles.timelineText} style={{ color: requestData.status === 'FULFILLED' ? '#2ed573' : '#6b7280' }}>
              FULFILLED
            </span>
          </div>
        </div>

        {/* Action Links */}
        <div className={styles.actions}>
          <Link href={`/account/custom-design/${requestData.id}`} className={styles.viewRequestBtn}>
            VIEW MY REQUEST →
          </Link>
          <Link href="/" className={styles.homeLink}>
            Return to GERKINK Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
