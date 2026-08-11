import Link from 'next/link';
import styles from '../support.module.css';

export const metadata = {
  title: 'Referral Program & Affiliate Rewards — GERKINK',
  description: 'Earn $100 for every 10 referrals plus compete for our $100,000 100k customer milestone reward. Claim payouts via Discount Coupons, Wise, PayPal, or Bank Transfer.',
  openGraph: {
    title: 'Referral Program & Affiliate Rewards — GERKINK',
    description: 'Earn $100 for every 10 referrals plus compete for our $100,000 100k customer milestone reward. Claim payouts via Discount Coupons, Wise, PayPal, or Bank Transfer.',
    url: '/referral',
  },
  twitter: {
    title: 'Referral Program & Affiliate Rewards — GERKINK',
    description: 'Earn $100 for every 10 referrals plus compete for our $100,000 100k customer milestone reward. Claim payouts via Discount Coupons, Wise, PayPal, or Bank Transfer.',
  },
  alternates: {
    canonical: '/referral',
  },
};

export default function ReferralPage() {
  const referralFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How much do I earn per referral?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You earn $100 USD for every 10 successful referrals who place an order of $100 USD or more using your unique referral code."
        }
      },
      {
        "@type": "Question",
        "name": "What is the $100,000 milestone reward?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The affiliate whose referral code brings the 100,000th global customer to GERKINK wins an exclusive $100,000 USD milestone reward."
        }
      },
      {
        "@type": "Question",
        "name": "How do I claim my referral earnings?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Earnings can be claimed directly from your Account Dashboard as an Instant Store Coupon, or a Direct Payout to Wise, PayPal, or your local Bank Account."
        }
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(referralFaqSchema) }}
      />
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>EARN REAL CASH</span>
          <h1 className={styles.heroTitle}>Referral Program</h1>
          <p className={styles.heroDesc}>
            Spread the noise. Bring your circle. Get paid real cash or free streetwear.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.article}>

          {/* Callout Box */}
          <div style={{
            background: 'rgba(255, 77, 77, 0.08)',
            border: '1px solid rgba(255, 77, 77, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ff4d4d', fontFamily: 'Space Grotesk, sans-serif' }}>
              💰 Earn $100 per 10 Referrals + $100,000 Grand Prize
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Every time 10 friends order using your unique code (min. order value $100 USD), you instantly unlock <strong>$100 USD</strong> in rewards. Plus, the affiliate who refers our <strong>100,000th customer</strong> wins <strong>$100,000 USD cash</strong>!
            </p>
            <div style={{ paddingTop: '0.5rem' }}>
              <Link href="/account" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', padding: '0.6rem 1.25rem' }}>
                Get Your Referral Link →
              </Link>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>1. How It Works</h2>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.95rem' }}>
              <li><strong>Step 1 — Get Your Code:</strong> Log into your <Link href="/account" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Account Dashboard</Link> to view your personalized referral link &amp; code.</li>
              <li><strong>Step 2 — Share Everywhere:</strong> Share your code on Instagram, TikTok, Discord, YouTube, or direct message.</li>
              <li><strong>Step 3 — Qualify Orders:</strong> When someone completes an order of <strong>$100 USD or more</strong> using your code, it counts as 1 qualified referral.</li>
              <li><strong>Step 4 — Collect Earnings:</strong> Reaching 10 qualified referrals automatically credits <strong>$100 USD</strong> to your affiliate balance.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Payout Options &amp; How To Claim</h2>
            <p className={styles.bodyText}>
              We believe in flexible rewards. Once you unlock eligible commission rewards, you can choose how you want to be paid directly from your <Link href="/account" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Account Dashboard</Link>:
            </p>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.95rem' }}>
              <li><strong>Store Coupon Code:</strong> Instantly convert earnings into an exclusive GERKINK discount coupon for future purchases.</li>
              <li><strong>Direct Payout:</strong> Request a direct cash transfer to your <strong>Wise</strong> account, <strong>PayPal</strong>, or <strong>Direct Bank Account</strong>.</li>
            </ul>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>3. The $100,000 Milestone Competition</h2>
            <p className={styles.bodyText}>
              We are giving away <span className={styles.emphasis}>$100,000 USD</span> to 1 lucky affiliate. The system automatically tracks every global customer referral in real-time inside our secure backend. The exact affiliate whose code brings in our <strong>100,000th customer</strong> will be awarded the entire $100k cash prize.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Referral Terms &amp; Anti-Fraud Rules</h2>
            <p className={styles.bodyText}>
              Self-referrals are completely allowed. We only need sales. However, if anyone attempts actual system fraud or malicious exploits, admin will beat their ass off.
            </p>
          </div>

          <div className={styles.section} style={{ marginTop: '2rem' }}>
            <Link href="/auth/signup" className="btn btn-primary" style={{ display: 'inline-block', textAlign: 'center', width: '100%' }}>
              Join GERKINK &amp; Start Referring Today
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
