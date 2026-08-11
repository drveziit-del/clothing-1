'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './Footer.module.css';

export default function Footer() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [tagline, setTagline] = useState('We are nobody.\nOur clothes speak louder.');

  useEffect(() => {
    try {
      const db = getFirestoreDb();
      if (!db) return;
      const { doc, onSnapshot } = getFirestoreModule();
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
    } catch (err) {
      console.warn('Footer copywriting effect error:', err);
    }
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* ── FOLLOW US ON SOCIALS SECTION (HOMEPAGE ONLY) ─────── */}
        {isHomePage && (
          <div className={styles.socialsBanner}>
          <div className={styles.socialsHeader}>
            <span className="tag tag-mist" style={{ width: 'fit-content', marginBottom: '0.4rem' }}>Community</span>
            <h2 className={styles.socialsTitle}>Follow Us On Socials</h2>
            <p className={styles.socialsSub}>
              No filters. No corporate BS. Join our channels for drop alerts, community discussions, and daily roasts.
            </p>
          </div>

          <div className={styles.socialsGrid}>
            <a
              href="https://www.instagram.com/gerkink.shop"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialCard}
            >
              <div className={styles.socialCardHeader}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span className={styles.socialArrow}>↗</span>
              </div>
              <span className={styles.socialName}>Instagram</span>
              <span className={styles.socialHandle}>@gerkink.shop</span>
            </a>

            <a
              href="https://x.com/gerkinkshop"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialCard}
            >
              <div className={styles.socialCardHeader}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className={styles.socialArrow}>↗</span>
              </div>
              <span className={styles.socialName}>Twitter / X</span>
              <span className={styles.socialHandle}>@gerkinkshop</span>
            </a>

            <a
              href="https://www.reddit.com/u/gerkinkshop/s/BvlrtcmSGK"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialCard}
            >
              <div className={styles.socialCardHeader}>
                <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/>
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/>
                </svg>
                <span className={styles.socialArrow}>↗</span>
              </div>
              <span className={styles.socialName}>Reddit</span>
              <span className={styles.socialHandle}>u/gerkinkshop</span>
            </a>

            <a
              href="https://discord.gg/549V3MMy7"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialCard}
            >
              <div className={styles.socialCardHeader}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className={styles.socialArrow}>↗</span>
              </div>
              <span className={styles.socialName}>Discord</span>
              <span className={styles.socialHandle}>Join Server</span>
            </a>
          </div>
        </div>
      )}

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
              <Link href="/referral">Referral Program</Link>
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
              <Link href="/disclaimer">Disclaimer</Link>
            </div>
          </nav>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copy}>© {new Date().getFullYear()} GERKINK. All rights reserved.</span>
          <div className={styles.social}>
            <a href="https://www.instagram.com/gerkink.shop" aria-label="Instagram" target="_blank" rel="noopener noreferrer" title="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a href="https://x.com/gerkinkshop" aria-label="Twitter / X" target="_blank" rel="noopener noreferrer" title="Twitter / X">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://www.reddit.com/u/gerkinkshop/s/BvlrtcmSGK" aria-label="Reddit" target="_blank" rel="noopener noreferrer" title="Reddit">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/>
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/>
              </svg>
            </a>
            <a href="https://discord.gg/549V3MMy7" aria-label="Discord" target="_blank" rel="noopener noreferrer" title="Discord">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
