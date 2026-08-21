'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

interface GSAPPageTransitionProps {
  children: React.ReactNode;
}

export default function GSAPPageTransition({ children }: GSAPPageTransitionProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!containerRef.current) return;

    if (firstRender.current) {
      firstRender.current = false;
      // Initial page load smooth fade in
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      );
      return;
    }

    // Smooth transition on route changes (Checkout -> Receipt -> Thank You, etc.)
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
          y: 10,
          filter: 'blur(4px)',
        },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.4,
          ease: 'power2.out',
          clearProps: 'filter,transform',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [pathname]);

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: '100%' }}>
      {children}
    </div>
  );
}
