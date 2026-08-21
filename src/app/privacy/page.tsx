import Link from 'next/link';
import styles from '../support.module.css';

export const metadata = {
  title: 'Privacy Policy — GERKINK',
  description: 'Our privacy policy explains how GERKINK collects, uses, encrypts, and protects your personal information and financial data. Zero data selling, AES-256-GCM encryption.',
  openGraph: {
    title: 'Privacy Policy — GERKINK',
    description: 'Learn how GERKINK protects your personal data, encrypts affiliate payouts, and complies with GDPR & CCPA privacy standards.',
    url: '/privacy',
  },
  twitter: {
    title: 'Privacy Policy — GERKINK',
    description: 'Learn how GERKINK protects your personal data, encrypts affiliate payouts, and complies with GDPR & CCPA privacy standards.',
  },
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  const privacySchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy — GERKINK",
    "description": "Comprehensive Privacy Policy detailing data collection, AES-256-GCM encryption, session security, and user data rights.",
    "url": "https://gerkink.shop/privacy"
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacySchema) }}
      />
      {/* Hero */}
      <div className={styles.hero}>
        <div className="container">
          <p className="text-label" style={{ color: 'var(--coral-100)' }}>LEGAL TRANSPARENCY</p>
          <h1 className="text-display">Privacy Policy</h1>
          <p className={styles.heroSub}>
            We sell luxury streetwear, not your personal data. Here is exactly how we collect, encrypt, and respect your information.
          </p>
          <p className={styles.meta}>Last Updated: August 2026</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container">
        <div className={styles.content}>
          <section className={styles.section}>
            <h2>1. Core Commitment: Zero Data Monetization</h2>
            <p>
              GERKINK does not sell, rent, or trade your personal information to third-party data brokers or advertising networks. We collect only what is strictly required to fulfill orders, process multi-currency payments, prevent fraud, and calculate affiliate commissions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Information We Collect</h2>
            <p>
              When you interact with the GERKINK storefront, we collect the following categories of information:
            </p>
            <ul>
              <li><strong>Account Credentials:</strong> Email address, display name, avatar URL, and encrypted authentication tokens.</li>
              <li><strong>Order & Fulfillment Data:</strong> Full recipient name, shipping address, city, state, postal code, country, phone number, and purchased product line items.</li>
              <li><strong>Encrypted Payout Details:</strong> For affiliates claiming referral rewards, submitted bank account numbers, IFSC/routing codes, UPI IDs, or PayPal emails.</li>
              <li><strong>Technical Metadata:</strong> Anonymized IP addresses for rate limiting, device headers for Content Security Policy compliance, and referral query attribution (e.g. <code>?ref=GK-XXXX</code>).</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Bank-Level PII Encryption (AES-256-GCM)</h2>
            <p>
              All sensitive financial credentials submitted by affiliates for commission payouts are encrypted server-side using <strong>AES-256-GCM</strong> (Galois/Counter Mode) authenticated encryption with random initialization vectors before being written to our database. Decryption occurs strictly in-memory by authorized admin operators when approving payouts.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Third-Party Fulfillment & Payment Processors</h2>
            <p>
              To deliver our streetwear globally, we securely share order parameters with vetted infrastructure partners:
            </p>
            <ul>
              <li><strong>Printify API:</strong> Receives customer shipping addresses and item SKU blueprints for print-on-demand fulfillment and tracking dispatch.</li>
              <li><strong>Razorpay & PayPal:</strong> Process credit card, UPI, and digital wallet transactions over encrypted TLS tunnels. We do not store raw card numbers on GERKINK servers.</li>
              <li><strong>Firebase (Google Cloud):</strong> Provides secure authentication, encrypted cloud database storage, and session token verification.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Session Cookies & Local Storage</h2>
            <p>
              We utilize <strong>HttpOnly, Secure, SameSite=Strict</strong> cookies for authentication sessions (valid for 5 days) to eliminate cross-site scripting (XSS) and cross-site request forgery (CSRF) vulnerabilities. Local storage is used exclusively to retain your shopping cart items and currency preference across browser reloads.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Your Rights: Right to Access & Right to Deletion (GDPR / CCPA)</h2>
            <p>
              You maintain full sovereignty over your data. At any time, you may:
            </p>
            <ul>
              <li>Request an export of all referral and order activity stored under your account.</li>
              <li>Permanently delete your user profile, encrypted payout details, and authentication record via our automated account deletion tools or by contacting support.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Contact & Data Privacy Requests</h2>
            <p>
              For privacy inquiries, GDPR data deletion requests, or questions regarding our cryptographic safeguards, reach out directly to our privacy desk:
            </p>
            <div className={styles.contactCard} style={{ marginTop: '1rem' }}>
              <p><strong>GERKINK Privacy & Data Protection Desk</strong></p>
              <p>Email: <a href="mailto:gerkinkofficial@gmail.com">gerkinkofficial@gmail.com</a></p>
              <p>Support Portal: <Link href="/contact">Visit Support Center →</Link></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
