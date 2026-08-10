import Link from 'next/link';
import type { Product } from '@/types';
import PriceTag from '@/components/ui/PriceTag';
import styles from './TierPyramid.module.css';

interface TierPyramidProps {
  products: Product[];
}

const TIER_CONFIG = [
  { tier: 1, label: 'GOD TIER',       price: 10_000_000, max: 1,  description: 'One shirt. One legend.' },
  { tier: 2, label: 'OBSCENE',        price: 1_000_000,  max: 2,  description: "For those who've run out of ways to waste money." },
  { tier: 3, label: 'DELUSIONAL',     price: 100_000,    max: 5,  description: 'Your accountant is already calling.' },
  { tier: 4, label: 'WANNABE',        price: 10_000,     max: 10, description: 'You think you belong here. Maybe.' },
  { tier: 5, label: 'PEASANT PREMIUM',price: 1_000,      max: 999, description: 'Our "affordable" tier. Still more than your rent.' },
];

export default function TierPyramid({ products }: TierPyramidProps) {
  return (
    <div className={styles.pyramid}>
      {TIER_CONFIG.map((config) => {
        const tierProducts = products.filter((p) => p.tier === config.tier && p.isPublished);
        return (
          <div key={config.tier} className={`${styles.tier} ${styles[`tier${config.tier}`]}`}>
            <div className={styles.tierHeader}>
              <div className={styles.tierMeta}>
                <span className={`${styles.tierLabel} tag`}>{config.label}</span>
                <PriceTag price={config.price} tier={config.tier as 1|2|3|4|5} size="lg" />
              </div>
              <p className={styles.tierDesc}>{config.description}</p>
            </div>

            {tierProducts.length > 0 ? (
              <div className={`${styles.tierGrid} ${styles[`grid${Math.min(config.tier, 3)}`]}`}>
                {tierProducts.map((product) => (
                  <Link key={product.id} href={`/shop/${product.slug || product.id}`} className={styles.productCard}>
                    <div className={styles.productImg}>
                      {product.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.images[0]} alt={product.title} />
                      ) : (
                        <div className={styles.imgPlaceholder}>GERKINK</div>
                      )}
                    </div>
                    <div className={styles.productInfo}>
                      <span className={styles.productTitle}>{product.title}</span>
                      <PriceTag price={product.price} tier={config.tier as 1|2|3|4|5} size="md" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyText}>
                  {config.tier === 1
                    ? 'The gods are getting dressed.'
                    : 'Coming for those with the nerve.'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
