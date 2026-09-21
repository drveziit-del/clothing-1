'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CookieConsentState {
  version: '1';
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  timestamp: string;
}

export interface CookiePreferencesInput {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookieConsentContextValue {
  consent: CookieConsentState | null;
  isBannerOpen: boolean;
  isPreferencesOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: CookiePreferencesInput) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  isCategoryAllowed: (category: 'analytics' | 'marketing' | 'functional' | 'necessary') => boolean;
}

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

const CONSENT_STORAGE_KEY = 'gk_consent';
const CONSENT_COOKIE_NAME = 'gk_consent';
const CURRENT_VERSION = '1';

function parseConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === CURRENT_VERSION &&
      parsed.necessary === true &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean' &&
      typeof parsed.functional === 'boolean' &&
      typeof parsed.timestamp === 'string'
    ) {
      return {
        version: CURRENT_VERSION,
        necessary: true,
        analytics: Boolean(parsed.analytics),
        marketing: Boolean(parsed.marketing),
        functional: Boolean(parsed.functional),
        timestamp: parsed.timestamp,
      };
    }
  } catch {
    // Malformed JSON fails safely
  }
  return null;
}

function persistConsent(state: CookieConsentState): void {
  if (typeof window === 'undefined') return;

  const serialized = JSON.stringify(state);

  // 1. Store in localStorage for instant client reading
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('Could not save consent to localStorage:', err);
  }

  // 2. Store in first-party cookie for SSR / edge reading (365 days)
  try {
    const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
      serialized
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (err) {
    console.warn('Could not save consent cookie:', err);
  }
}

function readStoredConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  // Check localStorage first
  try {
    const local = localStorage.getItem(CONSENT_STORAGE_KEY);
    const parsedLocal = parseConsent(local);
    if (parsedLocal) return parsedLocal;
  } catch {}

  // Fallback to cookie
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]+)`));
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      const parsedCookie = parseConsent(decoded);
      if (parsedCookie) return parsedCookie;
    }
  } catch {}

  return null;
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [isBannerOpen, setIsBannerOpen] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    const existing = readStoredConsent();
    if (existing) {
      setConsent(existing);
      setIsBannerOpen(false);
    } else {
      setIsBannerOpen(true);
    }
  }, []);

  const acceptAll = useCallback(() => {
    const newState: CookieConsentState = {
      version: CURRENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString(),
    };
    persistConsent(newState);
    setConsent(newState);
    setIsBannerOpen(false);
    setIsPreferencesOpen(false);
  }, []);

  const rejectNonEssential = useCallback(() => {
    const newState: CookieConsentState = {
      version: CURRENT_VERSION,
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      timestamp: new Date().toISOString(),
    };
    persistConsent(newState);
    setConsent(newState);
    setIsBannerOpen(false);
    setIsPreferencesOpen(false);
  }, []);

  const savePreferences = useCallback((prefs: CookiePreferencesInput) => {
    const newState: CookieConsentState = {
      version: CURRENT_VERSION,
      necessary: true,
      analytics: Boolean(prefs.analytics),
      marketing: Boolean(prefs.marketing),
      functional: Boolean(prefs.functional),
      timestamp: new Date().toISOString(),
    };
    persistConsent(newState);
    setConsent(newState);
    setIsBannerOpen(false);
    setIsPreferencesOpen(false);
  }, []);

  const openPreferences = useCallback(() => {
    setIsPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);

  const isCategoryAllowed = useCallback(
    (category: 'analytics' | 'marketing' | 'functional' | 'necessary'): boolean => {
      if (category === 'necessary') return true;
      if (!consent) return false;
      return Boolean(consent[category]);
    },
    [consent]
  );

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        isBannerOpen: isMounted && isBannerOpen,
        isPreferencesOpen: isMounted && isPreferencesOpen,
        acceptAll,
        rejectNonEssential,
        savePreferences,
        openPreferences,
        closePreferences,
        isCategoryAllowed,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
}
