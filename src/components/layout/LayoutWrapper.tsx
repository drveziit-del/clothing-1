'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import Navbar from './Navbar';
import Footer from './Footer';
import GSAPPageTransition from '@/components/animation/GSAPPageTransition';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const { setReferralCode } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track site visit once per session
    if (!sessionStorage.getItem('gk_visited')) {
      sessionStorage.setItem('gk_visited', 'true');
      fetch('/api/analytics/visit', { method: 'POST' }).catch((err) =>
        console.error('Visit tracking error:', err)
      );
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const formattedRef = ref.trim().toUpperCase();
      setReferralCode(formattedRef);

      const key = `gk_clk_${formattedRef}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        fetch(`/api/referral/click?code=${formattedRef}`, { method: 'POST' }).catch((err) =>
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
      <Navbar />
      <main>
        <GSAPPageTransition>{children}</GSAPPageTransition>
      </main>
      <Footer />
    </>
  );
}
