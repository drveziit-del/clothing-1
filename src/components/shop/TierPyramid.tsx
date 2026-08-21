'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/types';
import PriceTag from '@/components/ui/PriceTag';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './TierPyramid.module.css';

interface TierPyramidProps {
  products: Product[];
}

interface TierConfig {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  name: string;
  price: number;
  maxSupply: string;
  badgeStyle: string;
  cardBorderClass: string;
  description: string;
  perks: { icon: string; title: string; desc: string }[];
}

const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 1,
    label: 'TIER 1 • GOD TIER',
    name: 'God Tier',
    price: 10_000_000,
    maxSupply: '1 OF 1 GLOBAL EDITION',
    badgeStyle: styles.badgeGold,
    cardBorderClass: styles.cardBorderGold,
    description: 'The pinnacle of absurdist luxury. One shirt minted globally for the single individual with more capital than sanity.',
    perks: [
      { icon: '🔒', title: 'Titanium Flight Case', desc: 'Encased in a custom locked ballistic vault.' },
      { icon: '✈️', title: 'Armed Courier Transit', desc: 'Hand-delivered anywhere on Earth.' },
      { icon: '👑', title: 'Minted 1/1 Serial', desc: 'Micro-engraved cryptographic NFC seal.' },
      { icon: '📞', title: 'Direct Phone to Nobody', desc: 'Private line with zero corporate reception.' },
    ],
  },
  {
    tier: 2,
    label: 'TIER 2 • OBSCENE',
    name: 'Obscene',
    price: 1_000_000,
    maxSupply: '2 PIECES WORLDWIDE',
    badgeStyle: styles.badgePlatinum,
    cardBorderClass: styles.cardBorderPlatinum,
    description: 'Designed exclusively for individuals who have exhausted all conventional methods of wasting generational wealth.',
    perks: [
      { icon: '📜', title: 'Numbered Certificate', desc: 'Printed on 600GSM archival cotton parchment.' },
      { icon: '🌐', title: 'Tracked VIP Courier', desc: 'White-glove priority express transit.' },
      { icon: '💎', title: 'Bespoke Serial Plaque', desc: 'Individually serialized garment tag.' },
    ],
  },
  {
    tier: 3,
    label: 'TIER 3 • DELUSIONAL',
    name: 'Delusional',
    price: 100_000,
    maxSupply: '5 PIECES WORLDWIDE',
    badgeStyle: styles.badgeRose,
    cardBorderClass: styles.cardBorderCoral,
    description: 'Your accountant is already having a cardiac episode. Wear your irrationality with pride.',
    perks: [
      { icon: '📦', title: 'Custom Vault Packaging', desc: 'Matte black sealed display case.' },
      { icon: '🏷️', title: 'NFC Verification', desc: 'Instant authentication on the blockchain.' },
    ],
  },
  {
    tier: 4,
    label: 'TIER 4 • WANNABE',
    name: 'Wannabe',
    price: 10_000,
    maxSupply: '10 PIECES WORLDWIDE',
    badgeStyle: styles.badgeCoral,
    cardBorderClass: styles.cardBorderCoral,
    description: 'You believe you belong at the top of the pyramid. This $10,000 statement is your audition.',
    perks: [
      { icon: '🛡️', title: '240GSM Heavyweight', desc: 'Double-needle structural yarn collar.' },
      { icon: '🚀', title: 'Express Dispatch', desc: 'Fully tracked door-to-door courier.' },
    ],
  },
  {
    tier: 5,
    label: 'TIER 5 • PEASANT PREMIUM',
    name: 'Peasant Premium',
    price: 1_000,
    maxSupply: '999 PIECES WORLDWIDE',
    badgeStyle: styles.badgeSteel,
    cardBorderClass: '',
    description: 'Our entry-level absurdity. Still considerably more expensive than your monthly rent.',
    perks: [
      { icon: '👕', title: 'Zero-Fade Ink', desc: 'Direct-to-garment DTG pigment injection.' },
      { icon: '🌍', title: 'Global Delivery', desc: 'Fulfilled via Printify international hubs.' },
    ],
  },
];

