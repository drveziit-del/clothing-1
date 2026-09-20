'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { CustomDesignRequest, CustomDesignStatus } from '@/lib/custom-design/types';
import styles from './admin-custom-designs.module.css';

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'All Requests' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'NEEDS_INFORMATION', label: 'Needs Info' },
  { key: 'DESIGN_IN_PROGRESS', label: 'In Progress' },
  { key: 'CUSTOMER_APPROVAL_REQUIRED', label: 'Customer Approval' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'FINAL_PAYMENT_PENDING', label: 'Final Payment' },
  { key: 'IN_PRODUCTION', label: 'In Production' },
  { key: 'FULFILLED', label: 'Fulfilled' },
  { key: 'PAYMENT_PENDING', label: 'Payment Pending' },
  { key: 'PAYMENT_FAILED', label: 'Payment Failed' },
];

export default function AdminCustomDesignsClient() {
  const [requests, setRequests] = useState<CustomDesignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/custom-designs?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin custom requests:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests();
  };

  const getStatusClass = (status: CustomDesignStatus) => {
    if (status === 'NEEDS_INFORMATION') return styles.statusNeedsInfo;
    if (status === 'SUBMITTED') return styles.statusSubmitted;
    if (status === 'APPROVED' || status === 'FULFILLED') return styles.statusApproved;
    return '';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Custom Design Studio</h1>
          <p className={styles.subtitle}>Manage customer custom creations, reviews, proofs, and production</p>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          className="btn btn-secondary btn-sm"
        >
          ↻ Refresh Matrix
        </button>
      </div>

      <div className={styles.controls}>
        {/* Filter Pills */}
        <div className={styles.filtersRow}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.filterPill} ${statusFilter === f.key ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by Request #, Customer email, or Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Requests Table */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.empty}>Loading studio requests...</div>
        ) : requests.length === 0 ? (
          <div className={styles.empty}>No custom requests found matching this filter.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Request</th>
                <th className={styles.th}>Customer</th>
                <th className={styles.th}>Garment</th>
                <th className={styles.th}>Prepayment</th>
                <th className={styles.th}>Payment Status</th>
                <th className={styles.th}>Studio Status</th>
                <th className={styles.th}>Created</th>
                <th className={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className={styles.tr}>
                  <td className={styles.td}>
                    <span className={styles.reqIdBadge}>#{r.requestId || r.id.slice(0, 8)}</span>
                  </td>
                  <td className={styles.td}>
                    <div style={{ fontWeight: 600 }}>{r.customerName || 'Customer'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.customerEmail}</div>
                  </td>
                  <td className={styles.td}>
                    <div>{r.productType}</div>
                    {r.preferredSize && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Size {r.preferredSize}</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span style={{ fontWeight: 700 }}>${r.prepaymentAmount} USD</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {r.plan === 'better_quality' || r.plan === 'priority' ? 'Better Quality' : 'Regular'}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span style={{ color: r.paymentStatus === 'paid' ? '#2ed573' : '#eab308', fontWeight: 700 }}>
                      {r.paymentStatus.toUpperCase()}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.statusTag} ${getStatusClass(r.status)}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={styles.td} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt as string).toLocaleDateString()}
                  </td>
                  <td className={styles.td}>
                    <Link href={`/admin/custom-designs/${r.id}`} className={styles.viewBtn}>
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
