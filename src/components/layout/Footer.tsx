'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './Footer.module.css';

export default function Footer() {
  const [tagline, setTagline] = useState('We are nobody.\nOur clothes speak louder.');

  useEffect(() => {
    const { doc, onSnapshot } = getFirestoreModule();
    const db = getFirestoreDb();
    const unsub = onSnapshot(
      doc(db, 'settings', 'copywriting'),
      (snap) => {
        if (snap.exists() && snap.data().footerTagline) {
          setTagline(snap.data().footerTagline);
        }
      },
      (error) => {
        console.warn('Footer copywriting settings snapshot error:', error);
      }
    );
    return () => unsub();
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo}>GERKINK</span>
            <p className={styles.tagline} style={{ whiteSpace: 'pre-line' }}>
              {tagline}
            </p>
          </div>

          <nav className={styles.links} aria-label="Footer navigation">
            <div className={styles.linkGroup}>
              <span className={styles.groupLabel}>Shop</span>
              <Link href="/shop/society-fuckers">Society Fu*kers</Link>
              <Link href="/shop/valueless-bitches">Valueless Bi*ches</Link>
            </div>
            <div className={styles.linkGroup}>
              <span className={styles.groupLabel}>Brand</span>
              <Link href="/manifesto">Manifesto</Link>
              <Link href="/owners">Owners</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div className={styles.linkGroup}>
              <span className={styles.groupLabel}>Account</span>
              <Link href="/auth/login">Sign In</Link>
              <Link href="/auth/signup">Join</Link>
              <Link href="/account">Dashboard</Link>
            </div>
            <div className={styles.linkGroup}>
              <span className={styles.groupLabel}>Legal</span>
              <Link href="/terms">Terms &amp; Conditions</Link>
              <Link href="/refund">Refund &amp; Replace</Link>
              <Link href="/shipping">Shipment</Link>
            </div>
          </nav>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copy}>© {new Date().getFullYear()} GERKINK. All rights reserved.</span>
          <div className={styles.social}>
            <a href="https://www.instagram.com/gerkink.shop" aria-label="Instagram" target="_blank" rel="noopener noreferrer">IG</a>
            <a href="https://x.com/gerkinkshop" aria-label="Twitter / X" target="_blank" rel="noopener noreferrer">X</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
