import DataTable from '@/components/admin/DataTable';
import styles from '../page.module.css';
import { adminDb } from '@/lib/firebase/admin';
import ExportCsvButton from '@/components/admin/ExportCsvButton';

export const dynamic = 'force-dynamic';

async function getUsers() {
  try {
    const snapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const joined = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '—';
      return {
        id: doc.id,
        name: data.displayName || 'Anonymous',
        email: data.email || '—',
        role: data.role || 'user',
        referrals: (data.referralCount ?? 0).toString(),
        joined,
      };
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return [];
  }
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Users</h1>
          <ExportCsvButton data={users} fileName="users.csv" />
        </div>
        <p className={styles.subtitle}>Manage accounts and view active customer stats.</p>
      </div>

      <DataTable
        columns={[
          { key: 'name',      label: 'Name' },
          { key: 'email',     label: 'Email' },
          { key: 'role',      label: 'Role', render: (r) => (
            <span className={`tag ${r.role === 'admin' ? 'tag-mist' : ''}`}>{r.role}</span>
          )},
          { key: 'referrals', label: 'Referrals', align: 'right' },
          { key: 'joined',    label: 'Joined',    align: 'right' },
        ]}
        data={users}
        emptyMessage="No users. Connect Firebase Auth to populate this table."
      />
    </div>
  );
}
