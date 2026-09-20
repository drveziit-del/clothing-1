'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRoast } from '@/hooks/useRoast';
import { formatPlanLabel, type CustomDesignRequest, type CustomDesignStatus } from '@/lib/custom-design/types';
import { getAvailableAdminTransitions } from '@/lib/custom-design/stateMachine';
import styles from './admin-detail.module.css';

export default function AdminCustomDesignDetailClient({ requestId }: { requestId: string }) {
  const { toast } = useRoast();
  const [requestData, setRequestData] = useState<CustomDesignRequest | null>(null);
  const [loading, setLoading] = useState(true);

  // Transition form state
  const [selectedStatus, setSelectedStatus] = useState<CustomDesignStatus | ''>('');
  const [transitionReason, setTransitionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [finalPriceInput, setFinalPriceInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Messaging state
  const [adminMsgText, setAdminMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/custom-design/${requestId}`);
      const data = await res.json();
      if (res.ok && data.request) {
        setRequestData(data.request);
        setAdminNotes(data.request.adminNotes || '');
        if (typeof data.request.finalPrice === 'number') {
          setFinalPriceInput(String(data.request.finalPrice));
        }
      }
    } catch (err) {
      console.error('Failed to load request details:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const availableTransitions = requestData ? getAvailableAdminTransitions(requestData.status) : [];

  const handleApplyTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus || !requestData) return;

    setIsUpdating(true);
    try {
      const payload: any = {
        status: selectedStatus,
        reason: transitionReason.trim() || undefined,
        adminNotes: typeof adminNotes === 'string' ? adminNotes.trim() : undefined,
      };

      if (finalPriceInput.trim()) {
        const parsedPrice = parseFloat(finalPriceInput);
        if (!isNaN(parsedPrice)) payload.finalPrice = parsedPrice;
      }

      const res = await fetch(`/api/admin/custom-designs/${requestId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      toast(`Status transitioned to ${selectedStatus}`, 'success');
      setSelectedStatus('');
      setTransitionReason('');
      fetchDetails();
    } catch (err: any) {
      toast(err?.message || 'Update failed', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMsgText.trim()) return;

    setSendingMsg(true);
    try {
      const res = await fetch(`/api/custom-design/${requestId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: adminMsgText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      toast('Message dispatched to customer', 'success');
      setAdminMsgText('');
      fetchDetails();
    } catch (err: any) {
      toast(err?.message || 'Failed to send message', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Loading custom request details...</p>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className={styles.page} style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Request Not Found</h2>
        <Link href="/admin/custom-designs" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          ← Back to Custom Designs
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin">Admin</Link>
        <span>→</span>
        <Link href="/admin/custom-designs">Custom Designs</Link>
        <span>→</span>
        <span style={{ color: '#fff' }}>#{requestData.requestId}</span>
      </nav>

      {/* Header Card */}
      <div className={styles.headerCard}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            GERKINK Atelier Record
          </span>
          <h1 className={styles.title}>CUSTOM REQUEST #{requestData.requestId}</h1>
          <div className={styles.metaRow}>
            <span>Customer: <strong>{requestData.customerName} ({requestData.customerEmail})</strong></span>
            <span>Garment: <strong>{requestData.productType}</strong></span>
            <span>Created: <strong>{new Date(requestData.createdAt as string).toLocaleString()}</strong></span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>
            Current Status
          </span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent)' }}>
            {requestData.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          {/* Concept Description */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Idea &amp; Creative Concept</h2>
            <div className={styles.descriptionBox}>
              {requestData.description}
            </div>
            {requestData.additionalNotes && (
              <div style={{ marginTop: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Customer Additional Notes:
                </span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', marginTop: '0.25rem' }}>
                  {requestData.additionalNotes}
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Artwork */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Uploaded Files ({requestData.uploads?.length || 0})</h2>
            <div className={styles.fileList}>
              {requestData.uploads?.map((file) => (
                <div key={file.fileId} className={styles.fileItem}>
                  <div>
                    <span style={{ fontWeight: 600, display: 'block' }}>{file.originalName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {file.mimeType}
                    </span>
                  </div>
                  <a
                    href={`/api/custom-design/media?path=${encodeURIComponent(file.storagePath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.fileLink}
                  >
                    Open / Download ↗
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Chat & In-App Messages */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Customer Dialogue</h2>
            <div className={styles.chatList}>
              {(!requestData.customerMessages || requestData.customerMessages.length === 0) ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No dialogue history yet.</p>
              ) : (
                requestData.customerMessages.map((msg) => {
                  const isCust = msg.sender === 'customer';
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.chatBubble} ${isCust ? styles.chatCustomer : styles.chatAdmin}`}
                    >
                      <div className={styles.chatHeader}>
                        <strong>{msg.senderName}</strong>
                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                      </div>
                      <div>{msg.message}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Admin Message Form */}
            <form onSubmit={handleSendAdminMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <textarea
                className={styles.textarea}
                placeholder="Send a message, feedback, or inquiry to the customer..."
                value={adminMsgText}
                onChange={(e) => setAdminMsgText(e.target.value)}
                rows={3}
              />
              <button
                type="submit"
                disabled={sendingMsg || !adminMsgText.trim()}
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-end' }}
              >
                {sendingMsg ? 'Dispatching...' : 'Send Message to Customer →'}
              </button>
            </form>
          </div>
        </div>

        <div>
          {/* Admin State Machine Actions */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>State Machine Control</h2>
            <form onSubmit={handleApplyTransition} className={styles.actionForm}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Next Allowed Transition
                </label>
                {availableTransitions.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Terminal state reached ({requestData.status}).</p>
                ) : (
                  <select
                    className={styles.select}
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as CustomDesignStatus)}
                  >
                    <option value="">Select state transition...</option>
                    {availableTransitions.map((st) => (
                      <option key={st} value={st}>
                        → {st.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Transition Reason / Note
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Studio proof approved by creative lead"
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Final Product Price (Optional USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={styles.input}
                  placeholder="e.g. 85.00"
                  value={finalPriceInput}
                  onChange={(e) => setFinalPriceInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Internal Studio Notes
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder="Internal notes (not visible to customer)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={isUpdating || !selectedStatus}
                className={styles.applyBtn}
              >
                {isUpdating ? 'Executing Transition...' : 'Execute Transition →'}
              </button>
            </form>
          </div>

          {/* Payment & Audit Verification */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Payment &amp; Policy Audit</h2>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Prepayment Plan</span>
              <span className={styles.fieldValue} style={{ textTransform: 'uppercase' }}>{formatPlanLabel(requestData.plan)}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Prepayment Amount</span>
              <span className={styles.fieldValue} style={{ color: '#2ed573' }}>${requestData.prepaymentAmount} USD</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Payment Provider</span>
              <span className={styles.fieldValue}>{requestData.paymentProvider.toUpperCase()}</span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Payment Status</span>
              <span className={styles.fieldValue} style={{ color: requestData.paymentStatus === 'paid' ? '#2ed573' : '#eab308' }}>
                {requestData.paymentStatus.toUpperCase()}
              </span>
            </div>
            {requestData.paymentReference && (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Capture ID</span>
                <span className={styles.fieldValue} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {requestData.paymentReference}
                </span>
              </div>
            )}
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Policy Version</span>
              <span className={styles.fieldValue} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {requestData.paymentPolicyVersion}
              </span>
            </div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Non-Refundable Agreed</span>
              <span className={styles.fieldValue} style={{ color: requestData.paymentPolicyAccepted ? '#2ed573' : '#ff6b6b' }}>
                {requestData.paymentPolicyAccepted ? 'YES (MANDATORY ✓)' : 'NO'}
              </span>
            </div>
          </div>

          {/* Full Audit History */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Audit &amp; Transition History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {requestData.statusHistory?.map((h, i) => (
                <div key={i} style={{ fontSize: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>{h.from} → <strong style={{ color: '#fff' }}>{h.to}</strong></span>
                    <span style={{ textTransform: 'uppercase' }}>[{h.actor}]</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </div>
                  {h.reason && <div style={{ color: '#9ca3af', marginTop: '2px' }}>{h.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
