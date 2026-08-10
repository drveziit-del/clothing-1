'use client';

import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import { getFirestoreDb, getFirestoreModule, getFirebaseStorage, getStorageModule, getFirebaseAuth } from '@/lib/firebase/config';
import { useRoast } from '@/hooks/useRoast';
import styles from './page.module.css';
import type { Coupon, Referral, Order } from '@/types';

function formatFirestoreDate(timestamp: any, fallback = 'Today') {
  if (!timestamp) return fallback;
  const d = parseFirestoreDate(timestamp);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getTimestampTime(timestamp: any): number {
  if (!timestamp) return 0;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseFirestoreDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? new Date() : timestamp;
  if (typeof timestamp.toDate === 'function') {
    try {
      const d = timestamp.toDate();
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }
  if (typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp._seconds === 'number') {
    return new Date(timestamp._seconds * 1000);
  }
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? new Date() : date;
}

export default function AccountPage() {
  const { user, loading } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const { toast } = useRoast();
  const [copied, setCopied] = useState(false);

  // Firestore Subscriptions
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Claim State
  const [claiming, setClaiming] = useState(false);
  const [claimType, setClaimType] = useState<'refund' | 'coupon' | 'wise' | 'paypal' | 'bank'>('coupon');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payouts' | 'analytics' | 'rewards' | 'profile'>('dashboard');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');

  // Profile Settings State
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '');
      setProfilePhotoUrl(user.photoURL || '');
    }
  }, [user]);

  // Payout Preferences State
  const [payoutPrefs, setPayoutPrefs] = useState<any>(null);
  const [prefMethod, setPrefMethod] = useState<'wise' | 'paypal' | 'bank'>('wise');
  const [prefEmail, setPrefEmail] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');
  const [bankAccountType, setBankAccountType] = useState<'checking' | 'savings'>('checking');
  const [bankEmail, setBankEmail] = useState('');
  const [bankCountry, setBankCountry] = useState('United States');
  const [bankCity, setBankCity] = useState('');
  const [bankStreetAddress, setBankStreetAddress] = useState('');
  const [bankState, setBankState] = useState('');
  const [bankZipCode, setBankZipCode] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login?redirect=/account');
  }, [user, loading, router]);

  // Subscribe to Coupons
  useEffect(() => {
    if (!user) return;
    const { collection, query, where, onSnapshot } = getFirestoreModule();
    const db = getFirestoreDb();
    const q = query(
      collection(db, 'coupons'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Coupon[];
        setCoupons(list);
      },
      (error) => {
        console.warn('Coupons subscription error:', error);
      }
    );
    return () => unsub();
  }, [user]);

  // Subscribe to Referrals
  useEffect(() => {
    if (!user) return;
    const { collection, query, where, onSnapshot } = getFirestoreModule();
    const db = getFirestoreDb();
    const q = query(
      collection(db, 'referrals'),
      where('affiliateUid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Referral[];
        setReferrals(list);
      },
      (error) => {
        console.warn('Referrals subscription error:', error);
      }
    );
    return () => unsub();
  }, [user]);

  // Subscribe to Orders
  useEffect(() => {
    if (!user) return;
    const { collection, query, where, onSnapshot } = getFirestoreModule();
    const db = getFirestoreDb();
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('status', 'in', ['paid', 'in_production', 'shipped', 'delivered'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
        setOrders(list);

        // Safely set defaults inside subscription callback to avoid layout effect cascading renders
        const validRefundable = list.filter(o => {
          const refunded = o.referralRefundedAmount ?? 0;
          return o.total - refunded > 0;
        });

        if (validRefundable.length > 0) {
          setSelectedOrderId(current => {
            const exists = validRefundable.some(o => o.id === current);
            return exists ? current : validRefundable[0].id;
          });
          setClaimType(current => current === 'coupon' ? 'refund' : current);
        } else {
          setClaimType('coupon');
        }
      },
      (error) => {
        console.warn('Orders subscription error:', error);
      }
    );
    return () => unsub();
  }, [user]);

  // Load payout preferences on mount
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/payout-profile')
      .then(res => res.json())
      .then(data => {
        if (data.payoutPreferences) {
          const p = data.payoutPreferences;
          setPayoutPrefs(p);
          setPrefMethod(p.method);
          if (p.method === 'wise' || p.method === 'paypal') {
            setPrefEmail(p.email || '');
          } else if (p.method === 'bank' && p.bankDetails) {
            setBankHolder(p.bankDetails.accountHolderName || '');
            setBankAccountNumber(p.bankDetails.accountNumber || '');
            setBankRoutingNumber(p.bankDetails.routingNumber || '');
            setBankAccountType(p.bankDetails.accountType || 'checking');
            setBankEmail(p.bankDetails.email || '');
            setBankCountry(p.bankDetails.country || 'United States');
            setBankCity(p.bankDetails.city || '');
            setBankStreetAddress(p.bankDetails.streetAddress || '');
            setBankState(p.bankDetails.state || '');
            setBankZipCode(p.bankDetails.zipCode || '');
          }
        }
      })
      .catch(err => console.error('Error loading payout profile:', err));
  }, [user]);

  // Filter orders with remaining refundable balance
  const refundableOrders = useMemo(() => {
    return orders.filter(o => {
      const refunded = o.referralRefundedAmount ?? 0;
      return o.total - refunded > 0;
    });
  }, [orders]);

  const filteredReferrals = useMemo(() => {
    if (timeRange === 'all') return referrals;
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return referrals.filter(r => {
      const d = parseFirestoreDate(r.createdAt);
      return d >= cutoff;
    });
  }, [referrals, timeRange]);

  const totalReferredRevenue = useMemo(() => {
    return filteredReferrals.reduce((sum, r) => sum + (r.orderValue || 0), 0);
  }, [filteredReferrals]);

  const aov = useMemo(() => {
    return filteredReferrals.length > 0 ? totalReferredRevenue / filteredReferrals.length : 0;
  }, [filteredReferrals, totalReferredRevenue]);

  const clicks = user?.linkClicks ?? 0;
  const conversions = filteredReferrals.length;

  const calcRate = useMemo(() => {
    if (clicks > 0) {
      return Math.min(100, (conversions / clicks) * 100).toFixed(1);
    }
    return conversions > 0 ? '100.0' : '0.0';
  }, [clicks, conversions]);

  const chartDataPoints = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    filteredReferrals.forEach(r => {
      const d = parseFirestoreDate(r.createdAt);
      const key = d.toISOString().split('T')[0];
      const existing = map.get(key) || { revenue: 0, count: 0 };
      map.set(key, {
        revenue: existing.revenue + (r.orderValue || 0),
        count: existing.count + 1
      });
    });

    const now = new Date();
    const daysToShow = timeRange === '7d' ? 7 : timeRange === '30d' ? 14 : timeRange === '90d' ? 30 : 7;
    const result = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      const monthDay = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      const entry = map.get(key) || { revenue: 0, count: 0 };
      result.push({
        label: monthDay,
        revenue: entry.revenue,
        count: entry.count
      });
    }
    return result;
  }, [filteredReferrals, timeRange]);


  if (loading || !user) {
    return (
      <div className={styles.loading}>
        <span>Loading your stats...</span>
      </div>
    );
  }

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${user.referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    toast(`Copied code: ${code}`, 'success');
  };

  const nextMilestone = Math.ceil((user.referralCount + 1) / 10) * 10;
  const toNext = nextMilestone - user.referralCount;

  // Calculate available balance in wallet summing (commission - commissionClaimed)
  const availableBalance = referrals
    .filter(r => r.status === 'eligible_for_claim')
    .reduce((sum, r) => sum + (r.commission - (r.commissionClaimed || 0)), 0);
  const hasReward = availableBalance > 0;

  async function handleClaimReward() {
    setClaiming(true);
    try {
      let claimAmountNum: number | undefined = undefined;
      if (claimType !== 'refund') {
        const parsed = Number(claimAmount);
        if (!claimAmount || isNaN(parsed) || parsed <= 0) {
          throw new Error('Please enter a valid payout claim amount');
        }
        if (parsed > availableBalance) {
          throw new Error('Insufficient balance in referral wallet');
        }
        claimAmountNum = parsed;
      }

      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimType,
          requestedAmount: claimAmountNum,
          orderId: claimType === 'refund' ? selectedOrderId : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Claim failed');
      }

      const data = await res.json();
      if (data.method === 'refund') {
        toast(`Successfully refunded $${data.refundAmount}!`, 'success');
      } else if (data.method === 'coupon') {
        toast(`$${data.amount} coupon issued: ${data.couponCode}`, 'success');
        setClaimAmount('');
      } else {
        toast(`Payout request submitted! ID: ${data.payoutRequestId}`, 'success');
        setClaimAmount('');
      }
    } catch (err: any) {
      toast(err.message || 'Error processing claim', 'error');
    } finally {
      setClaiming(false);
    }
  }

  async function handleSavePayoutPrefs(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const body: any = { method: prefMethod };
      if (prefMethod === 'wise' || prefMethod === 'paypal') {
        if (!prefEmail || !prefEmail.includes('@')) {
          throw new Error('Please enter a valid payout email address');
        }
        body.email = prefEmail;
      } else {
        if (
          !bankHolder || 
          !bankRoutingNumber || 
          !bankAccountNumber || 
          !bankAccountType || 
          !bankCountry || 
          !bankCity || 
          !bankStreetAddress || 
          !bankState || 
          !bankZipCode
        ) {
          throw new Error('All bank account and address details are required');
        }
        body.bankDetails = {
          accountHolderName: bankHolder,
          routingNumber: bankRoutingNumber,
          accountNumber: bankAccountNumber,
          accountType: bankAccountType,
          email: bankEmail || '',
          country: bankCountry,
          city: bankCity,
          streetAddress: bankStreetAddress,
          state: bankState,
          zipCode: bankZipCode
        };
      }

      const res = await fetch('/api/user/payout-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      toast('Payout preferences saved successfully!', 'success');
      // Reload local prefs state
      setPayoutPrefs(body);
    } catch (err: any) {
      toast(err.message || 'Failed to save payout settings', 'error');
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Image size must be less than 2MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { ref, uploadBytes, getDownloadURL } = getStorageModule();
      const storage = getFirebaseStorage();
      const fileRef = ref(storage, `users/${user.uid}/profile_${Date.now()}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setProfilePhotoUrl(downloadURL);
      toast('Photo uploaded successfully! Save profile to commit changes.', 'success');
    } catch (err: any) {
      toast(err.message || 'Error uploading image', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!profileName.trim()) {
      toast('Name cannot be empty', 'error');
      return;
    }

    setUpdatingProfile(true);
    try {
      // 1. Update Password if entered
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        const { updatePassword } = require('firebase/auth') as typeof import('firebase/auth');
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        } else {
          throw new Error('Not logged into Firebase Auth');
        }
      }

      // 2. Update Firebase Auth Profile (DisplayName and PhotoURL)
      const { updateProfile } = require('firebase/auth') as typeof import('firebase/auth');
      const auth = getFirebaseAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: profileName.trim(),
          photoURL: profilePhotoUrl || null
        });
      }

      // 3. Update Firestore User Document
      const { doc, updateDoc } = getFirestoreModule();
      const db = getFirestoreDb();
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileName.trim(),
        photoURL: profilePhotoUrl || null,
      });

      setNewPassword('');
      setConfirmPassword('');

      toast('Profile updated successfully!', 'success');
    } catch (err: any) {
      console.error('Profile update error:', err);
      if (err.code === 'auth/requires-recent-login') {
        toast('Please log out and log back in to change your password.', 'error');
      } else {
        toast(err.message || 'Error updating profile', 'error');
      }
    } finally {
      setUpdatingProfile(false);
    }
  }



  const handleExportCSV = () => {
    if (referrals.length === 0) {
      toast('No referral data to export', 'error');
      return;
    }
    const headers = ['Referral ID', 'Order ID', 'Order Value ($)', 'Created At'];
    const rows = referrals.map(r => [
      r.id,
      r.orderId || '',
      (r.orderValue || 0).toFixed(2),
      parseFirestoreDate(r.createdAt).toISOString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gerkink_analytics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Analytics report exported as CSV!', 'success');
  };

  // ─── Tab Rendering Helpers ────────────────────────────────────────────────

  const renderDashboardTab = () => (
    <div className={styles.tabView}>
      <div className={styles.header}>
        <h1 className="text-display">Welcome back{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h1>
        <p className={styles.subhead}>Your style is improving. Marginally.</p>
      </div>

      <div className={styles.grid}>
        {/* Stats */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Your Stats</h2>
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span className={styles.statVal}>{user.referralCount}</span>
              <span className={styles.statLabel}>Referrals</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal}>${user.totalEarnings.toLocaleString()}</span>
              <span className={styles.statLabel}>Earned</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal}>{toNext}</span>
              <span className={styles.statLabel}>Until next $100</span>
            </div>
          </div>

          {/* Progress bar to next milestone */}
          <div className={styles.progressWrap}>
            <span className={styles.progressLabel}>Progress to next commission</span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${((10 - toNext) / 10) * 100}%` }}
              />
            </div>
            <span className={styles.progressHint}>{user.referralCount % 10} / 10 referrals</span>
          </div>
        </section>

        {/* Referral */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Referral Link</h2>
          <p className={styles.cardDesc}>
            Share this link. Every 10 people who buy after clicking it earns you $100.
            The 100,000th customer globally earns you $100,000.
          </p>
          <div className={styles.referralBox}>
            <span className={styles.referralCode}>{user.referralCode}</span>
            <div className={styles.referralLink}>
              <span>{referralLink}</span>
              <button onClick={copyLink} className={`btn btn-secondary btn-sm ${styles.copyBtn}`}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </section>

        {/* Profile */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Profile</h2>
          <div className={styles.profileRows}>
            <div className={styles.profileRow}>
              <span className={styles.profileKey}>Name</span>
              <span className={styles.profileVal}>{user.displayName}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileKey}>Email</span>
              <span className={styles.profileVal}>{user.email}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileKey}>Role</span>
              <span className={`tag ${user.role === 'admin' ? 'tag-mist' : ''}`}>{user.role}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const renderPayoutsTab = () => (
    <div className={styles.tabView}>
      <div className={styles.header}>
        <h1 className="text-display">Payout Settings</h1>
        <p className={styles.subhead}>Save your preference for manual cash commissions (Wise, PayPal, or Bank).</p>
      </div>

      <div style={{ maxWidth: '600px' }}>
        {/* Payout Settings Form */}
        <section className={styles.card}>
          <form onSubmit={handleSavePayoutPrefs}>
            <div className={styles.prefMethodSelector}>
              <button
                type="button"
                onClick={() => setPrefMethod('wise')}
                className={`${styles.prefMethodTab} ${prefMethod === 'wise' ? styles.prefMethodTabActive : ''}`}
              >
                Wise Email
              </button>
              <button
                type="button"
                onClick={() => setPrefMethod('paypal')}
                className={`${styles.prefMethodTab} ${prefMethod === 'paypal' ? styles.prefMethodTabActive : ''}`}
              >
                PayPal Email
              </button>
              <button
                type="button"
                onClick={() => setPrefMethod('bank')}
                className={`${styles.prefMethodTab} ${prefMethod === 'bank' ? styles.prefMethodTabActive : ''}`}
              >
                Bank Transfer
              </button>
            </div>

            {(prefMethod === 'wise' || prefMethod === 'paypal') ? (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{prefMethod.toUpperCase()} Email Address</label>
                <input
                  type="email"
                  value={prefEmail}
                  onChange={(e) => setPrefEmail(e.target.value)}
                  placeholder="name@email.com"
                  required
                  className={styles.formInput}
                />
              </div>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Their email (optional)</label>
                  <input
                    type="email"
                    value={bankEmail}
                    onChange={(e) => setBankEmail(e.target.value)}
                    placeholder="example@example.ex"
                    className={styles.formInput}
                  />
                </div>

                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                  Recipient&apos;s bank details
                </h3>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Full name of the account holder</label>
                  <input
                    type="text"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    placeholder="Full Name"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Routing number</label>
                  <input
                    type="text"
                    value={bankRoutingNumber}
                    onChange={(e) => setBankRoutingNumber(e.target.value)}
                    placeholder="021000021"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Account number</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Account type</label>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="radio"
                        name="bankAccountType"
                        value="checking"
                        checked={bankAccountType === 'checking'}
                        onChange={() => setBankAccountType('checking')}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      Checking
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="radio"
                        name="bankAccountType"
                        value="savings"
                        checked={bankAccountType === 'savings'}
                        onChange={() => setBankAccountType('savings')}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      Savings
                    </label>
                  </div>
                </div>

                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: '2rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                  Their home address
                </h3>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Country</label>
                  <select
                    value={bankCountry}
                    onChange={(e) => setBankCountry(e.target.value)}
                    className={styles.formInput}
                    style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '4px', width: '100%', WebkitAppearance: 'none' }}
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="India">India</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>City</label>
                  <input
                    type="text"
                    value={bankCity}
                    onChange={(e) => setBankCity(e.target.value)}
                    placeholder="City"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Recipient address</label>
                  <input
                    type="text"
                    value={bankStreetAddress}
                    onChange={(e) => setBankStreetAddress(e.target.value)}
                    placeholder="Street Name, Apt/Suite"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>State</label>
                  <input
                    type="text"
                    value={bankState}
                    onChange={(e) => setBankState(e.target.value)}
                    placeholder="State/Province"
                    required
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>ZIP code</label>
                  <input
                    type="text"
                    value={bankZipCode}
                    onChange={(e) => setBankZipCode(e.target.value)}
                    placeholder="ZIP / Postal Code"
                    required
                    className={styles.formInput}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={savingPrefs}
              className={`btn btn-secondary ${styles.savePrefsBtn}`}
              style={{ marginTop: '1.5rem' }}
            >
              {savingPrefs ? 'Saving Preferences...' : 'Save Payout Details'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );

  const renderAnalyticsTab = () => {
    const svgW = 600;
    const svgH = 160;
    const pad = 25;
    const maxVal = Math.max(...chartDataPoints.map(p => p.revenue), 50);

    const pts = chartDataPoints.map((pt, i) => {
      const x = pad + (i / Math.max(1, chartDataPoints.length - 1)) * (svgW - 2 * pad);
      const y = svgH - pad - (pt.revenue / maxVal) * (svgH - 2 * pad);
      return { x, y, ...pt };
    });

    const linePath = pts.length > 0 
      ? pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
      : '';

    const areaPath = pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x} ${svgH - pad} L ${pts[0].x} ${svgH - pad} Z`
      : '';

    const checkoutCount = conversions > 0 ? conversions + 1 : (clicks > 0 ? 1 : 0);
    const maxFunnel = Math.max(clicks, checkoutCount, conversions, 1);

    const clickFunnelWidth = `${(clicks / maxFunnel) * 100}%`;
    const checkoutFunnelWidth = `${(checkoutCount / maxFunnel) * 100}%`;
    const convFunnelWidth = `${(conversions / maxFunnel) * 100}%`;

    return (
      <div className={styles.tabView}>
        <div className={styles.analyticsHeader}>
          <div>
            <h1 className="text-display">Traffic & Revenue Analytics</h1>
            <p className={styles.subhead}>Real-time breakdown of your traffic, conversions, and store revenue performance.</p>
          </div>

          <div className={styles.analyticsActions}>
            <div className={styles.timeFilterGroup}>
              {(['7d', '30d', '90d', 'all'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`${styles.timeBtn} ${timeRange === t ? styles.activeTimeBtn : ''}`}
                >
                  {t === 'all' ? 'All Time' : t.toUpperCase()}
                </button>
              ))}
            </div>

            <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
              📥 Export Report (CSV)
            </button>
          </div>
        </div>

        {/* Top 6 KPI Metric Cards */}
        <div className={styles.analyticsGrid6}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Link Clicks</span>
              <span className={styles.kpiBadge}>Traffic</span>
            </div>
            <span className={styles.kpiVal}>{clicks}</span>
            <span className={styles.kpiSub}>Total referral visits</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Sales (Conversions)</span>
              <span className={styles.kpiBadge}>Orders</span>
            </div>
            <span className={styles.kpiVal}>{conversions}</span>
            <span className={styles.kpiSub}>Paid referred orders</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Conversion Rate</span>
              <span className={styles.kpiBadge}>CR %</span>
            </div>
            <span className={styles.kpiVal}>{calcRate}%</span>
            <span className={styles.kpiSub}>Clicks to sales ratio</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Revenue Driven</span>
              <span className={styles.kpiBadge}>Gross</span>
            </div>
            <span className={styles.kpiVal}>${totalReferredRevenue.toFixed(2)}</span>
            <span className={styles.kpiSub}>Total referred store volume</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Average Order (AOV)</span>
              <span className={styles.kpiBadge}>Basket</span>
            </div>
            <span className={styles.kpiVal}>${aov.toFixed(2)}</span>
            <span className={styles.kpiSub}>Average cart value</span>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHead}>
              <span className={styles.kpiLabel}>Total Earned</span>
              <span className={styles.kpiBadge}>Payouts</span>
            </div>
            <span className={styles.kpiVal}>${user.totalEarnings.toFixed(2)}</span>
            <span className={styles.kpiSub}>Commission & rewards</span>
          </div>
        </div>

        {/* Interactive Charts Section */}
        <div className={styles.chartsGrid}>
          {/* Revenue Trend Area Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitleRow}>
              <div>
                <h3 className={styles.chartCardTitle}>Revenue Growth Curve</h3>
                <span className={styles.chartSub}>Daily referred sales volume ($)</span>
              </div>
            </div>

            <div className={styles.svgChartWrapper}>
              <svg className={styles.svgChart} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3fb950" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3fb950" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Area Fill */}
                {pts.length > 0 && <path d={areaPath} fill="url(#areaGrad)" />}

                {/* Line Path */}
                {pts.length > 0 && <path d={linePath} fill="none" stroke="#3fb950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                {/* Data Points */}
                {pts.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r={p.revenue > 0 ? "5" : "3"} fill="#3fb950" stroke="#0e1117" strokeWidth="2" />
                    {p.revenue > 0 && (
                      <text x={p.x} y={p.y - 10} fontSize="10" fontWeight="bold" fill="#3fb950" textAnchor="middle">
                        ${p.revenue.toFixed(0)}
                      </text>
                    )}
                    <text x={p.x} y={svgH - 4} fontSize="9" fill="#8b949e" textAnchor="middle">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitleRow}>
              <div>
                <h3 className={styles.chartCardTitle}>Conversion Funnel</h3>
                <span className={styles.chartSub}>Drop-off across buyer stages</span>
              </div>
            </div>

            <div className={styles.funnelList}>
              <div className={styles.funnelStep}>
                <div className={styles.funnelMeta}>
                  <span className={styles.funnelStepName}>1. Referral Link Clicks</span>
                  <span className={styles.funnelStepVal}>{clicks}</span>
                </div>
                <div className={styles.funnelTrack}>
                  <div className={styles.funnelFill} style={{ width: clickFunnelWidth, background: '#38bdf8' }} />
                </div>
              </div>

              <div className={styles.funnelStep}>
                <div className={styles.funnelMeta}>
                  <span className={styles.funnelStepName}>2. Checkout Intent</span>
                  <span className={styles.funnelStepVal}>{conversions > 0 ? conversions + 1 : 0}</span>
                </div>
                <div className={styles.funnelTrack}>
                  <div className={styles.funnelFill} style={{ width: checkoutFunnelWidth, background: '#a855f7' }} />
                </div>
              </div>

              <div className={styles.funnelStep}>
                <div className={styles.funnelMeta}>
                  <span className={styles.funnelStepName}>3. Paid Conversions</span>
                  <span className={styles.funnelStepVal}>{conversions}</span>
                </div>
                <div className={styles.funnelTrack}>
                  <div className={styles.funnelFill} style={{ width: convFunnelWidth, background: '#3fb950' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Referrals Activity Table */}
        <section className={styles.tableSection}>
          <div className={styles.chartTitleRow}>
            <div>
              <h3 className={styles.chartCardTitle}>Referred Orders Breakdown</h3>
              <span className={styles.chartSub}>Complete log of orders generated by your referral code</span>
            </div>
          </div>

          {filteredReferrals.length === 0 ? (
            <div className={styles.emptyAnalytics}>
              No referred orders recorded for this time range. Share your referral link to start earning!
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.analyticsTable}>
                <thead>
                  <tr>
                    <th>Referral ID</th>
                    <th>Order ID</th>
                    <th>Order Subtotal</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map((refItem) => {
                    const dateStr = formatFirestoreDate(refItem.createdAt);
                    return (
                      <tr key={refItem.id}>
                        <td className={styles.mono}>{refItem.id}</td>
                        <td className={styles.mono}>{refItem.orderId}</td>
                        <td className={styles.mono}>${(refItem.orderValue || 0).toFixed(2)}</td>
                        <td>{dateStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderRewardsTab = () => (
    <div className={styles.tabView}>
      <div className={styles.header}>
        <h1 className="text-display">My Rewards</h1>
        <p className={styles.subhead}>Claim your earned payout and manage your discount coupons.</p>
      </div>

      {/* Claim Rewards Banner inside rewards view */}
      {hasReward && (
        <section className={styles.claimBanner}>
          <div className={styles.claimHeader}>
            <h2 className={styles.claimTitle}>Available Wallet Balance: {formatPrice(availableBalance)}</h2>
            <p className={styles.claimSub}>Select a method and input the amount you want to claim from your wallet.</p>
          </div>

          <div className={styles.claimOptions}>
            {refundableOrders.length > 0 ? (
              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  <input
                    type="radio"
                    name="claimType"
                    value="refund"
                    checked={claimType === 'refund'}
                    onChange={() => setClaimType('refund')}
                  />
                  <span>Refund to past purchase (Recommended)</span>
                </label>

                {claimType === 'refund' && (
                  <div className={styles.orderSelectBox}>
                    <span className={styles.selectHint}>Select which order to refund (refund amount will automatically match order value or available balance):</span>
                    {refundableOrders.map(order => {
                      const refunded = order.referralRefundedAmount ?? 0;
                      const remaining = order.total - refunded;
                      const dateStr = formatFirestoreDate(order.createdAt, 'Recent');
                      return (
                        <label key={order.id} className={styles.orderOption}>
                          <input
                            type="radio"
                            name="selectedOrderId"
                            value={order.id}
                            checked={selectedOrderId === order.id}
                            onChange={() => setSelectedOrderId(order.id)}
                          />
                          <span className={styles.orderOptionText}>
                            Order #{order.id.slice(-6)} — Total: {formatPrice(order.total)} (Remaining: {formatPrice(remaining)}) — Paid: {dateStr}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className={styles.noRefundsNote}>
                No recent orders found to refund back to. Payout will fallback to Store Credit or Direct Payout.
              </p>
            )}

            <div className={styles.optionGroup}>
              <label className={styles.optionLabel}>
                <input
                  type="radio"
                  name="claimType"
                  value="coupon"
                  checked={claimType === 'coupon'}
                  onChange={() => setClaimType('coupon')}
                />
                <span>Claim Store Discount Coupon</span>
              </label>
            </div>

            {/* Direct Payout Preference Options */}
            {payoutPrefs ? (
              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  <input
                    type="radio"
                    name="claimType"
                    value={payoutPrefs.method}
                    checked={['wise', 'paypal', 'bank'].includes(claimType)}
                    onChange={() => setClaimType(payoutPrefs.method)}
                  />
                  <span>
                    Claim Cash via {payoutPrefs.method.toUpperCase()} 
                    {payoutPrefs.method === 'bank' 
                      ? ` (${payoutPrefs.bankDetails?.bankName || 'Direct'} - ${payoutPrefs.bankDetails?.accountHolderName})` 
                      : ` (${payoutPrefs.email})`}
                  </span>
                </label>

                {['wise', 'bank'].includes(claimType) && (
                  <div className={styles.feeNotice}>
                    ⚠️ <strong>Notice:</strong> Processing and third-party transfer fees will be deducted directly from the final payout amount.
                  </div>
                )}
              </div>
            ) : (
              <p className={styles.noRefundsNote}>
                Configure Payout Settings to unlock direct cash payouts (Wise, PayPal, or Bank).
              </p>
            )}

            {/* Flexible Payout Amount Input */}
            {claimType !== 'refund' && (
              <div className={styles.formGroup} style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <label className={styles.formLabel}>Amount to Claim ($ USD)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  max={availableBalance}
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  placeholder={`Max ${formatPrice(availableBalance)}`}
                  required
                  className={styles.formInput}
                />
                {claimAmount && (Number(claimAmount) > availableBalance || Number(claimAmount) <= 0) && (
                  <p style={{ color: 'var(--accent)', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                    ⚠️ Security Warning: You cannot claim more than your available wallet balance of {formatPrice(availableBalance)}.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleClaimReward}
            disabled={
              claiming || 
              (claimType === 'refund' && !selectedOrderId) || 
              (claimType !== 'refund' && (!claimAmount || isNaN(Number(claimAmount)) || Number(claimAmount) <= 0 || Number(claimAmount) > availableBalance)) || 
              (['wise', 'paypal', 'bank'].includes(claimType) && !payoutPrefs)
            }
            className={`btn btn-primary ${styles.claimBtn}`}
            style={{ marginTop: '1.5rem' }}
          >
            {claiming ? 'Processing Payout...' : claimType === 'refund' ? 'Claim Refund →' : `Claim ${formatPrice(Number(claimAmount || 0))} →`}
          </button>
        </section>
      )}

      {/* Coupons List */}
      {coupons.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Available Coupons</h2>
          <p className={styles.cardDesc}>Copy these codes and enter them at checkout for store credit.</p>
          <div className={styles.couponsList}>
            {coupons.map(coupon => (
              <div key={coupon.id} className={`${styles.couponItem} ${coupon.isUsed ? styles.couponUsed : ''}`}>
                <div className={styles.couponInfo}>
                  <span className={styles.couponCodeText}>{coupon.code}</span>
                  <span className={styles.couponValueText}>Value: {formatPrice(coupon.value)}</span>
                </div>
                <div className={styles.couponAction}>
                  {coupon.isUsed ? (
                    <span className={styles.usedBadge}>Redeemed</span>
                  ) : (
                    <button
                      onClick={() => copyCoupon(coupon.code)}
                      className="btn btn-secondary btn-sm"
                    >
                      Copy Code
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Referral Rewards History */}
      {referrals.some(r => r.commission > 0) && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Referral Payout History</h2>
          <div className={styles.tableResponsive}>
            <table className={styles.payoutTable}>
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Payout Method</th>
                  <th>Payout Detail</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals
                  .filter(r => r.commission > 0)
                  .sort((a, b) => getTimestampTime(b.createdAt) - getTimestampTime(a.createdAt))
                  .map((ref, idx, filteredList) => {
                    const milestoneNum = (filteredList.length - idx) * 10;
                    const dateStr = formatFirestoreDate(ref.createdAt, 'N/A');
                    return (
                      <tr key={ref.id}>
                        <td>{milestoneNum} Referrals</td>
                        <td style={{ textTransform: 'capitalize' }}>{ref.payoutMethod || 'N/A'}</td>
                        <td className={styles.detailCell}>{ref.payoutDetail || 'Processing...'}</td>
                        <td>{dateStr}</td>
                        <td>
                          <span className={`tag ${
                            ref.status === 'claimed' || ref.status === 'credited' ? 'tag-mist' : 'tag-coral'
                          }`}>
                            {ref.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );

  const renderProfileTab = () => (
    <div className={styles.tabView}>
      <div className={styles.header}>
        <h1 className="text-display">Profile Settings</h1>
        <p className={styles.subhead}>Update your profile picture, display name, and password.</p>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <section className={styles.card}>
          <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Avatar Section */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Profile Picture</label>
              <div className={styles.avatarSection}>
                <div className={styles.avatarContainer}>
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Profile" className={styles.avatarImage} referrerPolicy="no-referrer" />
                  ) : (
                    profileName ? profileName.charAt(0).toUpperCase() : '?'
                  )}
                  <div className={styles.avatarOverlay} onClick={() => fileInputRef.current?.click()}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', textAlign: 'center' }}>
                      {uploadingPhoto ? '...' : 'Upload'}
                    </span>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? 'Uploading...' : 'Choose Image'}
                  </button>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Max 2MB. Jpeg, Png or WebP.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className={styles.avatarUploadInput}
                  />
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your Name"
                required
                className={styles.formInput}
              />
            </div>

            {/* Email (Disabled as requested) */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email Address (Cannot be changed)</label>
              <input
                type="email"
                value={user.email}
                disabled
                className={styles.formInput}
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              />
            </div>

            {/* Password Fields */}
            <div className={styles.profileGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password (Optional)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 chars"
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className={styles.formInput}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updatingProfile}
              className={`btn btn-secondary ${styles.savePrefsBtn}`}
              style={{ marginTop: '0.5rem' }}
            >
              {updatingProfile ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );

  // State-driven sidebar container rendering

  return (
    <div className={styles.page}>
      <div className={styles.layoutContainer}>
        {/* Sidebar Nav */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Affiliate Hub</span>
            <span className={styles.sidebarSubtitle}>Welcome, {user.displayName ? user.displayName.split(' ')[0] : 'Affiliate'}</span>
          </div>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`${styles.sidebarButton} ${activeTab === 'dashboard' ? styles.sidebarButtonActive : ''}`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`${styles.sidebarButton} ${activeTab === 'payouts' ? styles.sidebarButtonActive : ''}`}
          >
            ⚙️ Payout Settings
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`${styles.sidebarButton} ${activeTab === 'analytics' ? styles.sidebarButtonActive : ''}`}
          >
            📈 Analytics
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`${styles.sidebarButton} ${activeTab === 'rewards' ? styles.sidebarButtonActive : ''}`}
          >
            🎁 My Rewards {hasReward && <span className={styles.rewardsBadge}>!</span>}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`${styles.sidebarButton} ${activeTab === 'profile' ? styles.sidebarButtonActive : ''}`}
          >
            👤 Profile Settings
          </button>
        </aside>

        {/* Content Pane */}
        <main className={styles.mainContent}>
          {activeTab === 'dashboard' && renderDashboardTab()}
          {activeTab === 'payouts' && renderPayoutsTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
          {activeTab === 'rewards' && renderRewardsTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </main>
      </div>
    </div>
  );
}
