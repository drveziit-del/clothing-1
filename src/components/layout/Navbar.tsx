'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import ThemeToggle from './ThemeToggle';
import CurrencySelector from './CurrencySelector';
import AnnouncementBar from './AnnouncementBar';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { firebaseUser, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Dismiss mobile menu on Escape key press
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Dynamically measure and broadcast authoritative header stack height
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeaderHeight = () => {
      // Measure the announcement bar and navbar inner row (excluding temporary mobile menu dropdown)
      const announcementEl = el.querySelector('[role="region"]') as HTMLElement | null;
      const innerEl = el.querySelector(`.${styles.inner}`) as HTMLElement | null;

      const announcementHeight = announcementEl ? (announcementEl.getBoundingClientRect().height || announcementEl.offsetHeight) : 0;
      const innerHeight = innerEl ? (innerEl.getBoundingClientRect().height || innerEl.offsetHeight) : 0;

      const totalBaseHeight = Math.round(announcementHeight + innerHeight);
      const finalHeight = totalBaseHeight > 0 ? totalBaseHeight : Math.round(el.offsetHeight || 82);

      document.documentElement.style.setProperty('--site-header-height', `${finalHeight}px`);
      document.documentElement.style.setProperty('--header-height', `${finalHeight}px`);
    };

    // Defer initial measurement after paint to eliminate synchronous hydration reflow
    const rafId = requestAnimationFrame(() => {
      updateHeaderHeight();
    });

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
    });

    resizeObserver.observe(el);
    window.addEventListener('resize', updateHeaderHeight, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
  };

  return (
    <header ref={headerRef} className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      {/* ── Coral Pink Infinite Announcement Bar (Above Navbar) ── */}
      <AnnouncementBar />

      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
          GERKINK
        </Link>

        {/* Desktop nav */}
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <Link href="/shop" className={styles.navLink} aria-current={pathname === '/shop' ? 'page' : undefined}>Shop</Link>
          <Link href="/custom-design" className={styles.navLink} aria-current={pathname === '/custom-design' ? 'page' : undefined}>CUSTOM DESIGN ↗</Link>
          <Link href="/manifesto" className={styles.navLink} aria-current={pathname === '/manifesto' ? 'page' : undefined}>Manifesto</Link>
          <Link href="/owners" className={styles.navLink} aria-current={pathname === '/owners' ? 'page' : undefined}>Owners</Link>
          <Link href="/contact" className={styles.navLink} aria-current={pathname === '/contact' ? 'page' : undefined}>Contact</Link>
          {isAdmin && (
            <Link href="/admin" className={`${styles.navLink} ${styles.adminLink}`} aria-current={pathname?.startsWith('/admin') ? 'page' : undefined}>Admin</Link>
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
            aria-current={pathname === '/cart' ? 'page' : undefined}
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
              <Link href="/account" className="btn btn-secondary btn-sm" aria-current={pathname === '/account' ? 'page' : undefined}>Account</Link>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">Out</button>
            </div>
          ) : (
            <Link href="/auth/login" className="btn btn-primary btn-sm" aria-current={pathname === '/auth/login' ? 'page' : undefined}>Enter</Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            aria-controls="mobile-navigation-menu"
          >
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
            <span className={`${styles.bar} ${menuOpen ? styles.open : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu (3-lines menu) */}
      {menuOpen && (
        <div
          id="mobile-navigation-menu"
          className={styles.mobileMenu}
          role="dialog"
          aria-modal="true"
          aria-label="Site Navigation"
        >
          <Link href="/shop" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/shop' ? 'page' : undefined}>Shop</Link>
          <Link href="/custom-design" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/custom-design' ? 'page' : undefined}>CUSTOM DESIGN ↗</Link>
          <Link href="/manifesto" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/manifesto' ? 'page' : undefined}>Manifesto</Link>
          <Link href="/owners" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/owners' ? 'page' : undefined}>Owners</Link>
          <Link href="/contact" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/contact' ? 'page' : undefined}>Contact</Link>
          {isAdmin && (
            <Link href="/admin" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname?.startsWith('/admin') ? 'page' : undefined}>Admin</Link>
          )}
          
          <div className={styles.currencyRow}>
            <span className={styles.currencyLabel}>Currency</span>
            <CurrencySelector />
          </div>

          <div className={styles.mobileSep} />
          {firebaseUser ? (
            <>
              <Link href="/account" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/account' ? 'page' : undefined}>Account</Link>
              <button className={styles.mobileLink} onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <Link href="/auth/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)} aria-current={pathname === '/auth/login' ? 'page' : undefined}>Sign In / Join</Link>
          )}
        </div>
      )}
    </header>
  );
}
