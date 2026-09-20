'use client';

import React, { useState } from 'react';
import { useNetworkStatus } from '@/context/NetworkStatusContext';
import styles from './NetworkStatusPill.module.css';

export default function NetworkStatusPill() {
  const { status, checkConnection } = useNetworkStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetryClick() {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await checkConnection();
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  }

  const getDotClass = () => {
    switch (status) {
      case 'back_online':
        return styles.dotBackOnline;
      case 'offline':
        return styles.dotOffline;
      case 'degraded':
        return styles.dotDegraded;
      case 'online':
      default:
        return styles.dotOnline;
    }
  };

  const getPillVariantClass = () => {
    switch (status) {
      case 'back_online':
        return styles.back_online;
      case 'offline':
        return styles.offline;
      case 'degraded':
        return styles.degraded;
      case 'online':
      default:
        return styles.online;
    }
  };

  const getAriaLabel = () => {
    switch (status) {
      case 'offline':
        return 'Network connection offline. Some features and payment actions are paused. Click to retry connection.';
      case 'degraded':
        return 'Server backend unreachable. Retrying connection.';
      case 'back_online':
        return 'Network connection restored. You are back online.';
      case 'online':
      default:
        return 'Network connected. All services operational.';
    }
  };

  return (
    <aside
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <button
        type="button"
        onClick={handleRetryClick}
        className={`${styles.pill} ${getPillVariantClass()}`}
        aria-label={getAriaLabel()}
        title={status === 'offline' ? 'Click to re-check connection' : undefined}
      >
        <span className={`${styles.dot} ${getDotClass()}`} aria-hidden="true" />
        
        <div className={styles.textGroup}>
          <div className={styles.mainLabel}>
            {status === 'offline' && <span>OFFLINE</span>}
            {status === 'back_online' && <span>BACK ONLINE</span>}
            {status === 'degraded' && <span>RECONNECTING</span>}
            {status === 'online' && <span>ONLINE</span>}

            {status === 'offline' && (
              <span className={styles.retryText} aria-hidden="true">
                {isRetrying ? '• RETRYING...' : '• RETRY'}
              </span>
            )}
          </div>

          {status === 'offline' && (
            <span className={styles.subLabel}>
              Some features unavailable
            </span>
          )}

          {status === 'degraded' && (
            <span className={styles.subLabelDegraded}>
              Checking server health...
            </span>
          )}
        </div>
      </button>
    </aside>
  );
}
