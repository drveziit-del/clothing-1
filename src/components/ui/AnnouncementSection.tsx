'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AnnouncementItem,
  AnnouncementCategory,
  DEFAULT_ANNOUNCEMENTS,
} from './announcementData';
import styles from './AnnouncementSection.module.css';

export interface AnnouncementSectionProps {
  /**
   * Top badge/label text. Defaults to "ANNOUNCEMENT"
   */
  label?: string;
  /**
   * Subtext next to the top label in the badge. Defaults to "OFFICIAL BROADCAST"
   */
  sublabel?: string;
  /**
   * Section headline. Defaults to "System Dispatches & Updates"
   */
  title?: string;
  /**
   * Subtitle description.
   */
  subtitle?: string;
  /**
   * Active category filter preset. Defaults to "all"
   */
  defaultCategory?: 'all' | AnnouncementCategory;
  /**
   * Array of announcement items. Defaults to brand default announcements.
   */
  items?: AnnouncementItem[];
  /**
   * Display variant:
   * - "section": full section with header, tabs, and cards
   * - "grid": clean grid of cards with top header
   * - "banner": compact inline announcement bar
   */
  variant?: 'section' | 'grid' | 'banner';
  /**
   * Whether to show filter category tabs (ALL, DROPS, RESTOCKS, etc.)
   */
  showTabs?: boolean;
  /**
   * Custom CSS class name
   */
  className?: string;
  /**
   * Optional custom banner link
   */
  bannerCtaText?: string;
  bannerCtaLink?: string;
}

export default function AnnouncementSection({
  label = 'ANNOUNCEMENT',
  sublabel = 'OFFICIAL BROADCAST',
  title = 'Dispatches & Operational Updates',
  subtitle = 'Live status reports on seasonal drops, warehouse restocks, global air shipping, and affiliate milestones.',
  defaultCategory = 'all',
  items = DEFAULT_ANNOUNCEMENTS,
  variant = 'section',
  showTabs = true,
  className = '',
  bannerCtaText,
  bannerCtaLink,
}: AnnouncementSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | AnnouncementCategory>(defaultCategory);

  const filteredItems = items.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const categories: Array<{ key: 'all' | AnnouncementCategory; label: string }> = [
    { key: 'all', label: 'All Updates' },
    { key: 'drop', label: 'Drops' },
    { key: 'restock', label: 'Restocks' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'promo', label: 'Rewards' },
  ];

  // Helper for category badge classes
  const getBadgeClass = (category: AnnouncementCategory) => {
    switch (category) {
      case 'drop':
        return styles.badgeDrop;
      case 'restock':
        return styles.badgeRestock;
      case 'shipping':
        return styles.badgeShipping;
      case 'promo':
        return styles.badgePromo;
      default:
        return '';
    }
  };

  // ─── Compact Banner Variant ──────────────────────────────────────────────
  if (variant === 'banner') {
    const featured = items[0] || DEFAULT_ANNOUNCEMENTS[0];
    const targetLink = bannerCtaLink || featured.ctaLink || '/shop';
    const targetText = bannerCtaText || featured.ctaText || 'Learn More →';

    return (
      <aside className={`${styles.banner} ${className}`} aria-label="Announcement banner">
        <div className={styles.bannerInner}>
          <div className={styles.bannerLeft}>
            <div className={styles.labelWrapper} style={{ marginBottom: 0 }}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <span className={styles.labelText}>{label}</span>
              {sublabel && <span className={styles.labelSubtext}>{sublabel}</span>}
            </div>
            <div className={styles.bannerText}>
              <span className={styles.bannerHighlight}>{featured.highlight || featured.title}</span>
              <span className="hidden sm:inline">— {featured.description}</span>
            </div>
          </div>
          {targetLink && (
            <Link href={targetLink} className={styles.bannerLink}>
              {targetText}
            </Link>
          )}
        </div>
      </aside>
    );
  }

  // ─── Full Section & Grid Variants ────────────────────────────────────────
  return (
    <section className={`${styles.section} ${className}`} aria-label="Announcements section">
      <div className={styles.gridGlow} aria-hidden="true" />

      <div className={styles.container}>
        {/* ── Top Header with Prominent ANNOUNCEMENT Label ── */}
        <div className={styles.header}>
          <div className={styles.labelWrapper}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span className={styles.labelText}>{label}</span>
            {sublabel && <span className={styles.labelSubtext}>{sublabel}</span>}
          </div>

          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        {/* ── Optional Category Filter Tabs ── */}
        {showTabs && (
          <div className={styles.tabRow} role="tablist" aria-label="Announcement categories">
            {categories.map((cat) => (
              <button
                key={cat.key}
                role="tab"
                aria-selected={selectedCategory === cat.key}
                className={`${styles.tabBtn} ${selectedCategory === cat.key ? styles.activeTab : ''}`}
                onClick={() => setSelectedCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Announcements Grid ── */}
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const badgeClass = getBadgeClass(item.category);

            return (
              <article
                key={item.id}
                className={styles.card}
                data-category={item.category}
              >
                <div className={styles.cardAccent} aria-hidden="true" />

                <div>
                  {/* Card Top: Category Badge & Date */}
                  <div className={styles.cardTop}>
                    <span className={`${styles.categoryBadge} ${badgeClass}`}>
                      {item.categoryLabel || item.category.toUpperCase()}
                    </span>
                    {item.dateBadge && (
                      <span className={styles.dateBadge}>{item.dateBadge}</span>
                    )}
                  </div>

                  {/* Title & Highlight */}
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  {item.highlight && (
                    <span className={styles.cardHighlight}>{item.highlight}</span>
                  )}

                  {/* Description */}
                  <p className={styles.cardDesc}>{item.description}</p>

                  {/* Metadata row */}
                  {item.meta && (
                    <div className={styles.metaRow}>
                      {item.meta.tag && (
                        <span className={styles.metaPill}>
                          TAG: <strong className={styles.metaPillStrong}>{item.meta.tag}</strong>
                        </span>
                      )}
                      {item.meta.stockStatus && (
                        <span className={styles.metaPill}>
                          STATUS: <strong className={styles.metaPillStrong}>{item.meta.stockStatus}</strong>
                        </span>
                      )}
                      {item.meta.dispatchTimeline && (
                        <span className={styles.metaPill}>
                          DISPATCH: <strong className={styles.metaPillStrong}>{item.meta.dispatchTimeline}</strong>
                        </span>
                      )}
                      {item.meta.discountCode && (
                        <span className={styles.metaPill}>
                          PERK: <strong className={styles.metaPillStrong}>{item.meta.discountCode}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Call to Actions */}
                {(item.ctaLink || item.secondaryCtaLink) && (
                  <div className={styles.ctaRow}>
                    {item.ctaLink && (
                      <Link href={item.ctaLink} className={styles.primaryCta}>
                        {item.ctaText || 'Learn More →'}
                      </Link>
                    )}
                    {item.secondaryCtaLink && (
                      <Link href={item.secondaryCtaLink} className={styles.secondaryCta}>
                        {item.secondaryCtaText || 'Details'}
                      </Link>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
