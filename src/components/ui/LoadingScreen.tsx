'use client';

import { useEffect, useState } from 'react';
import styles from './LoadingScreen.module.css';

const LOAD_ROASTS = [
  'Evaluating your taste...',
  'Calculating your mediocrity...',
  'Loading things you can\'t afford...',
  'Preparing your ego check...',
];

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [roast, setRoast] = useState(LOAD_ROASTS[0]);

  useEffect(() => {
    // If already seen in this session, dismiss immediately
    try {
      if (sessionStorage.getItem('gerkink_splash_seen')) {
        setVisible(false);
        return;
      }
      sessionStorage.setItem('gerkink_splash_seen', '1');
    } catch (_) {}

    setRoast(LOAD_ROASTS[Math.floor(Math.random() * LOAD_ROASTS.length)]);

    // Lock body scroll briefly during splash animation, preserving original overflow
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Snappy 450ms splash animation to allow immediate hero discovery and interaction
    const timer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = originalOverflow;
    }, 450);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <span className={styles.logo}>GERKINK</span>
        <p className={styles.roast}>{roast}</p>
        <div className={styles.bar}>
          <div className={styles.fill} />
        </div>
      </div>
    </div>
  );
}
