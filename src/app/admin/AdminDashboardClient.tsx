'use client';

import { useCurrency } from '@/context/CurrencyContext';
import MetricsCards from '@/components/admin/MetricsCards';
import DataTable from '@/components/admin/DataTable';
import styles from './page.module.css';

interface DashboardClientProps {
  data: {
    totalRevenue: number;
    totalOrdersCount: number;
    usersCount: number;
    referralsCount: number;
    pendingOrdersCount: number;
    prebookingCount?: number;
    recentOrders: Array<{
      id: string;
      user: string;
      totalRaw: number;
      status: string;
      date: string;
    }>;
    topAffiliates: Array<{
      id: string;
      name: string;
      email: string;
      referrals: number;
      earningsRaw: number;
    }>;
    referralAnalytics: {
      referralRevenue: number;
      referralContribution: number;
      totalCommissionsClaimed: number;
      totalCommissionsPending: number;
      globalCount: number;
      milestoneProgress: number;
    };
  };
}

export default function AdminDashboardClient({ data }: DashboardClientProps) {
  const { formatPrice } = useCurrency();
  const {
    totalRevenue,
    totalOrdersCount,
    usersCount,
    referralsCount,
    pendingOrdersCount,
    prebookingCount = 0,
    recentOrders,
    topAffiliates,
    referralAnalytics,
  } = data;

  const metrics = [
    { label: 'Total Revenue', value: formatPrice(totalRevenue), accent: 'coral' as const },
    { label: 'Total Orders', value: totalOrdersCount.toString(), accent: 'mist' as const },
    { label: '👑 Luxury Pre-bookings', value: prebookingCount.toString(), accent: 'coral' as const },
    { label: 'Active Users', value: usersCount.toString() },
    { label: 'Referrals Count', value: referralsCount.toString() },
    { label: 'Pending Orders', value: pendingOrdersCount.toString() },
  ];

  const formattedRecentOrders = recentOrders.map((order) => ({
    ...order,
    total: formatPrice(order.totalRaw),
  }));

  const formattedTopAffiliates = topAffiliates.map((aff) => ({
    ...aff,
    earnings: formatPrice(aff.earningsRaw),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Real-time metrics from your active store.</p>
      </div>

      <section className={styles.section}>
        <MetricsCards metrics={metrics} />
      </section>

      {/* Referral & Affiliate Analytics Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Referral & Affiliate Analytics</h2>
        <div className={styles.analyticsLayout}>
          {/* Top Affiliates Leaderboard */}
          <div className={styles.analyticsCard}>
            <h3 className={styles.cardHeader}>Top Performing Affiliates</h3>
            <div className={styles.tableWrap}>
              <table className={styles.leaderboardTable}>
                <thead>
                  <tr>
                    <th>Affiliate</th>
                    <th style={{ textAlign: 'right' }}>Referrals</th>
                    <th style={{ textAlign: 'right' }}>Total Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedTopAffiliates.length > 0 ? (
                    formattedTopAffiliates.map((aff) => (
                      <tr key={aff.id}>
                        <td>
                          <div className={styles.affiliateInfo}>
                            <span className={styles.affName}>{aff.name}</span>
                            <span className={styles.affEmail}>{aff.email}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{aff.referrals}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'JetBrains Mono',
                            color: 'var(--coral-200)',
                          }}
                        >
                          {aff.earnings}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.emptyTable}>
                        No active affiliates yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Referral Sales Contribution & Milestone Tracker */}
          <div className={styles.analyticsCard}>
            <h3 className={styles.cardHeader}>Referral Revenue Performance</h3>
            <div className={styles.analyticsRightGroup}>
              {/* Contribution Row */}
              <div className={styles.kpiRow}>
                <div className={styles.kpiBox}>
                  <span className={styles.kpiVal}>
                    {formatPrice(referralAnalytics.referralRevenue)}
                  </span>
                  <span className={styles.kpiLabel}>Referral Revenue</span>
                </div>
                <div className={styles.kpiBox}>
                  <span className={styles.kpiVal}>
                    {referralAnalytics.referralContribution.toFixed(1)}%
                  </span>
                  <span className={styles.kpiLabel}>Revenue Share Contribution</span>
                </div>
              </div>

              {/* Commission Box */}
              <div className={styles.kpiRow}>
                <div className={styles.kpiBox}>
                  <span className={styles.kpiVal} style={{ color: 'var(--mist-200)' }}>
                    {formatPrice(referralAnalytics.totalCommissionsClaimed)}
                  </span>
                  <span className={styles.kpiLabel}>Paid Commissions</span>
                </div>
                <div className={styles.kpiBox}>
                  <span className={styles.kpiVal} style={{ color: 'var(--text-muted)' }}>
                    {formatPrice(referralAnalytics.totalCommissionsPending)}
                  </span>
                  <span className={styles.kpiLabel}>Pending Claims</span>
                </div>
              </div>

              {/* Milestone Box */}
              <div className={styles.milestoneBox}>
                <div className={styles.milestoneHeader}>
                  <span className={styles.milestoneTitle}>
                    $100K Customer Milestone Progress
                  </span>
                  <span className={styles.milestoneCounter}>
                    {referralAnalytics.globalCount.toLocaleString()} / 100,000
                  </span>
                </div>
                <div className={styles.milestoneBarOuter}>
                  <div
                    className={styles.milestoneBarFill}
                    style={{ width: `${referralAnalytics.milestoneProgress}%` }}
                  />
                </div>
                <span className={styles.milestoneHint}>
                  {referralAnalytics.milestoneProgress.toFixed(2)}% toward global customer payout.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
        <DataTable
          columns={[
            { key: 'id', label: 'Order ID' },
            { key: 'user', label: 'Customer' },
            { key: 'total', label: 'Total', align: 'right' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <span
                  className={`tag ${
                    row.status === 'paid' || row.status === 'delivered'
                      ? 'tag-coral'
                      : row.status === 'pending'
                      ? ''
                      : 'tag-mist'
                  }`}
                >
                  {row.status}
                </span>
              ),
            },
            { key: 'date', label: 'Date', align: 'right' },
          ]}
          data={formattedRecentOrders}
          emptyMessage="No orders yet. The roasts haven't worked hard enough."
        />
      </section>
    </div>
  );
}
