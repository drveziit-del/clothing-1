'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './AnnouncementBar.module.css';

const DEFAULT_ANNOUNCEMENTS = [
  "POV: YOU FINALLY MADE A GOOD DECISION",
  "YOUR FRIENDS LIED TO YOU. WE WON'T.",
  "FASHION DIED. GERKINK IS THE AUTOPSY.",
  "BASIC IS A CHOICE. A BAD ONE.",
  "SOCIETY F*CKERS COLLECTION — BECAUSE MEDIOCRITY IS EXPENSIVE",
  "YOUR CLOSET LOOKS LIKE A GOODWILL REJECT PILE",
  "VALUELESS BITCHES — FOR PEOPLE WHO KNOW THEIR WORTH",
  "OUR OWNERS ARE ANONYMOUS. OUR WEAR ISN'T.",
  "LIMITED 250 UNITS WORLDWIDE · 240GSM ULTRA-DENSE YARN",
  "EARN $100 CASH FOR EVERY 10 COMPLETED CLIENT REFERRALS",
];

interface AnnouncementBarProps {
  speed?: number;
}

export default function AnnouncementBar({
  speed = 46,
}: AnnouncementBarProps) {
  const [messages, setMessages] = useState<string[]>(DEFAULT_ANNOUNCEMENTS);
  const [giantText, setGiantText] = useState<string>('LOOK AT ME');
  const [capsuleTag, setCapsuleTag] = useState<string>('LOOK AT ME');
  const [capsuleMessage, setCapsuleMessage] = useState<string>('NEW DROP JUST LANDED');
  const [capsuleLink, setCapsuleLink] = useState<string>('/shop');
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let idleId: number | null = null;
    let timerId: NodeJS.Timeout | null = null;

    const setupListener = () => {
      try {
        const db = getFirestoreDb();
        if (!db) return;
        const { doc, onSnapshot } = getFirestoreModule();

        unsub = onSnapshot(
          doc(db, 'settings', 'global'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const dynamicList = data.announcementMessages || data.roastMessages;
              if (Array.isArray(dynamicList) && dynamicList.length > 0) {
                setMessages((prev) => {
                  if (prev.length === dynamicList.length && prev.every((m, i) => m === dynamicList[i])) {
                    return prev;
                  }
                  return dynamicList;
                });
              }
              if (typeof data.announcementGiantText === 'string' && data.announcementGiantText.trim()) {
                const nextVal = data.announcementGiantText.trim();
                setGiantText((prev) => (prev === nextVal ? prev : nextVal));
              }
              if (typeof data.announcementCapsuleTag === 'string' && data.announcementCapsuleTag.trim()) {
                const nextVal = data.announcementCapsuleTag.trim();
                setCapsuleTag((prev) => (prev === nextVal ? prev : nextVal));
              }
              if (typeof data.announcementCapsuleMessage === 'string' && data.announcementCapsuleMessage.trim()) {
                const nextVal = data.announcementCapsuleMessage.trim();
                setCapsuleMessage((prev) => (prev === nextVal ? prev : nextVal));
              }
              if (typeof data.announcementCapsuleLink === 'string' && data.announcementCapsuleLink.trim()) {
                const link = data.announcementCapsuleLink.trim();
                const nextVal =
                  link.startsWith('/') && !link.startsWith('//') && !link.startsWith('/\\')
                    ? link
                    : '/shop';
                setCapsuleLink((prev) => (prev === nextVal ? prev : nextVal));
              }
              if (typeof data.announcementEnabled === 'boolean') {
                setEnabled((prev) => (prev === data.announcementEnabled ? prev : data.announcementEnabled));
              }
            }
          },
          (err) => {
            console.warn('AnnouncementBar Firestore snapshot warning:', err);
          }
        );
      } catch (err) {
        console.warn('AnnouncementBar Firestore effect warning:', err);
      }
    };

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        idleId = (window as Window).requestIdleCallback(setupListener, { timeout: 2500 });
      } else {
        timerId = setTimeout(setupListener, 1500);
      }
    }

    return () => {
      if (idleId !== null && 'cancelIdleCallback' in window) {
        (window as Window).cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      if (unsub) unsub();
    };
  }, []);

  if (!enabled) {
    return null;
  }

  // Duplicate for seamless 50% translation infinite loop
  const displayItems = [...messages, ...messages];

  return (
    <div className={styles.announcementViewport} role="region" aria-label="Official Announcement Bar">
      {/* ── 1. Large Dynamic Background Typography Layer ── */}
      <div className={styles.giantTypographyLayer} aria-hidden="true">
        <span className={styles.giantWord}>{giantText}</span>
        <span className={`${styles.giantWord} ${styles.desktopOnlyWord}`}>{giantText}</span>
      </div>

      {/* ── 2. Moving Marquee Announcement Track ── */}
      <div className={styles.marqueeContainer} aria-hidden="true">
        <div
          className={styles.marqueeTrack}
          style={{ animationDuration: `${speed}s` }}
        >
          {displayItems.map((msg, idx) => (
            <span key={idx} className={styles.marqueeItem}>
              {msg}
              <span className={styles.marqueeSep}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. Centered Liquid-Glass Capsule (Focal Interruption) ── */}
      <div className={styles.glassCapsuleWrapper}>
        <Link
          href={capsuleLink.startsWith('/') && !capsuleLink.startsWith('//') && !capsuleLink.startsWith('/\\') ? capsuleLink : '/shop'}
          className={styles.glassCapsule}
          aria-label={`${capsuleTag}: ${capsuleMessage}`}
        >
          <span className={styles.glassTag}>
            <span className={styles.glassDot} aria-hidden="true" />
            {capsuleTag}
          </span>
          <span className={styles.glassDivider} aria-hidden="true">·</span>
          <span className={styles.glassMessage}>{capsuleMessage}</span>
          <span className={styles.glassArrow} aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
