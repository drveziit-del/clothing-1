'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoast } from '@/hooks/useRoast';

interface WireApprovalActionsProps {
  orderId: string;
  currentStatus: string;
  wireDetails?: {
    senderReference?: string;
    senderName?: string;
    senderBank?: string;
    submittedAt?: string;
  };
}

export default function WireApprovalActions({
  orderId,
  currentStatus,
  wireDetails,
}: WireApprovalActionsProps) {
  const router = useRouter();
  const { toast } = useRoast();
  const [loading, setLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  const handleAction = async (action: 'approve' | 'reject') => {
    const confirmPrompt = action === 'approve'
      ? 'Confirm approval of this Wire / Wise deposit? The allocation order will be marked as PAID.'
      : 'Are you sure you want to REJECT this wire transfer allocation?';

    if (!confirm(confirmPrompt)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders/approve-wire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action,
          adminNote: adminNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status');

      toast(data.message || 'Action processed successfully', 'success');
      router.refresh();
    } catch (err: any) {
      toast(err.message || 'Error processing action', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (currentStatus !== 'awaiting_wire_confirmation') {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.12), rgba(20, 20, 20, 0.95))',
      border: '1px solid #ffa502',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1.5rem',
      marginBottom: '2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, color: '#ffa502', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⏳</span> ACTION REQUIRED: Approve or Reject Wire Transfer Deposit
        </h3>
        <span style={{ background: '#ffa502', color: '#000', fontWeight: 900, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
          PENDING AUDIT
        </span>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
        <p style={{ margin: '0.25rem 0' }}><strong>Submitted Reference / UTR:</strong> <span style={{ color: '#FFD700', fontFamily: 'monospace' }}>{wireDetails?.senderReference || 'None Provided'}</span></p>
        <p style={{ margin: '0.25rem 0' }}><strong>Sender Remitting Bank:</strong> <span>{wireDetails?.senderBank || 'Wise / Wire'}</span></p>
        <p style={{ margin: '0.25rem 0' }}><strong>Submitted At:</strong> <span suppressHydrationWarning>{wireDetails?.submittedAt ? new Date(wireDetails.submittedAt).toLocaleString() : 'Recently'}</span></p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
          Admin Audit Memo / Internal Reason (Optional):
        </label>
        <input
          type="text"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="e.g. Verified $500.00 credit in Wise settlement account ref #12345"
          style={{
            width: '100%',
            background: 'var(--surface-2, #1a1a1a)',
            border: '1px solid #333',
            color: '#fff',
            padding: '0.6rem 0.85rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction('approve')}
          style={{
            background: '#2ed573',
            color: '#000',
            fontWeight: 800,
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {loading ? 'Processing...' : '✓ Approve & Confirm Wire Payment'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction('reject')}
          style={{
            background: 'transparent',
            color: '#ff4757',
            border: '1px solid #ff4757',
            fontWeight: 700,
            padding: '0.65rem 1.25rem',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
          }}
        >
          ✕ Reject Wire
        </button>
      </div>
    </div>
  );
}
