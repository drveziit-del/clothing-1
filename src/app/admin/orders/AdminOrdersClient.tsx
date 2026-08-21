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
  isPrebooking?: boolean;
  prebookEmail?: string | null;
  prebookMessage?: string | null;
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
  const [activeTab, setActiveTab] = useState<'all' | 'standard' | 'prebook'>('all');

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

  const prebookCount = ordersList.filter((o) => o.isPrebooking).length;
  const standardCount = ordersList.filter((o) => !o.isPrebooking).length;

  const filteredOrders = ordersList.filter((o) => {
    if (activeTab === 'prebook') return o.isPrebooking;
    if (activeTab === 'standard') return !o.isPrebooking;
    return true;
  });

  const formattedOrders = filteredOrders.map((o) => ({
    ...o,
    total: formatPrice(o.totalRaw),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className={styles.title}>Orders &amp; Allocations</h1>
          <ExportCsvButton data={formattedOrders} fileName="orders.csv" />
        </div>
        <p className={styles.subtitle}>
          Manage all standard streetwear orders and Society Fu*kers luxury pre-booking allocations.
        </p>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('all')}
          >
            All Orders ({ordersList.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('standard')}
          >
            Standard Orders ({standardCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'prebook' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('prebook')}
            style={activeTab === 'prebook' ? { background: '#FFD700', color: '#000', fontWeight: 800 } : {}}
          >
            👑 Society Fu*kers Pre-bookings ({prebookCount})
          </button>
        </div>
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
                {r.id.slice(0, 12)}... ↗
              </Link>
            ),
          },
          {
            key: 'type',
            label: 'Type',
            render: (r) => (
              r.isPrebooking ? (
                <span className="tag" style={{ background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.4)', color: '#FFD700', fontWeight: 800 }}>
                  👑 Pre-booking
                </span>
              ) : (
                <span className="tag">Standard</span>
              )
            ),
          },
          { key: 'customer', label: 'Customer' },
          { key: 'items', label: 'Items / Allocation' },
          { key: 'total', label: 'Amount', align: 'right' },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              r.status === 'awaiting_wire_confirmation' ? (
                <span className="tag" style={{ background: 'rgba(255, 165, 0, 0.2)', border: '1px solid #ffa502', color: '#ffa502', fontWeight: 800 }}>
                  ⏳ Wire Review
                </span>
              ) : (
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
              )
            ),
          },
          { key: 'date', label: 'Date', align: 'right' },
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (r) => (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Link
                  href={`/admin/orders/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-xs"
                >
                  View Details
                </Link>
                {!r.isPrebooking && !r.printifyOrderId && (
                  <button
                    onClick={() => handleRetryPrintify(r.id)}
                    disabled={loadingId === r.id}
                    className="btn btn-primary btn-xs"
                  >
                    {loadingId === r.id ? 'Sending...' : 'Retry Printify'}
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={formattedOrders}
        emptyMessage="No orders found matching this filter."
      />
    </div>
  );
}
