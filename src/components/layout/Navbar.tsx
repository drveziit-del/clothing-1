'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import ThemeToggle from './ThemeToggle';
import CurrencySelector from './CurrencySelector';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { itemCount } = useCart();
  const { firebaseUser, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
  };

  return (
    <header className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
          GERKINK
        </Link>

        {/* Desktop nav */}
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <Link href="/shop" className={styles.navLink}>Shop</Link>
          <Link href="/manifesto" className={styles.navLink}>Manifesto</Link>
          <Link href="/owners" className={styles.navLink}>Owners</Link>
          <Link href="/contact" className={styles.navLink}>Contact</Link>
          {isAdmin && (
            <Link href="/admin" className={`${styles.navLink} ${styles.adminLink}`}>Admin</Link>
          )}
        </nav>

        {/* Right cluster */}
        <div className={styles.right}>
          <div className={styles.desktopCurrency}>
            <CurrencySelector />
          </div>
          <ThemeToggle />

          <Link
            href="/cart"
            className={styles.cartBtn}
            aria-label={`Cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
            </svg>
            {itemCount > 0 && (
              <span className={styles.badge}>{itemCount > 99 ? '99+' : itemCount}</span>
            )}
          </Link>

          {firebaseUser ? (
            <div className={styles.userMenu}>
              <Link href="/account" className="btn btn-secondary btn-sm">Account</Link>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">Out</button>
            </div>
          ) : (
            <Link href="/auth/login" className="btn btn-primary btn-sm">Enter</Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu (3-lines menu) */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/shop" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link href="/manifesto" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Manifesto</Link>
          <Link href="/owners" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Owners</Link>
          <Link href="/contact" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Contact</Link>
          {isAdmin && (
            <Link href="/admin" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Admin</Link>
          )}
          
          <div className={styles.currencyRow}>
            <span className={styles.currencyLabel}>Currency</span>
            <CurrencySelector />
          </div>

          <div className={styles.mobileSep} />
          {firebaseUser ? (
            <>
              <Link href="/account" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Account</Link>
              <button className={styles.mobileLink} onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <Link href="/auth/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Sign In / Join</Link>
          )}
        </div>
      )}
    </header>
  );
}
