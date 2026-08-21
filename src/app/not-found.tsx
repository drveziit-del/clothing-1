import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata = {
  title: '404: Page Not Found — GERKINK',
  description: 'The page you are looking for does not exist. Turn back and fix your wardrobe at GERKINK.',
};

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <span className={styles.tag}>Error 404</span>
        <h1 className={styles.glitchNumber}>404</h1>
        <h2 className={styles.title}>LOST IN THE VOID</h2>
        <p className={styles.roast}>
          The page you requested doesn&#39;t exist. Much like your excuses for wearing basic, uninspired clothes.
        </p>

        <div className={styles.buttonRow}>
          <Link href="/shop" className="btn btn-primary btn-lg">
            Return to Shop →
          </Link>
          <Link href="/" className="btn btn-secondary btn-lg">
            Homepage
          </Link>
        </div>

        <div className={styles.exploreGrid}>
          <Link href="/shop/society-fuckers" className={styles.exploreCard}>
            <span className={styles.exploreTitle}>Society Fu*kers →</span>
            <span className={styles.exploreSubtitle}>$1,000 – $10,000,000 tier luxury streetwear</span>
          </Link>

          <Link href="/shop/valueless-bitches" className={styles.exploreCard}>
            <span className={styles.exploreTitle}>Valueless Bi*ches →</span>
            <span className={styles.exploreSubtitle}>Everyday provocative streetwear &amp; hoodies</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
