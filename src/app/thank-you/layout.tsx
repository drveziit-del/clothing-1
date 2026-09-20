import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order Confirmed — GERKINK',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
