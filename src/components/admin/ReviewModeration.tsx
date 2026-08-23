'use client';

import { useCallback, useEffect, useState } from 'react';

interface PendingReview {
  id: string;
  userName?: string;
  rating?: number;
  text?: string;
  productId?: string | null;
  verifiedPurchase?: boolean;
  createdAt?: string | null;
}

/**
 * Admin moderation queue: unverified reviews await approval before they
 * appear publicly. Backed by PATCH /api/reviews (admin claim required).
 */
export default function ReviewModeration() {
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews?status=pending', { method: 'PATCH' });
      if (res.ok) {
        setPending(await res.json());
      }
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (reviewId: string, action: 'approve' | 'reject') => {
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

  return (
    <section style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
        Review Moderation {pending.length > 0 ? `(${pending.length} pending)` : ''}
      </h2>
      <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '12px' }}>
        Unverified reviews stay hidden until approved. Verified purchases publish automatically.
      </p>
      {loading ? (
        <p style={{ color: '#8b949e', fontSize: '13px' }}>Loading queue…</p>
      ) : pending.length === 0 ? (
        <p style={{ color: '#8b949e', fontSize: '13px' }}>Queue clear. Nothing awaiting judgment.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {pending.map((r) => (
            <div
              key={r.id}
              style={{
                border: '1px solid #21262d',
                borderRadius: '8px',
                padding: '12px 16px',
                background: '#0d1117',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: '240px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {r.userName || 'Anonymous'} · {'★'.repeat(r.rating ?? 0)}
                  {'☆'.repeat(Math.max(0, 5 - (r.rating ?? 0)))}
                  {r.productId ? <span style={{ color: '#8b949e', fontWeight: 400 }}> · {r.productId}</span> : null}
                </div>
                <div style={{ fontSize: '13px', color: '#c9d1d9', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {r.text}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => act(r.id, 'approve')}
                  disabled={actingOn === r.id}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => act(r.id, 'reject')}
                  disabled={actingOn === r.id}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
