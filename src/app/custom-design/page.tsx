import { Metadata } from 'next';
import CustomDesignClient from './CustomDesignClient';

export const metadata: Metadata = {
  title: 'Custom Design — Turn Your Idea Into GERKINK',
  description:
    'Got your own idea? Submit your custom design, artwork, or concept to the GERKINK Atelier. Choose your non-refundable prepayment tier ($15 / $20) and craft your statement piece.',
  alternates: {
    canonical: 'https://gerkink.shop/custom-design',
  },
  openGraph: {
    title: 'Custom Design — GERKINK Atelier',
    description: 'Submit your custom streetwear concept. We turn it into GERKINK.',
    url: 'https://gerkink.shop/custom-design',
    type: 'website',
  },
};

export default function CustomDesignPage() {
  return <CustomDesignClient />;
}
