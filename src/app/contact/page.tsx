import type { Metadata } from 'next';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact Us — GERKINK',
  description: 'Have a question about your order, want to send a suggestion, or just want to tell us off? Get in touch with GERKINK customer support. We respond (sometimes).',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us — GERKINK',
    description: 'Have a question about your order, want to send a suggestion, or just want to tell us off? Get in touch with GERKINK customer support. We respond (sometimes).',
    url: '/contact',
  },
  twitter: {
    title: 'Contact Us — GERKINK',
    description: 'Have a question about your order, want to send a suggestion, or just want to tell us off? Get in touch with GERKINK customer support. We respond (sometimes).',
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
