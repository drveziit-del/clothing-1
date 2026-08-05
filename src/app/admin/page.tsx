import AdminDashboardClient from './AdminDashboardClient';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  try {
    // Fetch all orders
    const ordersSnap = await adminDb.collection('orders').get();
    const orders = ordersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    // Fetch all users
    const usersSnap = await adminDb.collection('users').get();
    const usersCount = usersSnap.size;

    // Fetch all referrals
    const referralsSnap = await adminDb.collection('referrals').get();
    const referrals = referralsSnap.docs.map((doc) => doc.data());
    const referralsCount = referralsSnap.size;

    // Calculations
    const activeOrders = orders.filter((o) => o.status !== 'pending' && o.status !== 'cancelled');
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrdersCount = activeOrders.length;
    const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;

    // Referral Metrics
    const referralRevenue = activeOrders
      .filter((o) => o.referralCode)
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const referralContribution = totalRevenue > 0 ? (referralRevenue / totalRevenue) * 100 : 0;

    const totalCommissionsClaimed = referrals
      .filter((r) => r.status === 'claimed' || r.status === 'credited')
      .reduce((sum, r) => sum + (r.commission || 0), 0);

    const totalCommissionsPending = referrals
      .filter((r) => r.status === 'eligible_for_claim')
      .reduce((sum, r) => sum + (r.commission || 0), 0);

    // Get 5 most recent orders
    const recentOrdersSnap = await adminDb
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentOrders = recentOrdersSnap.docs.map((doc) => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '—';
      return {
        id: doc.id,
        user: data.shippingAddress?.name || data.userEmail || 'Anonymous',
        totalRaw: Number(data.total || 0),
        status: data.status,
        date,
      };
    });

    // Top 5 Affiliates Leaderboard
    const topAffiliatesSnap = await adminDb
      .collection('users')
      .orderBy('referralCount', 'desc')
      .limit(5)
      .get();

    const topAffiliates = topAffiliatesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName || 'Anonymous',
        email: data.email || '—',
        referrals: data.referralCount ?? 0,
        earningsRaw: Number(data.totalEarnings ?? 0),
      };
    });

    // Milestone settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const settingsData = settingsSnap.data() || {};
    const globalCount = settingsData.globalReferralCount ?? 0;
    const milestoneProgress = Math.min(100, (globalCount / 100000) * 100);

    return {
      totalRevenue,
      totalOrdersCount,
      usersCount,
      referralsCount,
      pendingOrdersCount,
      recentOrders,
      topAffiliates,
      referralAnalytics: {
        referralRevenue,
        referralContribution,
        totalCommissionsClaimed,
        totalCommissionsPending,
        globalCount,
        milestoneProgress,
      },
    };
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    return {
      totalRevenue: 0,
      totalOrdersCount: 0,
      usersCount: 0,
      referralsCount: 0,
      pendingOrdersCount: 0,
      recentOrders: [],
      topAffiliates: [],
      referralAnalytics: {
        referralRevenue: 0,
        referralContribution: 0,
        totalCommissionsClaimed: 0,
        totalCommissionsPending: 0,
        globalCount: 0,
        milestoneProgress: 0,
      },
    };
  }
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return <AdminDashboardClient data={data} />;
}
