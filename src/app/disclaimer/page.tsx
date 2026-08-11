import Link from 'next/link';
import styles from '../support.module.css';

export const metadata = {
  title: 'Disclaimer — GERKINK',
  description: 'Read the official website disclaimer, brand satire notice, liability limitations, and print-on-demand fulfillment terms for GERKINK clothing.',
  openGraph: {
    title: 'Disclaimer — GERKINK',
    description: 'Read the official website disclaimer, brand satire notice, liability limitations, and print-on-demand fulfillment terms for GERKINK clothing.',
    url: '/disclaimer',
  },
  twitter: {
    title: 'Disclaimer — GERKINK',
    description: 'Read the official website disclaimer, brand satire notice, liability limitations, and print-on-demand fulfillment terms for GERKINK clothing.',
  },
  alternates: {
    canonical: '/disclaimer',
  },
};

export default function DisclaimerPage() {
  const disclaimerSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is GERKINK's brand satire disclaimer?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "GERKINK operates as an edgy, provocative streetwear brand. We have zero intention to cause harm, offend, or target any individual, group, or belief. The slogans, satirical copy, roasts, and brand commentary presented on this website are creative artistic expressions intended for satire, humor, and streetwear culture."
        }
      },
      {
        "@type": "Question",
        "name": "How does product availability and representation work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All items are custom-printed on demand. Mockup images displayed on product pages are digital representations. Actual garment print positioning, color hues, and scale may slightly vary depending on screen calibration and print provider execution."
        }
      },
      {
        "@type": "Question",
        "name": "What is the limitation of liability?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "GERKINK and its owners shall not be held liable for any indirect, incidental, or consequential damages resulting from the use of our products, site access, or shipping delays beyond our direct operational control."
        }
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(disclaimerSchema) }}
      />
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>GERKINK</span>
          <h1 className={styles.heroTitle}>Disclaimer</h1>
          <p className={styles.heroDesc}>
            Important legal notices, brand satire disclaimers, and fulfillment terms.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.article}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Brand Expression &amp; Satire Notice</h2>
            <p className={styles.bodyText}>
              GERKINK is an independent streetwear brand centered around edgy satire, provocative copy, and counter-culture expression. 
              We have zero intention to cause harm, offend, or target any individual, group, or belief. The roasts, slogans, manifesto statements, and satirical commentary presented on this site are purely creative artistic expressions intended for entertainment, humor, apparel aesthetics, and cultural parody.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Product Mockups &amp; Visual Representation</h2>
            <p className={styles.bodyText}>
              All apparel items are custom-printed on demand after order placement. The imagery and 3D mockups displayed on our storefront serve as digital representations. 
              While we use high-density Direct-To-Garment (DTG) printing, final print colors and print placement may vary slightly due to device display settings and physical fabric texture.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Third-Party Fulfillment &amp; Services</h2>
            <p className={styles.bodyText}>
              Production, printing, and logistics are fulfilled through global print partner networks (including Printify). 
              While we guarantee product quality through our <Link href="/refund" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Free Replacement Policy</Link>, 
              unforeseen transit disruptions caused by shipping carriers, customs checks, or postal delays are outside GERKINK&apos;s direct control.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Limitation of Liability</h2>
            <p className={styles.bodyText}>
              To the maximum extent permitted by applicable law, GERKINK, its founders, and affiliates shall not be liable for any indirect, incidental, special, or consequential damages arising out of or related to your use of this website or products purchased. 
              Our total maximum liability for any claim shall not exceed the total amount paid by you for the specific order in question.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Contact Legal Support</h2>
            <p className={styles.bodyText}>
              If you have any questions or legal inquiries regarding this disclaimer, please reach out via email at{' '}
              <span className={styles.emphasis}>gerkinkofficial@gmail.com</span> or through our{' '}
              <Link href="/contact" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                Contact Page
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
