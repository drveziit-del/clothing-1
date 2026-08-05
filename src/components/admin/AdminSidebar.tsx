'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CurrencySelector from '@/components/layout/CurrencySelector';
import styles from './AdminSidebar.module.css';

const NAV = [
  { href: '/admin',           label: 'Dashboard',   icon: '▣' },
  { href: '/admin/products',  label: 'Products',    icon: '◈' },
  { href: '/admin/orders',    label: 'Orders',      icon: '◎' },
  { href: '/admin/coupons',   label: 'Coupons',     icon: '🎟' },
  { href: '/admin/users',     label: 'Users',       icon: '◉' },
  { href: '/admin/referrals', label: 'Referrals',   icon: '◆' },
  { href: '/admin/settings',  label: 'Settings',    icon: '◐' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Top Navigation Header */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileLeft}>
          <Link href="/" className={styles.logo}>GERKINK</Link>
          <span className={styles.adminLabel}>Admin</span>
        </div>
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={toggleMenu}
          aria-label="Toggle Navigation Menu"
        >
          {isOpen ? '✕' : '☰ MENU'}
        </button>
      </div>

      {/* Mobile Slide-out Navigation Drawer Overlay */}
      {isOpen && (
        <div className={styles.mobileOverlay} onClick={closeMenu}>
          <div className={styles.mobileDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Admin Navigation</span>
              <button type="button" className={styles.closeBtn} onClick={closeMenu}>✕</button>
            </div>

            <nav className={styles.nav}>
              {NAV.map(({ href, label, icon }) => {
                const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${styles.link} ${active ? styles.active : ''}`}
                    onClick={closeMenu}
                  >
                    <span className={styles.icon}>{icon}</span>
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className={styles.footer}>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
                  Currency
                </div>
                <CurrencySelector />
              </div>
              <Link href="/" className={styles.backLink} onClick={closeMenu}>← Back to site</Link>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>GERKINK</Link>
          <span className={styles.adminLabel}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ href, label, icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.link} ${active ? styles.active : ''}`}
              >
                <span className={styles.icon}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
              Currency
            </div>
            <CurrencySelector />
          </div>
          <Link href="/" className={styles.backLink}>← Back to site</Link>
        </div>
      </aside>
    </>
  );
}
