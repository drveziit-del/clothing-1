'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const { setReferralCode } = useCart();

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
      <main>{children}</main>
      <Footer />
    </>
  );
}
