'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/lib/utils/useFocusTrap';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import styles from './DeleteAccountModal.module.css';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  firebaseUser: any;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  userEmail,
  firebaseUser,
}: DeleteAccountModalProps) {
  const overlayRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const { isOnline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauthenticatedToken, setReauthenticatedToken] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isGoogleUser = Boolean(
    firebaseUser?.providerData?.some((p: any) => p.providerId === 'google.com')
  );

  const isDeleteEnabled =
    confirmationInput.trim() === 'DELETE' &&
    (isGoogleUser ? Boolean(reauthenticatedToken) : Boolean(password.trim())) &&
    !loading &&
    isOnline;

  async function handleGoogleReauth() {
    if (!isOnline) {
      setError('Cannot re-authenticate while offline. Please check your network connection.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { GoogleAuthProvider, reauthenticateWithPopup } =
        require('firebase/auth') as typeof import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await reauthenticateWithPopup(firebaseUser, provider);
      const freshToken = await firebaseUser.getIdToken(true);
      setReauthenticatedToken(freshToken);
    } catch (err: any) {
      console.warn('[DeleteModal] Google reauth failed:', err);
      setError(err?.message || 'Google re-authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) {
      setError('Cannot delete account while offline. Please check your network connection.');
      return;
    }
    if (!isDeleteEnabled) return;

    setError(null);
    setLoading(true);

    try {
      let freshIdToken = reauthenticatedToken;

      // For email/password accounts, reauthenticate with credential now
      if (!isGoogleUser) {
        const { EmailAuthProvider, reauthenticateWithCredential } =
          require('firebase/auth') as typeof import('firebase/auth');
        const cred = EmailAuthProvider.credential(userEmail, password);
        await reauthenticateWithCredential(firebaseUser, cred);
        freshIdToken = await firebaseUser.getIdToken(true);
      }

      if (!freshIdToken) {
        throw new Error('Recent reauthentication is required to verify account ownership.');
      }

      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: confirmationInput.trim(),
          idToken: freshIdToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account. Please try again.');
      }

      // Clear client-side stored preferences & shopping cart
      try {
        localStorage.removeItem('gerkink_cart');
        localStorage.removeItem('gerkink_currency');
        sessionStorage.clear();
      } catch {
        // non-fatal
      }

      // Hard redirect to login page with deletion confirmation
      window.location.href = '/auth/login?deleted=true';
    } catch (err: any) {
      console.error('[DeleteAccountModal] Error during account deletion:', err);
      setError(err.message || 'An error occurred while deleting your account.');
      setLoading(false);
    }
  }

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.warningIcon} aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <h2 id="delete-dialog-title" className={styles.title}>
              Delete My Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            disabled={loading}
            aria-label="Close deletion dialog"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleDeleteSubmit} className={styles.form}>
          <div className={styles.body}>
            <div className={styles.dangerAlert}>
              <div className={styles.dangerAlertTitle}>
                <span>⚠️ Permanent &amp; Irreversible Action</span>
              </div>
              <p id="delete-dialog-desc" style={{ margin: 0, fontSize: '0.85rem' }}>
                Deleting your account permanently revokes your authentication profile, deletes your encrypted payout
                credentials, and removes your custom design concept uploads.
              </p>
              <ul className={styles.policyList}>
                <li><strong>Deleted:</strong> Profile data, avatar media, encrypted bank details, promo coupons.</li>
                <li><strong>Anonymized:</strong> Product reviews and affiliate milestone records (identity detached).</li>
                <li><strong>Retained:</strong> Historical tax, order, and payment ledgers (personal association removed).</li>
              </ul>
            </div>

            {!isOnline && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(255, 77, 77, 0.12)',
                border: '1px solid rgba(255, 77, 77, 0.35)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#ff6b6b',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: '1rem',
              }}>
                <span>🔴</span>
                <span>Offline: Account deletion is paused until your network connection is restored.</span>
              </div>
            )}

            {error && (
              <div className={styles.errorMessage} role="alert">
                {error}
              </div>
            )}

            {/* Reauthentication Section */}
            {isGoogleUser ? (
              <div className={styles.formGroup}>
                <label className={styles.label}>1. Re-authenticate with Google</label>
                {reauthenticatedToken ? (
                  <div className={styles.reauthSuccess}>
                    <span>✓ Identity verified with Google</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleReauth}
                    disabled={loading}
                    className={styles.reauthBtn}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.1L1.9 16.1C3.7 19.8 7.5 23 12 23z"
                      />
                    </svg>
                    <span>Re-authenticate with Google</span>
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="delete-confirm-password" className={styles.label}>
                  1. Enter Your Current Password
                </label>
                <input
                  id="delete-confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Current password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className={styles.input}
                />
              </div>
            )}

            {/* Typed DELETE Confirmation */}
            <div className={styles.formGroup}>
              <label htmlFor="delete-confirm-text" className={styles.label}>
                2. Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="delete-confirm-text"
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE"
                required
                disabled={loading}
                autoComplete="off"
                className={styles.input}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isDeleteEnabled}
              className={styles.deleteBtn}
              aria-disabled={!isDeleteEnabled}
              style={!isOnline ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              {loading ? 'Deleting Account...' : !isOnline ? 'Offline — Reconnect to Delete' : 'Permanently Delete Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
