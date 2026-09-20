import AdminSidebar from '@/components/admin/AdminSidebar';
import styles from './layout.module.css';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin — GERKINK',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    redirect('/auth/login?redirect=/admin');
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      redirect('/?error=unauthorized');
    }
  } catch (err) {
    console.error('Admin layout verification failed:', err);
    redirect('/auth/login?redirect=/admin');
  }

  return (
    <div className={styles.layout}>
      <AdminSidebar />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
