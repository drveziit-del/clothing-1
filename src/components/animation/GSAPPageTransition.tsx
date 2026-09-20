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
      // Preserve immediate SSR content visibility; avoid opacity: 0 suppression on initial mount
      return;
    }

    // Subtle, compositor-only micro-transition on route changes (preserves immediate visibility, eliminates blur jank)
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0.94,
          y: 3,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.16,
          ease: 'power1.out',
          clearProps: 'all',
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
