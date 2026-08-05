'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useRoast } from '@/hooks/useRoast';
import styles from './page.module.css';

interface Coupon {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  isGlobal: boolean;
  appliesTo?: 'subtotal' | 'grand_total';
  userId?: string | null;
  isActive: boolean;
  isUsed?: boolean;
  timesUsed?: number;
  minSubtotal?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  createdAt?: string | null;
}

export default function AdminCouponsPage() {
  const { formatPrice } = useCurrency();
  const { toast } = useRoast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [type, setType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [appliesTo, setAppliesTo] = useState<'subtotal' | 'grand_total'>('subtotal');
  const [isGlobal, setIsGlobal] = useState(true);
  const [userId, setUserId] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [creating, setCreating] = useState(false);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (!res.ok) throw new Error('Failed to load coupons');
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching coupons';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast('Please enter a coupon code.', 'error');
      return;
    }
    if (!value || parseFloat(value) <= 0) {
      toast('Please enter a valid discount value greater than 0.', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          type,
          value,
          isGlobal,
          appliesTo,
          userId: isGlobal ? undefined : userId,
          minSubtotal,
          maxUses,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create coupon');

      toast(`Coupon ${data.coupon.code} created successfully!`, 'success');
      setCode('');
      setValue('');
      setUserId('');
      setMinSubtotal('');
      setMaxUses('');
      setShowForm(false);
      fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating coupon';
      toast(msg, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(coupon: Coupon) {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          couponId: coupon.id,
          isActive: !coupon.isActive,
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setCoupons(prev =>
        prev.map(c => (c.id === coupon.id ? { ...c, isActive: !c.isActive } : c))
      );
      toast(`Coupon ${coupon.code} ${!coupon.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      toast(msg, 'error');
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Are you sure you want to delete coupon ${coupon.code}?`)) return;

    try {
      const res = await fetch(`/api/admin/coupons?id=${coupon.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete coupon');

      setCoupons(prev => prev.filter(c => c.id !== coupon.id));
      toast(`Coupon ${coupon.code} deleted.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting coupon';
      toast(msg, 'error');
    }
  }

  const activeCount = coupons.filter(c => c.isActive).length;
  const globalCount = coupons.filter(c => c.isGlobal).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Discount Coupons</h1>
          <p className={styles.subtitle}>
            Create and manage fixed ($) or percentage (%) promotional discount codes of any amount.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm(prev => !prev)}
          >
            {showForm ? '✕ Close Form' : '+ Create Coupon'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{coupons.length}</div>
          <div className={styles.statLabel}>Total Coupons</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#34c759' }}>{activeCount}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#007aff' }}>{globalCount}</div>
          <div className={styles.statLabel}>Global Store Codes</div>
        </div>
      </div>

      {/* Create Coupon Form Card */}
      {showForm && (
        <form onSubmit={handleCreateCoupon} className={styles.formCard}>
          <h2 className={styles.formTitle}>Create New Discount Code</h2>
          <div className={styles.gridForm}>
            <div className={styles.field}>
              <label className={styles.label}>Coupon Code</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. SUMMER50 or VIP20"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Discount Type</label>
              <select
                className="input"
                value={type}
                onChange={e => setType(e.target.value as 'fixed' | 'percentage')}
              >
                <option value="fixed">Fixed Amount ($ USD off)</option>
                <option value="percentage">Percentage (% off total)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                {type === 'fixed' ? 'Discount Amount ($ USD)' : 'Discount Percentage (%)'}
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={type === 'percentage' ? '100' : undefined}
                className="input"
                placeholder={type === 'fixed' ? 'e.g. 25 for $25 off' : 'e.g. 20 for 20% off'}
                value={value}
                onChange={e => setValue(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Discount Scope (Tax Handling)</label>
              <select
                className="input"
                value={appliesTo}
                onChange={e => setAppliesTo(e.target.value as 'subtotal' | 'grand_total')}
              >
                <option value="subtotal">Subtotal Only (Tax is still paid by customer)</option>
                <option value="grand_total">Grand Total (Includes Tax / Covers Tax)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Min Subtotal (Optional USD)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input"
                placeholder="e.g. 50 (Min purchase $50)"
                value={minSubtotal}
                onChange={e => setMinSubtotal(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Max Uses (Optional)</label>
              <input
                type="number"
                min="1"
                className="input"
                placeholder="e.g. 100 uses total"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
              />
            </div>

            <div className={styles.field} style={{ justifyContent: 'flex-end', paddingTop: '1.25rem' }}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={e => setIsGlobal(e.target.checked)}
                />
                <span>Global (Available to all customers)</span>
              </label>
            </div>

            {!isGlobal && (
              <div className={styles.field}>
                <label className={styles.label}>Target User Firebase UID</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter User UID"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  required={!isGlobal}
                />
              </div>
            )}
          </div>

          <div className={styles.formFooter}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
            >
              {creating ? 'Creating...' : 'Save & Publish Code'}
            </button>
          </div>
        </form>
      )}

      {/* Coupons Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.empty}>Loading discount codes...</div>
        ) : coupons.length === 0 ? (
          <div className={styles.empty}>
            No discount codes created yet. Click <strong>+ Create Coupon</strong> above to create one.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Type & Value</th>
                <th>Audience</th>
                <th>Min Purchase</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => (
                <tr key={coupon.id}>
                  <td>
                    <span className={styles.codeBadge}>{coupon.code}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.typeBadge} ${
                        coupon.type === 'percentage' ? styles.badgePercent : styles.badgeFixed
                      }`}
                    >
                      {coupon.type === 'percentage'
                        ? `${coupon.value}% OFF`
                        : `${formatPrice(coupon.value)} OFF`}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted, #8e8e93)', marginTop: '0.25rem' }}>
                      {coupon.appliesTo === 'grand_total' ? '✦ Includes Tax' : 'Subtotal Only'}
                    </div>
                  </td>
                  <td>
                    {coupon.isGlobal ? (
                      <span style={{ color: '#007aff', fontWeight: 600 }}>Global (All Users)</span>
                    ) : (
                      <span style={{ color: '#a3a3a3', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {coupon.userId?.substring(0, 12)}...
                      </span>
                    )}
                  </td>
                  <td>
                    {coupon.minSubtotal && coupon.minSubtotal > 0
                      ? formatPrice(coupon.minSubtotal)
                      : 'None'}
                  </td>
                  <td>
                    {coupon.timesUsed || 0}
                    {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
                    {coupon.isUsed ? ' (Used)' : ''}
                  </td>
                  <td>
                    <span
                      className={coupon.isActive ? styles.statusActive : styles.statusInactive}
                    >
                      {coupon.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.toggleBtn}
                      onClick={() => handleToggleActive(coupon)}
                    >
                      {coupon.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(coupon)}
                    >
                      Delete
                    </button>
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
