'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './AnnouncementBar.module.css';

const DEFAULT_ANNOUNCEMENTS = [
  "Your outfit screams 'I gave up in 2019'",
  "We sell a $10,000,000 t-shirt. No, you can't afford it.",
  "Society Fuckers Collection — because mediocrity is expensive",
  "Your closet looks like a Goodwill reject pile",
  "Valueless Bitches — for people who know their worth",
  "Our owners are anonymous. Our wearers are unforgettable.",
  "You're reading this instead of fixing your wardrobe",
  "The cheapest shirt here costs more than your monthly rent",
  "We don't do sales. Your dignity isn't on discount.",
  "POV: you finally made a good decision",
  "Your friends lied to you. We won't.",
  "Fashion died. GERKINK is the autopsy.",
  "Basic is a choice. A bad one.",
  "You dress like your personality — which explains a lot.",
  "Every cheap shirt you own is a personal failure",
  "✦ LIMITED DROP: PEASANT PREMIUM 2.0 CAPSULE IS LIVE",
];

interface AnnouncementBarProps {
  speed?: number;
}

export default function AnnouncementBar({
  speed = 46,
}: AnnouncementBarProps) {
  const [messages, setMessages] = useState<string[]>(DEFAULT_ANNOUNCEMENTS);
  const [giantText, setGiantText] = useState<string>('LOOK AT ME FOLKS');
  const [capsuleTag, setCapsuleTag] = useState<string>('LOOK AT ME FOLKS');
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
