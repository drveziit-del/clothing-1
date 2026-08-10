'use client';

import { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useRoast } from '@/hooks/useRoast';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
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
  printifyOrderId?: string | null;
}

interface AdminOrdersClientProps {
  orders: OrderRow[];
}

export default function AdminOrdersClient({ orders: initialOrders }: AdminOrdersClientProps) {
  const { formatPrice } = useCurrency();
  const { toast } = useRoast();
  const { firebaseUser } = useAuth();
  const [ordersList, setOrdersList] = useState(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRetryPrintify = async (orderId: string) => {
    setLoadingId(orderId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/admin/orders/retry-printify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit order to Printify');

      toast(`Order successfully punched to Printify! (ID: ${data.printifyOrderId})`, 'success');
      setOrdersList((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: 'in_production', printifyOrderId: data.printifyOrderId } : o
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting to Printify';
      toast(msg, 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const formattedOrders = ordersList.map((o) => ({
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
        <p className={styles.subtitle}>All orders across both collections. Status updates sync from Printify. Click any Order ID to open buyer details in a new tab.</p>
      </div>

      <DataTable
        columns={[
          {
            key: 'id',
            label: 'Order ID',
            render: (r) => (
              <Link
                href={`/admin/orders/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--coral-200)', textDecoration: 'underline', fontWeight: 600, fontFamily: 'monospace' }}
              >
                {r.id} ↗
              </Link>
            ),
          },
          { key: 'customer', label: 'Customer' },
          { key: 'items', label: 'Items' },
          { key: 'total', label: 'Total', align: 'right' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <span
                className={`tag ${
                  r.status === 'paid' || r.status === 'delivered' || r.status === 'in_production'
                    ? 'tag-coral'
                    : r.status === 'pending'
                    ? ''
                    : 'tag-mist'
                }`}
              >
                {r.status}
              </span>
            ),
          },
          { key: 'date', label: 'Date', align: 'right' },
          {
            key: 'actions',
            label: 'Fulfillment',
            align: 'right',
            render: (r) => (
              <div style={{ textAlign: 'right' }}>
                {r.printifyOrderId ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--mist-200)', fontFamily: 'monospace' }}>
                    Sent ({r.printifyOrderId.slice(-6)})
                  </span>
                ) : (
                  <button
                    className="btn btn-secondary btn-xs"
                    disabled={loadingId === r.id}
                    onClick={() => handleRetryPrintify(r.id)}
                  >
                    {loadingId === r.id ? 'Sending...' : 'Punch to Printify'}
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={formattedOrders}
        emptyMessage="No orders yet. The site is live — the customers aren't."
      />
    </div>
  );
}
