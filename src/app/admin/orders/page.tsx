import DataTable from '@/components/admin/DataTable';
import styles from '../page.module.css';
import { adminDb } from '@/lib/firebase/admin';
import ExportCsvButton from '@/components/admin/ExportCsvButton';

export const dynamic = 'force-dynamic';

async function getOrders() {
  try {
    const snapshot = await adminDb.collection('orders').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : '—';
      
      // Construct item summary
      const itemsSummary = data.items
        ?.map((item: any) => `${item.title} × ${item.quantity}`)
        .join(', ') || '—';

      return {
        id: doc.id,
        customer: data.shippingAddress?.name || data.userEmail || 'Anonymous',
        items: itemsSummary,
        total: `$${Number(data.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: data.status,
        date,
      };
    });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    return [];
  }
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Orders</h1>
          <ExportCsvButton data={orders} fileName="orders.csv" />
        </div>
        <p className={styles.subtitle}>All orders across both collections. Status updates sync from Printify.</p>
      </div>

      <DataTable
        columns={[
          { key: 'id',       label: 'Order ID' },
          { key: 'customer', label: 'Customer' },
          { key: 'items',    label: 'Items' },
          { key: 'total',    label: 'Total', align: 'right' },
          { key: 'status',   label: 'Status', render: (r) => (
            <span className={`tag ${r.status === 'paid' || r.status === 'delivered' ? 'tag-coral' : r.status === 'pending' ? '' : 'tag-mist'}`}>
              {r.status}
            </span>
          )},
          { key: 'date', label: 'Date', align: 'right' },
        ]}
        data={orders}
        emptyMessage="No orders yet. The site is live — the customers aren't."
      />
    </div>
  );
}
