'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import MetricsCards from '@/components/admin/MetricsCards';
import DataTable from '@/components/admin/DataTable';
import ExportCsvButton from '@/components/admin/ExportCsvButton';
import styles from '../page.module.css';

interface ReferralRow {
  id: string;
  affiliate: string;
  referred: string;
  order: string;
  commissionRaw: number;
  status: string;
  date: string;
}

interface PayoutRequestRow {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  amount?: number;
  method?: string;
  payoutDetails?: string;
  status: string;
  createdAt: string | null;
  updatedAt?: string | null;
}

interface AdminReferralsClientProps {
  data: {
    globalReferralCount: number;
    totalPaidRaw: number;
    activeAffiliatesCount: number;
    until100k: number;
    referrals: ReferralRow[];
  };
}

export default function AdminReferralsClient({ data }: AdminReferralsClientProps) {
  const { formatPrice } = useCurrency();
  const {
    globalReferralCount,
    totalPaidRaw,
    activeAffiliatesCount,
    until100k,
    referrals,
  } = data;

  const [pendingPayouts, setPendingPayouts] = useState<PayoutRequestRow[]>([]);
  const [processedPayouts, setProcessedPayouts] = useState<PayoutRequestRow[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadPayouts = useCallback(async () => {
    setPayoutLoading(true);
    try {
      const res = await fetch('/api/admin/payouts');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setPendingPayouts(json.pending || []);
      setProcessedPayouts(json.processed || []);
    } catch (err) {
      console.error('Failed to load payout requests:', err);
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const decide = async (requestId: string, action: 'approve' | 'reject') => {
    setActingOn(requestId);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          adminNote: noteDrafts[requestId]?.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Action failed');
      }
    } catch (err) {
      console.error('Payout action failed:', err);
      alert('Action failed — check your connection.');
    } finally {
      setActingOn(null);
      await loadPayouts();
    }
  };

  const metrics = [
    { label: 'Global Referral Count', value: globalReferralCount.toString() },
    { label: 'Total Commissions Paid', value: formatPrice(totalPaidRaw), accent: 'coral' as const },
    { label: 'Active Affiliates', value: activeAffiliatesCount.toString(), accent: 'mist' as const },
    { label: 'Until 100,000th Customer', value: until100k.toLocaleString() },
  ];

  const formattedReferrals = referrals.map((ref) => ({
    ...ref,
    commission: ref.commissionRaw > 0 ? formatPrice(ref.commissionRaw) : formatPrice(0),
  }));

  const renderPayoutTable = (rows: PayoutRequestRow[], pending: boolean) => (
    <DataTable
      columns={[
        { key: 'userName', label: 'Affiliate' },
        { key: 'userEmail', label: 'Email' },
        { key: 'amountFmt', label: 'Amount', align: 'right' },
        { key: 'method', label: 'Method' },
        { key: 'details', label: 'Details (masked)', render: (r) => (
          <span style={{ fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{r.payoutDetails}</span>
        )},
        { key: 'date', label: pending ? 'Requested' : 'Decided', render: (r) => (pending ? r.createdAt : r.updatedAt)?.slice(0, 10) ?? '—' },
        ...(pending ? [{
          key: 'actions', label: 'Actions', render: (r: PayoutRequestRow & Record<string, unknown>) => (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => decide(r.id, 'approve')}
                disabled={actingOn === r.id}
                className="btn btn-primary btn-sm"
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                {actingOn === r.id ? '…' : 'Approve'}
              </button>
              <button
                onClick={() => decide(r.id, 'reject')}
                disabled={actingOn === r.id}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                Reject
              </button>
              <input
                type="text"
                placeholder="Note (optional)"
                value={noteDrafts[r.id] ?? ''}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  color: '#e6edf3',
                  borderRadius: '4px',
                  width: '140px',
                }}
              />
            </div>
          ),
        }] : [{
          key: 'status', label: 'Status', render: (r: PayoutRequestRow & Record<string, unknown>) => (
            <span className={`tag ${r.status === 'rejected' ? 'tag-coral' : 'tag-mist'}`}>{r.status}</span>
          ),
        }]),
      ]}
      data={rows.map((r) => ({ ...r, amountFmt: formatPrice(r.amount ?? 0) }))}
      emptyMessage={pending ? 'No pending payout requests.' : 'No processed payouts yet.'}
    />
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Referrals</h1>
          <ExportCsvButton data={formattedReferrals} fileName="referrals.csv" />
        </div>
        <p className={styles.subtitle}>
          Every 10 successful referrals → $100 commission.
          100,000th global customer → $100,000 mega-reward.
        </p>
      </div>

      <section className={styles.section}>
        <MetricsCards metrics={metrics} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Payout Approvals {pendingPayouts.length > 0 ? `(${pendingPayouts.length} pending)` : ''}
        </h2>
        <p className={styles.subtitle} style={{ marginBottom: '12px' }}>
          Full unmasked credentials are in the treasury alert email for each request.
          Approve only after the manual transfer is sent. Rejected amounts return to the affiliate&apos;s wallet.
        </p>
        {payoutLoading
          ? <p className={styles.subtitle}>Loading payout queue…</p>
          : renderPayoutTable(pendingPayouts, true)}
      </section>

      {processedPayouts.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Decisions</h2>
          {renderPayoutTable(processedPayouts, false)}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Referral Log</h2>
        <DataTable
          columns={[
            { key: 'affiliate',  label: 'Affiliate' },
            { key: 'referred',   label: 'Referred User' },
            { key: 'order',      label: 'Order ID' },
            { key: 'commission', label: 'Commission', align: 'right' },
            { key: 'date',       label: 'Date' },
            { key: 'status',     label: 'Status', render: (r) => (
              <span className={`tag ${
                r.status === 'claimed' || r.status === 'credited' ? 'tag-mist' : 'tag-coral'
              }`}>{r.status}</span>
            )},
          ]}
          data={formattedReferrals}
          emptyMessage="No referrals yet. Share those links."
        />
      </section>
    </div>
  );
}
