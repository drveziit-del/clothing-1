import AdminReferralsClient from './AdminReferralsClient';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

async function getReferralsPageData() {
  try {
    const referralsSnap = await adminDb.collection('referrals').orderBy('createdAt', 'desc').get();
    const referrals = referralsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

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

    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const settingsData = settingsSnap.data() || {};
    const globalReferralCount = settingsData.globalReferralCount ?? 0;
    const until100k = Math.max(0, 100000 - globalReferralCount);

    const totalPaidRaw = referrals
      .filter(r => r.status === 'claimed' || r.status === 'credited')
      .reduce((sum, r) => sum + (r.commission || 0), 0);

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
        commissionRaw: ref.commission || 0,
        status: ref.status,
        date: dateStr
      };
    });

    return {
      globalReferralCount,
      totalPaidRaw,
      activeAffiliatesCount,
      until100k,
      referrals: tableData
    };
  } catch (err) {
    console.error('Error loading referrals admin data:', err);
    return {
      globalReferralCount: 0,
      totalPaidRaw: 0,
      activeAffiliatesCount: 0,
      until100k: 100000,
      referrals: []
    };
  }
}

export default async function AdminReferralsPage() {
  const data = await getReferralsPageData();

  return <AdminReferralsClient data={data} />;
}
