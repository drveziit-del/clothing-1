'use client';

import { useEffect } from 'react';
import { useRoast } from '@/hooks/useRoast';
import styles from './RoastToast.module.css';

// Singleton toast store – components can call window.__gerkinkToast
export default function RoastToast() {
  const { toasts, dismiss } = useRoast();

  // Expose toast fn globally so non-React code can trigger toasts
  useEffect(() => {
    // No-op: toasts are managed through useRoast hook
  }, []);

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]}`}
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.icon}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : '★'}
          </span>
          <span className={styles.message}>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className={styles.close}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
