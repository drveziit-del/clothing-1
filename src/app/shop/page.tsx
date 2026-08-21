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
      {/* ── HEADER ────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.categoryLabel}>Choose your poison</p>
          <h1 className={styles.pageTitle}>The Shop</h1>
          <p className={styles.pageDesc}>
            Two distinct collections. Zero corporate apologies. Pick the one that matches your level of audacity.
          </p>
        </div>
      </header>

      {/* ── BENTO GRID ────────────────────────────────────── */}
      <section className={styles.bentoSection}>
        <div className={styles.bentoGrid}>

          {/* Bento Card 1: Society Fu*kers (2 Cols) */}
          <Link href="/shop/society-fuckers" className={`${styles.bentoCard} ${styles.colSpan2}`}>
            <div className={styles.cardHeader}>
              <div className={styles.tagRow}>
                <span className={styles.tagBadge}>TIER-BASED LUXURY</span>
              </div>
              <h2 className={styles.cardHeadingLarge}>Society Fu*kers</h2>
              <p className={styles.cardSubtext}>
                Five escalating tiers of unapologetic luxury. From $1,000 to $10,000,000. For those with more capital than shame.
              </p>
            </div>

            <div className={styles.tierGrid}>
              {[
                { name: 'Peasant Premium', price: '$1,000' },
                { name: 'Wannabe', price: '$10,000' },
                { name: 'Delusional', price: '$100,000' },
                { name: 'Obscene', price: '$1,000,000' },
                { name: 'God Tier', price: '$10,000,000' },
              ].map((tier) => (
                <div key={tier.name} className={styles.tierRow}>
                  <span className={styles.tierName}>{tier.name}</span>
                  <span className={styles.tierPrice}>{tier.price}</span>
                </div>
              ))}
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.ctaLink}>
                <span>Enter the Hierarchy</span>
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>

          {/* Bento Card 2: Valueless Bi*ches (1 Col) */}
          <Link href="/shop/valueless-bitches" className={`${styles.bentoCard} ${styles.colSpan1}`}>
            <div className={styles.cardHeader}>
              <div className={styles.tagRow}>
                <span className={styles.tagBadgeCoral}>EVERYDAY APPAREL</span>
              </div>
              <h2 className={styles.cardHeading}>Valueless Bi*ches</h2>
              <p className={styles.cardSubtext}>
                Provocative graphics on 240GSM heavyweight yarn. Wearable chaos that speaks louder than your bio.
              </p>
            </div>

            <div className={styles.tagCloud}>
              <span className={styles.specTag}>Heavyweight Tees</span>
              <span className={styles.specTag}>Oversized Hoodies</span>
              <span className={styles.specTag}>Accessories</span>
              <span className={styles.specTag}>Limited</span>
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.ctaLinkCoral}>
                <span>Browse Streetwear</span>
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>

        </div>
      </section>
    </div>
  );
}