export default function TierPyramid({ products }: TierPyramidProps) {
  const [selectedTier, setSelectedTier] = useState<number | 'all'>('all');
  const { formatPrice } = useCurrency();

  const filteredConfigs = selectedTier === 'all'
    ? TIER_CONFIGS
    : TIER_CONFIGS.filter((c) => c.tier === selectedTier);

  return (
    <div>
      {/* Sticky Interactive Tier Quick Navigation Bar */}
      <nav className={styles.navWrapper} aria-label="Tier Quick Navigation">
        <div className={styles.navContainer}>
          <div className={styles.navTabs}>
            <button
              onClick={() => setSelectedTier('all')}
              className={`${styles.navTab} ${selectedTier === 'all' ? styles.navTabActive : ''}`}
            >
              All Tiers
              <span className={styles.filterBadge}>({products.length})</span>
            </button>

            {TIER_CONFIGS.map((config) => {
              const count = products.filter((p) => p.tier === config.tier && p.isPublished).length;
              const isActive = selectedTier === config.tier;
              const activeClass =
                config.tier === 1
                  ? styles.navTabActiveGold
                  : config.tier === 2
                  ? styles.navTabActiveMist
                  : config.tier === 3 || config.tier === 4
                  ? styles.navTabActiveCoral
                  : styles.navTabActive;

              return (
                <button
                  key={config.tier}
                  onClick={() => setSelectedTier(config.tier)}
                  className={`${styles.navTab} ${isActive ? activeClass : ''}`}
                >
                  {config.name}
                  <span className={styles.filterBadge}>
                    • {formatPrice(config.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Tier Pyramid Showcase */}
      <div className={styles.pyramid}>
        {filteredConfigs.map((config) => {
          const tierProducts = products.filter(
            (p) => p.tier === config.tier && p.isPublished
          );

          return (
            <section
              key={config.tier}
              id={`tier-${config.tier}`}
              className={`${styles.tier} ${styles[`tier${config.tier}`]}`}
            >
              {config.tier === 1 && <div className={styles.tier1Glow} aria-hidden />}

              <div className={styles.tierInner}>
                {/* Tier Header Meta */}
                <div className={styles.tierHeader}>
                  <div className={styles.tierMetaRow}>
                    <div className={styles.tierPills}>
                      <span className={`${styles.tierTitleBadge} ${config.badgeStyle}`}>
                        {config.label}
                      </span>
                      <span className={styles.scarcityTag}>
                        <span className={styles.scarcityDot} />
                        {config.maxSupply}
                      </span>
                    </div>

                    <PriceTag
                      price={config.price}
                      tier={config.tier}
                      size="xl"
                    />
                  </div>

                  <p className={styles.tierDesc}>{config.description}</p>

                  {/* VIP Perks Grid */}
                  <div className={styles.perksGrid}>
                    {config.perks.map((perk, i) => (
                      <div key={i} className={styles.perkCard}>
                        <span className={styles.perkIcon}>{perk.icon}</span>
                        <div className={styles.perkMeta}>
                          <span className={styles.perkTitle}>{perk.title}</span>
                          <span className={styles.perkDesc}>{perk.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Products Grid for this Tier */}
                {tierProducts.length > 0 ? (
                  <div
                    className={`${styles.tierGrid} ${
                      styles[`grid${Math.min(config.tier, 3)}`]
                    }`}
                  >
                    {tierProducts.map((product) => (
                      <Link
                        key={product.id}
                        href={`/shop/${product.slug || product.id}`}
                        className={`${styles.luxuryProductCard} ${config.cardBorderClass}`}
                      >
                        <div className={styles.productImageWrap}>
                          <span className={styles.editionPill}>
                            TIER {config.tier} • {config.name}
                          </span>
                          {product.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              loading="lazy"
                            />
                          ) : (
                            <div className={styles.vaultIcon}>✦</div>
                          )}
                        </div>

                        <div className={styles.productBody}>
                          <div className={styles.productMain}>
                            <h3 className={styles.productTitle}>{product.title}</h3>
                            {(product.manifestoQuote || product.description) && (
                              <p className={styles.productTagline}>
                                {product.manifestoQuote || (product.description.length > 80 ? `${product.description.slice(0, 80)}...` : product.description)}
                              </p>
                            )}
                          </div>

                          <div className={styles.productFooter}>
                            <PriceTag
                              price={product.price}
                              tier={config.tier}
                              size="md"
                            />
                            <span className={styles.claimButton}>
                              Acquire Piece →
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  /* High-End Vault Status when no product is currently published in this tier */
                  <div className={styles.vaultCard}>
                    <div className={styles.vaultIcon}>🏛️</div>
                    <h3 className={styles.vaultTitle}>
                      {config.tier === 1
                        ? 'THE GOD TIER IS BEING FORGED'
                        : `${config.name.toUpperCase()} VAULT LOCKED`}
                    </h3>
                    <p className={styles.vaultDesc}>
                      {config.tier === 1
                        ? 'The 1-of-1 $10,000,000 centerpiece is currently in bespoke production. Concierge inquiries accepted.'
                        : `Limited allocations for ${config.name} ($${config.price.toLocaleString()}) are prepared in private batch drops.`}
                    </p>
                    <Link href="/contact" className="btn btn-secondary btn-sm">
                      Contact Concierge Desk →
                    </Link>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Interactive Absurdity Index Comparison Section */}
      <section className={styles.absurditySection}>
        <div className={styles.absurdityInner}>
          <div className={styles.absurdityHeader}>
            <span className="tag tag-mist">ECONOMIC REALITY CHECK</span>
            <h2 className={styles.absurdityTitle}>The Absurdity Index</h2>
            <p className={styles.absurditySub}>
              Before you swipe your titanium card, here is exactly what else you could purchase with your tier budget.
            </p>
          </div>

          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonCard}>
              <span className="tag tag-gold" style={{ width: 'fit-content', color: '#FFD700', borderColor: 'rgba(255,215,0,0.4)' }}>
                GOD TIER • $10,000,000
              </span>
              <span className={styles.comparisonPrice}>$10,000,000</span>
              <div className={styles.comparisonList}>
                <div className={styles.comparisonItem}>Private Island in Central America</div>
                <div className={styles.comparisonItem}>4 Custom 80ft Catamaran Superyachts</div>
                <div className={styles.comparisonItem}>One (1) GERKINK God-Tier T-Shirt</div>
              </div>
            </div>

            <div className={styles.comparisonCard}>
              <span className="tag tag-mist" style={{ width: 'fit-content' }}>
                OBSCENE • $1,000,000
              </span>
              <span className={styles.comparisonPrice}>$1,000,000</span>
              <div className={styles.comparisonList}>
                <div className={styles.comparisonItem}>2 Commercial Real Estate Units</div>
                <div className={styles.comparisonItem}>3 Brand-New Ferrari SF90 Stradales</div>
                <div className={styles.comparisonItem}>One (1) GERKINK Obscene Heavyweight Hoodie</div>
              </div>
            </div>

            <div className={styles.comparisonCard}>
              <span className="tag tag-coral" style={{ width: 'fit-content' }}>
                DELUSIONAL • $100,000
              </span>
              <span className={styles.comparisonPrice}>$100,000</span>
              <div className={styles.comparisonList}>
                <div className={styles.comparisonItem}>Full 4-Year Ivy League Tuition</div>
                <div className={styles.comparisonItem}>A Down Payment on a Manhattan Loft</div>
                <div className={styles.comparisonItem}>One (1) GERKINK Delusional Streetwear Piece</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
