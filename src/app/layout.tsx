import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import RoastToast from "@/components/ui/RoastToast";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { NetworkStatusProvider } from "@/context/NetworkStatusContext";
import NetworkStatusPill from "@/components/ui/NetworkStatusPill";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieBanner from "@/components/ui/CookieBanner";
import CookiePreferencesModal from "@/components/ui/CookiePreferencesModal";
import { FavoritesProvider } from "@/context/FavoritesContext";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://gerkink.shop'),
  title: {
    default: "GERKINK | Unconventional Streetwear, Custom Designs & Rare Luxury",
    template: "%s",
  },
  description:
    "Shop GERKINK streetwear, create a custom design, or explore Society Fu*kers — rare, limited pieces for people who dress on their own terms.",
  keywords: [
    "luxury streetwear",
    "unconventional streetwear",
    "custom designs",
    "rare luxury",
    "GERKINK",
    "custom clothing",
    "Society Fuckers",
    "Valueless Bitches",
    "heavyweight streetwear",
    "designer apparel",
  ],
  authors: [{ name: "GERKINK", url: "https://gerkink.shop" }],
  creator: "GERKINK",
  publisher: "GERKINK",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/logo.png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://gerkink.shop",
    siteName: "GERKINK",
    title: "GERKINK | Unconventional Streetwear, Custom Designs & Rare Luxury",
    description:
      "Shop GERKINK streetwear, create a custom design, or explore Society Fu*kers — rare, limited pieces for people who dress on their own terms.",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 800,
        alt: "GERKINK Luxury Streetwear",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@gerkinkshop",
    creator: "@gerkinkshop",
    title: "GERKINK | Unconventional Streetwear, Custom Designs & Rare Luxury",
    description:
      "Shop GERKINK streetwear, create a custom design, or explore Society Fu*kers — rare, limited pieces for people who dress on their own terms.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "clothing",
  classification: "Luxury Streetwear",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "GERKINK",
    "url": "https://gerkink.shop",
    "logo": "https://gerkink.shop/logo.png",
    "description":
      "Shop GERKINK streetwear, create a custom design, or explore Society Fu*kers — rare, limited pieces for people who dress on their own terms.",
    "sameAs": [
      "https://www.instagram.com/gerkink.shop",
      "https://x.com/gerkinkshop",
      "https://www.reddit.com/u/gerkinkshop/s/BvlrtcmSGK",
      "https://discord.gg/549V3MMy7"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "GERKINK",
    "url": "https://gerkink.shop",
    "description":
      "Shop GERKINK streetwear, create a custom design, or explore Society Fu*kers — rare, limited pieces for people who dress on their own terms."
  };

  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://images-api.printify.com" />
        <link rel="dns-prefetch" href="https://images-api.printify.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema).replace(/</g, '\\u003c') }}
        />
      </head>
      <body suppressHydrationWarning>
        <CookieConsentProvider>
          <GoogleAnalytics />
          <ThemeProvider>
            <AuthProvider>
              <CurrencyProvider>
                <CartProvider>
                  <FavoritesProvider>
                    <NetworkStatusProvider>
                      <LayoutWrapper>{children}</LayoutWrapper>
                      <NetworkStatusPill />
                      <RoastToast />
                      <CookieBanner />
                      <CookiePreferencesModal />
                    </NetworkStatusProvider>
                  </FavoritesProvider>
                </CartProvider>
              </CurrencyProvider>
            </AuthProvider>
          </ThemeProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}