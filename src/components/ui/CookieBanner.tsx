'use client';

import React from 'react';
import Link from 'next/link';
import { useCookieConsent } from '@/context/CookieConsentContext';
import styles from './CookieBanner.module.css';

export default function CookieBanner() {
  const { isBannerOpen, acceptAll, rejectNonEssential, openPreferences } = useCookieConsent();

  if (!isBannerOpen) return null;

  return (
    <aside
      className={styles.bannerContainer}
      role="region"
      aria-label="Cookie Consent Notice"
    >
      <div className={styles.bannerCard}>
        <div className={styles.content}>
          <div className={styles.headerRow}>
            <h2 className={styles.title}>COOKIES</h2>
          </div>
          <p className={styles.description}>
            We use essential cookies to keep GERKINK working. With your permission, we may also use optional cookies for analytics and other features.{' '}
            <Link href="/privacy" className={styles.privacyLink}>
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={rejectNonEssential}
            className={styles.btnReject}
            aria-label="Reject non-essential cookies"
          >
            REJECT NON-ESSENTIAL
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className={styles.btnAccept}
            aria-label="Accept all cookies"
          >
            ACCEPT ALL
          </button>
          <button
            type="button"
            onClick={openPreferences}
            className={styles.btnPreferences}
            aria-label="Manage cookie preferences"
          >
            MANAGE PREFERENCES
          </button>
        </div>
      </div>
    </aside>
  );
}
