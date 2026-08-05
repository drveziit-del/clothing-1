import styles from '../support.module.css';

export const metadata = {
  title: 'Shipping Information — GERKINK',
  description: '14 business-days delivery. Custom printed, packaged, and shipped worldwide.',
};

export default function ShippingPage() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>GERKINK</span>
          <h1 className={styles.heroTitle}>Shipping Info</h1>
          <p className={styles.heroDesc}>
            How we get our clothes from our print providers to your door.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.article}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Delivery Timeline</h2>
            <p className={styles.bodyText}>
              All items are custom-printed on demand to order. We estimate a standard delivery timeline of{' '}
              <span className={styles.emphasis}>21 business days</span>.
            </p>
            <p className={styles.bodyText}>
              This timeline accounts for print production, packaging, shipping handler processing, and final transit.
              Please note that weekends, holidays, and high-demand periods do not count toward business days.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Tracking Your Order</h2>
            <p className={styles.bodyText}>
              As soon as the print provider completes production and ships your package, a tracking link is generated.
              If you have an account, the tracking details will automatically sync and display in your{' '}
              <span className={styles.emphasis}>Account Dashboard</span>. You will also receive an email notification
              containing the tracking link.
            </p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Custom Duties &amp; Taxes</h2>
            <p className={styles.bodyText}>
              Depending on your country and address, imports may be subject to local customs duties or VAT fees.
              These fees are set by your local government and are the sole responsibility of the customer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
