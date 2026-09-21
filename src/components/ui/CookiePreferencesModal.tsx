'use client';

import React, { useState, useEffect } from 'react';
import { useCookieConsent } from '@/context/CookieConsentContext';
import { useFocusTrap } from '@/lib/utils/useFocusTrap';
import styles from './CookiePreferencesModal.module.css';

export default function CookiePreferencesModal() {
  const {
    consent,
    isPreferencesOpen,
    closePreferences,
    savePreferences,
    acceptAll,
    rejectNonEssential,
  } = useCookieConsent();

  const [analytics, setAnalytics] = useState<boolean>(false);
  const [marketing, setMarketing] = useState<boolean>(false);
  const [functional, setFunctional] = useState<boolean>(false);

  // Sync internal modal state whenever modal opens or consent changes
  useEffect(() => {
    if (isPreferencesOpen) {
      setAnalytics(Boolean(consent?.analytics));
      setMarketing(Boolean(consent?.marketing));
      setFunctional(Boolean(consent?.functional));
    }
  }, [isPreferencesOpen, consent]);

  const modalRef = useFocusTrap<HTMLDivElement>(isPreferencesOpen, closePreferences);

  if (!isPreferencesOpen) return null;

  const handleSave = () => {
    savePreferences({ analytics, marketing, functional });
  };

  return (
    <div
      ref={modalRef}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === modalRef.current) closePreferences();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-preferences-title"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h2 id="cookie-preferences-title" className={styles.title}>
              COOKIE PREFERENCES
            </h2>
            <span className={styles.subtitle}>CUSTOMIZE YOUR PRIVACY SETTINGS</span>
          </div>
          <button
            type="button"
            onClick={closePreferences}
            className={styles.closeBtn}
            aria-label="Close cookie preferences modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* 1. Strictly Necessary */}
          <div className={styles.categoryCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>STRICTLY NECESSARY</h3>
              <span className={styles.alwaysActiveBadge}>ALWAYS ACTIVE</span>
            </div>
            <p className={styles.cardDescription}>
              Essential for core functionality including cryptographic session authentication, shopping cart retention, checkout routing, and Cloudflare DDoS/bot protection. These cannot be disabled.
            </p>
          </div>

          {/* 2. Analytics & Performance */}
          <div className={styles.categoryCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>ANALYTICS & PERFORMANCE</h3>
              <label className={styles.switchLabel}>
                <input
                  type="checkbox"
                  className={styles.switchInput}
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  aria-label="Toggle Analytics and Performance cookies"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>
            <p className={styles.cardDescription}>
              Allows us to collect anonymous, aggregated telemetry via Google Analytics and internal server heartbeats to measure collection performance and improve store reliability.
            </p>
          </div>

          {/* 3. Marketing & Attribution */}
          <div className={styles.categoryCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>MARKETING & ATTRIBUTION</h3>
              <label className={styles.switchLabel}>
                <input
                  type="checkbox"
                  className={styles.switchInput}
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  aria-label="Toggle Marketing and Attribution cookies"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>
            <p className={styles.cardDescription}>
              Enables affiliate referral cookies (30-day attribution) when you visit through a creator link so sales commissions are credited accurately.
            </p>
          </div>

          {/* 4. Functional Preferences */}
          <div className={styles.categoryCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>FUNCTIONAL PREFERENCES</h3>
              <label className={styles.switchLabel}>
                <input
                  type="checkbox"
                  className={styles.switchInput}
                  checked={functional}
                  onChange={(e) => setFunctional(e.target.checked)}
                  aria-label="Toggle Functional Preference cookies"
                />
                <span className={styles.switchSlider} />
              </label>
            </div>
            <p className={styles.cardDescription}>
              Remembers your chosen display currency (e.g. USD / INR), dark/light theme choice, and preferred garment sizing across product pages.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.secondaryActions}>
            <button
              type="button"
              onClick={rejectNonEssential}
              className={styles.btnSecondary}
            >
              REJECT ALL
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className={styles.btnSecondary}
            >
              ACCEPT ALL
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className={styles.btnPrimary}
          >
            SAVE PREFERENCES
          </button>
        </div>
      </div>
    </div>
  );
}
