import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Shop — GERKINK',
  description: 'Browse the official GERKINK shop. Explore the Society Fuckers and Valueless Bitches luxury streetwear collections. Pick your poison and wear your worth.',
  openGraph: {
    title: 'Shop — GERKINK',
    description: 'Browse the official GERKINK shop. Explore the Society Fuckers and Valueless Bitches luxury streetwear collections. Pick your poison and wear your worth.',
    url: '/shop',
  },
  twitter: {
    title: 'Shop — GERKINK',
    description: 'Browse the official GERKINK shop. Explore the Society Fuckers and Valueless Bitches luxury streetwear collections. Pick your poison and wear your worth.',
  },
  alternates: {
    canonical: '/shop',
  },
};

export default function ShopPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className="text-label" style={{ color: 'var(--text-muted)' }}>Choose your poison</p>
        <h1 className="text-display">The Shop</h1>
        <p className={styles.headerDesc}>
          Two collections. Zero apologies. Pick the one that matches your level of audacity.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Society Fu*kers */}
        <Link href="/shop/society-fuckers" className={`${styles.card} ${styles.cardDark}`}>
          <div className={styles.cardBg} aria-hidden />
          <div className={styles.cardContent}>
            <span className="tag tag-mist">Tier-based luxury</span>
            <h2 className={styles.cardTitle}>Society<br />Fu*kers</h2>
            <div className={styles.cardMeta}>
              <span className={styles.priceRange}>$1,000 — $10,000,000</span>
              <p className={styles.cardDesc}>
                Five tiers of escalating absurdity. From "expensive but fine" 
                to "you own a small country and still chose a t-shirt."
              </p>
            </div>
            <div className={styles.tiers}>
              {[
                { label: 'Peasant Premium', price: '$1K' },
                { label: 'Wannabe',         price: '$10K' },
                { label: 'Delusional',      price: '$100K' },
                { label: 'Obscene',         price: '$1M' },
                { label: 'God Tier',        price: '$10M' },
              ].map((t) => (
                <div key={t.label} className={styles.tierRow}>
                  <span className={styles.tierName}>{t.label}</span>
                  <span className={styles.tierPrice}>{t.price}</span>
                </div>
              ))}
            </div>
            <span className={styles.cardCta}>Enter the Hierarchy →</span>
          </div>
        </Link>

        {/* Valueless Bi*ches */}
        <Link href="/shop/valueless-bitches" className={`${styles.card} ${styles.cardCoral}`}>
          <div className={styles.cardBg} aria-hidden />
          <div className={styles.cardContent}>
            <span className="tag tag-coral">Streetwear</span>
            <h2 className={styles.cardTitle}>Valueless<br />Bi*ches</h2>
            <div className={styles.cardMeta}>
              <span className={styles.priceRange}>Price varies</span>
              <p className={styles.cardDesc}>
                T-shirts. Hoodies. Accessories. All designed to make you 
                look like you have a personality. Results may vary.
              </p>
            </div>
            <div className={styles.categories}>
              {['T-Shirts', 'Hoodies', 'Accessories', 'Limited'].map((cat) => (
                <span key={cat} className="tag">{cat}</span>
              ))}
            </div>
            <span className={styles.cardCta}>Browse the Chaos →</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
