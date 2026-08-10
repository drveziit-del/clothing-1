import styles from '../support.module.css';

export const metadata = {
  title: 'Terms & Conditions — GERKINK',
  description: 'Read the official Terms of Service, billing conditions, intellectual property rules, and code of conduct for purchasing custom streetwear items from GERKINK.',
  openGraph: {
    title: 'Terms & Conditions — GERKINK',
    description: 'Read the official Terms of Service, billing conditions, intellectual property rules, and code of conduct for purchasing custom streetwear items from GERKINK.',
    url: '/terms',
  },
  twitter: {
    title: 'Terms & Conditions — GERKINK',
    description: 'Read the official Terms of Service, billing conditions, intellectual property rules, and code of conduct for purchasing custom streetwear items from GERKINK.',
  },
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const termsFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What are the terms of agreement?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "By accessing or using our website, you agree to be bound by these Terms of Service. If you do not agree, please leave immediately. Your presence here is voluntary, your purchases are binding, and your style complaints will be ignored."
        }
      },
      {
        "@type": "Question",
        "name": "Who owns the intellectual property?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All content on this site, including designs, illustrations, texts, mockups, logos, and code, is the property of GERKINK. Do not copy, replicate, or repurpose our designs unless you want to hear from our legal counsel."
        }
      },
      {
        "@type": "Question",
        "name": "How do purchases and payments work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We accept payments via Razorpay. You guarantee that all payment information provided is accurate and that you are authorized to make the transaction. All prices are displayed in USD (or converted locally) and are subject to change without notice."
        }
      },
      {
        "@type": "Question",
        "name": "What is the governing law?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "These terms are governed by and construed in accordance with the laws governing our brand operations. Any disputes arising from these terms will be settled exclusively in the competent courts of our choice."
        }
      },
      {
        "@type": "Question",
        "name": "How can I contact support for terms?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "For legal inquiries or questions regarding our terms, reach out via the support email listed on our contact page."
        }
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termsFaqSchema) }}
      />
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>GERKINK</span>
          <h1 className={styles.heroTitle}>Terms of Service</h1>
          <p className={styles.heroDesc}>
            The fine print you won&apos;t read, but are legally bound by anyway. Welcome to the club.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.article}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>1. What are the terms of agreement?</h2>
            <p className={styles.bodyText}>
              By accessing or using our website, you agree to be bound by these Terms of Service. If you do not agree, 
              please leave immediately. Your presence here is voluntary, your purchases are binding, and your style 
              complaints will be ignored.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Who owns the intellectual property?</h2>
            <p className={styles.bodyText}>
              All content on this site, including designs, illustrations, texts, mockups, logos, and code, is the property 
              of GERKINK. Do not copy, replicate, or repurpose our designs unless you want to hear from our legal counsel. 
              Be original. It&apos;s better for your personality anyway.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>3. How do purchases and payments work?</h2>
            <p className={styles.bodyText}>
              We accept payments via Razorpay. You guarantee that all payment information provided is accurate and that 
              you are authorized to make the transaction. All prices are displayed in USD (or converted locally) and are 
              subject to change without notice. We reserve the right to refuse or cancel any order at our discretion.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>4. What is the governing law?</h2>
            <p className={styles.bodyText}>
              These terms are governed by and construed in accordance with the laws governing our brand operations. Any 
              disputes arising from these terms will be settled exclusively in the competent courts of our choice.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>5. How can I contact support for terms?</h2>
            <p className={styles.bodyText}>
              For legal inquiries or questions regarding our terms, reach out via the support email listed on our contact page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
