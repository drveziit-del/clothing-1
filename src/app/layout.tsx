import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import RoastToast from "@/components/ui/RoastToast";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://gerkink.shop'),
  title: "GERKINK",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  description:
    "Two collections. Zero apologies. Society Fuckers & Valueless Bitches — buy the world's most provocative luxury streetwear from GERKINK and wear your worth.",
  keywords: ["luxury streetwear", "provocative fashion", "GERKINK", "Society Fuckers", "Valueless Bitches"],
  openGraph: {
    title: "GERKINK",
    description: "You dress like your personality — boring as f*ck. Fix it.",
    type: "website",
    images: [{ url: "/logo.png", width: 800, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GERKINK",
    description: "Luxury streetwear that roasts you into buying.",
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
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
    "description": "Two collections. Zero apologies. Society Fuckers & Valueless Bitches — wear your worth or stay basic.",
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
    "url": "https://gerkink.shop"
  };

  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
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
        <GoogleAnalytics />
        <ThemeProvider>
          <AuthProvider>
            <CurrencyProvider>
              <CartProvider>
                <LayoutWrapper>{children}</LayoutWrapper>
                <RoastToast />
              </CartProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}