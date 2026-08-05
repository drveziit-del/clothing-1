'use client';

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Referrals</h1>
          <ExportCsvButton data={formattedReferrals} fileName="referrals.csv" />
        </div>
        <p className={styles.subtitle}>
          Every 10 successful referrals → $50 commission. 
          100,000th global customer → $100,000 mega-reward.
        </p>
      </div>

      <section className={styles.section}>
        <MetricsCards metrics={metrics} />
      </section>

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
