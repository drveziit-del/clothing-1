'use client';

import { useCurrency } from '@/context/CurrencyContext';
import DataTable from '@/components/admin/DataTable';
import ExportCsvButton from '@/components/admin/ExportCsvButton';
import styles from '../page.module.css';

interface OrderRow {
  id: string;
  customer: string;
  items: string;
  totalRaw: number;
  status: string;
  date: string;
}

interface AdminOrdersClientProps {
  orders: OrderRow[];
}

export default function AdminOrdersClient({ orders }: AdminOrdersClientProps) {
  const { formatPrice } = useCurrency();

  const formattedOrders = orders.map((o) => ({
    ...o,
    total: formatPrice(o.totalRaw),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Orders</h1>
          <ExportCsvButton data={formattedOrders} fileName="orders.csv" />
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
        data={formattedOrders}
        emptyMessage="No orders yet. The site is live — the customers aren't."
      />
    </div>
  );
}
