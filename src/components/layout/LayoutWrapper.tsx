'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { Suspense } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import GSAPPageTransition from '@/components/animation/GSAPPageTransition';
import NavigationProgressBar from './NavigationProgressBar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const { setReferralCode } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track site visit once per session (deferred to idle time to avoid hydration bandwidth contention)
    if (!sessionStorage.getItem('gk_visited')) {
      sessionStorage.setItem('gk_visited', 'true');
      const trackVisit = () => {
        fetch('/api/analytics/visit', { method: 'POST' }).catch((err) =>
          console.error('Visit tracking error:', err)
        );
      };
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(trackVisit, { timeout: 3000 });
      } else {
        setTimeout(trackVisit, 2000);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    const cookieMatch = document.cookie.match(/(?:^|;\s*)referral=([^;]+)/);
    const cookieRef = cookieMatch ? decodeURIComponent(cookieMatch[1]).trim().toUpperCase() : null;
    const ref = refParam ? refParam.trim().toUpperCase() : cookieRef;

    if (ref) {
      setReferralCode(ref);

      // If arrived via ?ref= URL param, ensure 30-day attribution cookie is also persisted
      if (refParam) {
        const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `referral=${encodeURIComponent(ref)}; expires=${exp}; path=/; SameSite=Lax`;
      }

      const key = `gk_clk_${ref}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        fetch(`/api/referral/click?code=${ref}`, { method: 'POST' }).catch((err) =>
          console.error('Click tracking error:', err)
        );
      }
    }
  }, [setReferralCode, pathname]);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="site-main" tabIndex={-1}>
        <GSAPPageTransition>{children}</GSAPPageTransition>
      </main>
      <Footer />
    </>
  );
}
