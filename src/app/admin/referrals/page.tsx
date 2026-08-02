import { adminDb } from '@/lib/firebase/admin';
import MetricsCards from '@/components/admin/MetricsCards';
import DataTable from '@/components/admin/DataTable';
import styles from '../page.module.css';
import ExportCsvButton from '@/components/admin/ExportCsvButton';

export const dynamic = 'force-dynamic';

async function getReferralsPageData() {
  try {
    // 1. Fetch all referrals sorted by date
    const referralsSnap = await adminDb.collection('referrals').orderBy('createdAt', 'desc').get();
    const referrals = referralsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // 2. Fetch all users to map names/emails
    const usersSnap = await adminDb.collection('users').get();
    const usersMap = new Map();
    let activeAffiliatesCount = 0;

    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      usersMap.set(doc.id, {
        displayName: data.displayName || 'Anonymous',
        email: data.email || '—',
        referralCount: data.referralCount || 0
      });
      if ((data.referralCount || 0) > 0) {
        activeAffiliatesCount++;
      }
    });

    // 3. Fetch global settings for count
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const settingsData = settingsSnap.data() || {};
    const globalReferralCount = settingsData.globalReferralCount ?? 0;
    const until100k = Math.max(0, 100000 - globalReferralCount);

    // 4. Calculate total commissions paid (claimed or credited status)
    const totalPaid = referrals
      .filter(r => r.status === 'claimed' || r.status === 'credited')
      .reduce((sum, r) => sum + (r.commission || 0), 0);

    // 5. Format table logs
    const tableData = referrals.map(ref => {
      const affiliateInfo = usersMap.get(ref.affiliateUid);
      const affiliateName = affiliateInfo 
        ? `${affiliateInfo.displayName} (${affiliateInfo.email})` 
        : ref.affiliateCode || 'N/A';

      const dateStr = ref.createdAt ? ref.createdAt.toDate().toLocaleDateString() : 'Recent';

      return {
        id: ref.id,
        affiliate: affiliateName,
        referred: ref.referredUid ? (usersMap.get(ref.referredUid)?.email || 'Anonymous Customer') : 'Anonymous Customer',
        order: ref.orderId ? `#${ref.orderId.slice(-6).toUpperCase()}` : 'N/A',
        commission: ref.commission > 0 ? `$${ref.commission.toFixed(2)}` : '$0.00',
        status: ref.status,
        date: dateStr
      };
    });

    return {
      metrics: [
        { label: 'Global Referral Count', value: globalReferralCount.toString() },
        { label: 'Total Commissions Paid', value: `$${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, accent: 'coral' as const },
        { label: 'Active Affiliates', value: activeAffiliatesCount.toString(), accent: 'mist' as const },
        { label: 'Until 100,000th Customer', value: until100k.toLocaleString() },
      ],
      referrals: tableData
    };
  } catch (err) {
    console.error('Error loading referrals admin data:', err);
    return {
      metrics: [
        { label: 'Global Referral Count', value: '0' },
        { label: 'Total Commissions Paid', value: '$0.00', accent: 'coral' as const },
        { label: 'Active Affiliates', value: '0', accent: 'mist' as const },
        { label: 'Until 100,000th Customer', value: '100,000' },
      ],
      referrals: []
    };
  }
}

export default async function AdminReferralsPage() {
  const { metrics, referrals } = await getReferralsPageData();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Referrals</h1>
          <ExportCsvButton data={referrals} fileName="referrals.csv" />
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
          data={referrals}
          emptyMessage="No referrals yet. Share those links."
        />
      </section>
    </div>
  );
}
