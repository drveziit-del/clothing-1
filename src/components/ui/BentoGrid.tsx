'use client';

import React, { useRef, ReactNode, ElementType } from 'react';
import Link from 'next/link';
import styles from './BentoGrid.module.css';

interface BentoGridProps {
  children: ReactNode;
  columns?: 3 | 4;
  className?: string;
}

export function BentoGrid({ children, columns = 3, className = '' }: BentoGridProps) {
  return (
    <div
      className={`${styles.bentoGrid} ${columns === 4 ? styles.bentoGrid4 : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  title?: string;
  description?: string;
  badge?: string;
  badgeType?: 'coral' | 'mist' | 'default';
  href?: string;
  ctaText?: string;
  colSpan?: 1 | 2 | 3 | 'full';
  rowSpan?: 1 | 2;
  variant?: 'default' | 'coral' | 'mist';
  background?: ReactNode;
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function BentoCard({
  title,
  description,
  badge,
  badgeType = 'default',
  href,
  ctaText,
  colSpan = 1,
  rowSpan = 1,
  variant = 'default',
  background,
  headerSlot,
  footerSlot,
  children,
  className = '',
  onClick,
}: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  const spanClass =
    colSpan === 'full'
      ? styles.colSpanFull
      : colSpan === 3
      ? styles.colSpan3
      : colSpan === 2
      ? styles.colSpan2
      : styles.colSpan1;

  const rowClass = rowSpan === 2 ? styles.rowSpan2 : styles.rowSpan1;
  const variantClass =
    variant === 'coral'
      ? styles.cardCoral
      : variant === 'mist'
      ? styles.cardMist
      : '';

  const cardContent = (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={`${styles.bentoCard} ${spanClass} ${rowClass} ${variantClass} ${className}`}
    >
      <div className={styles.glowOverlay} aria-hidden />

      {background && <div className={styles.cardBg}>{background}</div>}

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          {badge && (
            <div className={styles.badgeRow}>
              <span
                className={`tag ${
                  badgeType === 'coral'
                    ? 'tag-coral'
                    : badgeType === 'mist'
                    ? 'tag-mist'
                    : ''
                }`}
              >
                {badge}
              </span>
            </div>
          )}

          {headerSlot}

          {title && (
            <h3
              className={`${styles.cardTitle} ${
                colSpan === 2 || colSpan === 3 ? styles.cardTitleLarge : ''
              }`}
            >
              {title}
            </h3>
          )}

          {description && <p className={styles.cardDesc}>{description}</p>}
        </div>

        {children}

        {(ctaText || footerSlot) && (
          <div className={styles.cardFooter}>
            {footerSlot || <div />}
            {ctaText && <span className={styles.cardCta}>{ctaText}</span>}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: 'contents', textDecoration: 'none' }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
