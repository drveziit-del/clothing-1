import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import RoastToast from "@/components/ui/RoastToast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://gerkink.shop'),
  title: "GERKINK",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  description:
    "Two collections. Zero apologies. Society Fuckers & Valueless Bitches — wear your worth or stay basic.",
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
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
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