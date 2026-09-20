'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRoast } from '@/hooks/useRoast';
import { formatPlanLabel, type CustomDesignRequest } from '@/lib/custom-design/types';
import styles from './account-custom-design.module.css';

export default function AccountCustomDesignClient({ requestId }: { requestId: string }) {
  const { toast } = useRoast();

  const [requestData, setRequestData] = useState<CustomDesignRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat message state
  const [replyText, setReplyText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [approving, setApproving] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/custom-design/${requestId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load request');
      setRequestData(data.request);
    } catch (err: any) {
      setError(err?.message || 'Error loading request');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSendingMsg(true);
    try {
      const res = await fetch(`/api/custom-design/${requestId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      toast('Message sent to GERKINK studio', 'success');
      setReplyText('');
      fetchDetails();
    } catch (err: any) {
      toast(err?.message || 'Failed to send message', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleApproveDesign = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/custom-design/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve design');

      toast('Design approved! Moving to final processing.', 'success');
      fetchDetails();
    } catch (err: any) {
      toast(err?.message || 'Failed to approve design', 'error');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p>Loading custom request matrix...</p>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2>Request Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>{error || 'Unable to locate custom request.'}</p>
          <Link href="/account" className="btn btn-secondary">Return to Account</Link>
        </div>
      </div>
    );
  }

  const isNeedsInfo = requestData.status === 'NEEDS_INFORMATION';
  const isApprovalReq = requestData.status === 'CUSTOMER_APPROVAL_REQUIRED' || requestData.status === 'DESIGN_READY';
  const isApproved = requestData.status === 'APPROVED' || requestData.status === 'READY_FOR_PRODUCTION' || requestData.status === 'IN_PRODUCTION';

  // Finding 4.4: Derive display from requestData.paymentStatus and status, never hardcode "PAID"
  const getPaymentStatusDisplay = () => {
    if (requestData.paymentStatus === 'paid' || requestData.status === 'SUBMITTED' || isApproved || requestData.status === 'UNDER_REVIEW') {
      return { text: `$${requestData.prepaymentAmount} USD PAID ✓`, color: '#2ed573' };
    }
    if (requestData.paymentStatus === 'review_required' || requestData.status === 'MANUAL_REVIEW') {
      return { text: 'REVIEW REQUIRED ⚠️', color: '#ffa502' };
    }
    if (requestData.paymentStatus === 'failed' || requestData.status === 'PAYMENT_FAILED') {
      return { text: 'PAYMENT FAILED ✗', color: '#ff4757' };
    }
    return { text: 'PAYMENT PENDING', color: 'var(--text-secondary)' };
  };
  const paymentDisplay = getPaymentStatusDisplay();

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/account">Account</Link>
          <span>→</span>
          <Link href="/account?tab=custom_designs">Custom Requests</Link>
          <span>→</span>
          <span style={{ color: '#fff' }}>#{requestData.requestId}</span>
        </nav>

        {/* ─── Header Card ──────────────────────────────── */}
        <div className={styles.headerCard}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.requestTitle}>CUSTOM {requestData.productType.toUpperCase()}</h1>
              <span className={styles.requestMeta}>
                Request #{requestData.requestId} · Submitted {new Date(requestData.createdAt as string).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span
                className={`${styles.statusPill} ${
                  isNeedsInfo ? styles.statusPillNeedsInfo : isApproved ? styles.statusPillApproved : ''
                }`}
              >
                {requestData.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>
                Prepayment Level
              </span>
              <span style={{ fontWeight: 700 }}>
                {formatPlanLabel(requestData.plan)} (${requestData.prepaymentAmount})
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>
                Prepayment Status
              </span>
              <span style={{ fontWeight: 700, color: paymentDisplay.color }}>
                {paymentDisplay.text}
              </span>
            </div>
            {requestData.paymentReference && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>
                  Capture Reference
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {requestData.paymentReference}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Contextual Banners ───────────────────────── */}
        {isNeedsInfo && (
          <div className={styles.alertBanner}>
            <div className={styles.alertTitle}>⚠️ WE NEED SOMETHING FROM YOU</div>
            <p className={styles.alertText}>
              The GERKINK atelier team has reviewed your concept and requested clarification. Please review the studio message below and reply to resume preparation.
            </p>
          </div>
        )}

        {isApprovalReq && (
          <div className={styles.approvalBanner}>
            <div className={styles.approvalTitle}>✦ YOUR DESIGN PROOF IS READY FOR APPROVAL</div>
            <p style={{ fontSize: '0.9rem', color: '#d1d5db', lineHeight: 1.5 }}>
              Our designers have completed the preparation of your custom piece. Please review the studio specifications and confirm your approval below.
            </p>
            {typeof requestData.finalPrice === 'number' && requestData.finalPrice > 0 && (
              <div className={styles.priceCreditBox}>
                <div className={styles.priceCreditRow}>
                  <span>Final agreed production price</span>
                  <span style={{ fontWeight: 700 }}>${requestData.finalPrice} USD</span>
                </div>
                <div className={styles.priceCreditRow}>
                  <span>Custom Design prepayment</span>
                  <span style={{ color: '#2ed573', fontWeight: 700 }}>-${requestData.prepaymentAmount} USD</span>
                </div>
                <div className={`${styles.priceCreditRow} ${styles.priceCreditTotal}`}>
                  <span>Remaining balance</span>
                  <span style={{ fontWeight: 900 }}>${Math.max(0, requestData.finalPrice - requestData.prepaymentAmount)} USD</span>
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={approving}
              onClick={handleApproveDesign}
              className={styles.approveBtn}
            >
              {approving ? 'Registering Approval...' : 'APPROVE DESIGN & PROCEED →'}
            </button>
          </div>
        )}

        {requestData.status === 'FINAL_PAYMENT_PENDING' && (
          <div className={styles.finalPaymentBanner}>
            <div className={styles.finalPaymentTitle}>💳 FINAL PAYMENT PENDING</div>
            <p style={{ fontSize: '0.9rem', color: '#d1d5db', lineHeight: 1.5, margin: '0.5rem 0' }}>
              Design approved. Your custom piece is ready to enter production once the remaining balance is cleared.
            </p>
            {typeof requestData.finalPrice === 'number' && (
              <div className={styles.priceCreditBox}>
                <div className={styles.priceCreditRow}>
                  <span>Final agreed production price</span>
                  <span style={{ fontWeight: 700 }}>${requestData.finalPrice} USD</span>
                </div>
                <div className={styles.priceCreditRow}>
                  <span>Custom Design prepayment</span>
                  <span style={{ color: '#2ed573', fontWeight: 700 }}>-${requestData.prepaymentAmount} USD</span>
                </div>
                <div className={`${styles.priceCreditRow} ${styles.priceCreditTotal}`}>
                  <span>Remaining balance</span>
                  <span style={{ fontWeight: 900 }}>${Math.max(0, requestData.finalPrice - requestData.prepaymentAmount)} USD</span>
                </div>
              </div>
            )}
            <div className={styles.awaitingInstructions}>
              <span className={styles.instructionsDot}>●</span>
              <span>
                <strong>Awaiting GERKINK payment instructions.</strong> Our team will contact you or update this portal with direct invoice/settlement instructions before garments enter the print queue.
              </span>
            </div>
          </div>
        )}

        {/* ─── Detail Grid ──────────────────────────────── */}
        <div className={styles.detailGrid}>
          <div>
            {/* Concept & Description */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Your Concept Description</h2>
              <div className={styles.descriptionBox}>
                {requestData.description}
              </div>

              {requestData.additionalNotes && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Additional Notes:
                  </span>
                  <p style={{ fontSize: '0.9rem', color: '#d1d5db', marginTop: '0.25rem' }}>
                    {requestData.additionalNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Studio Communication & Messages */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Studio Communication</h2>

              <div className={styles.chatBox}>
                {(!requestData.customerMessages || requestData.customerMessages.length === 0) ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No messages yet. When the studio reviews your concept or has questions, messages will appear here.
                  </p>
                ) : (
                  requestData.customerMessages.map((msg) => {
                    const isCust = msg.sender === 'customer';
                    return (
                      <div
                        key={msg.id}
                        className={`${styles.message} ${isCust ? styles.messageCustomer : styles.messageAdmin}`}
                      >
                        <div className={styles.messageHeader}>
                          <span className={styles.messageSender}>{msg.senderName}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={styles.messageBody}>{msg.message}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendMessage} className={styles.replyForm}>
                <textarea
                  className={styles.replyTextarea}
                  placeholder={isNeedsInfo ? 'Provide the requested details to the studio team...' : 'Send a message or note to the studio team...'}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !replyText.trim()}
                  className={styles.sendBtn}
                >
                  {sendingMsg ? 'Sending...' : 'Send Message →'}
                </button>
              </form>
            </div>
          </div>

          <div>
            {/* Garment Specifications */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Specifications</h2>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Product</span>
                <span className={styles.specVal}>{requestData.productType}</span>
              </div>
              {requestData.preferredSize && (
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Size</span>
                  <span className={styles.specVal}>{requestData.preferredSize}</span>
                </div>
              )}
              {requestData.preferredColor && (
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Color</span>
                  <span className={styles.specVal}>{requestData.preferredColor}</span>
                </div>
              )}
              {requestData.productPreference && (
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Fit Preference</span>
                  <span className={styles.specVal}>{requestData.productPreference}</span>
                </div>
              )}
            </div>

            {/* Uploaded Artwork */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Uploaded Files ({requestData.uploads?.length || 0})</h2>
              <div className={styles.fileList}>
                {requestData.uploads?.map((file) => (
                  <div key={file.fileId} className={styles.fileItem}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      <span style={{ fontWeight: 600, display: 'block' }}>{file.originalName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <a
                      href={`/api/custom-design/media?path=${encodeURIComponent(file.storagePath)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fileLink}
                    >
                      View / Download ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Status History */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Lifecycle History</h2>
              <div className={styles.historyList}>
                {requestData.statusHistory?.map((h, i) => (
                  <div key={i} className={styles.historyItem}>
                    <div>
                      <span className={styles.historyTime}>
                        {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <strong style={{ color: '#fff' }}>{h.to}</strong>
                    </div>
                    {h.reason && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                        {h.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
