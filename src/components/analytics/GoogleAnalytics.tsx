'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/context/CookieConsentContext';

export default function GoogleAnalytics() {
  const { consent } = useCookieConsent();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // Strictly gate Google Analytics behind explicit user consent
  if (!consent?.analytics || !measurementId) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
