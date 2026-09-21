'use client';

import React from 'react';
import styles from './ProductFilters.module.css';

export type SortKey = 'newest' | 'price_asc' | 'price_desc';

interface ProductFiltersProps {
  onOpenFilter: () => void;
  activeFilterCount: number;
  resultCount: number;
  activeSort: SortKey;
  onSort: (sort: SortKey) => void;
  onClearFilters?: () => void;
}

const SORT_OPTIONS: { value: SortKey; label: string; mobileLabel: string }[] = [
  { value: 'newest',     label: 'Newest First',      mobileLabel: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low → High', mobileLabel: 'Low → High' },
  { value: 'price_desc', label: 'Price: High → Low', mobileLabel: 'High → Low' },
];

export default function ProductFilters({
  onOpenFilter,
  activeFilterCount,
  resultCount,
  activeSort,
  onSort,
  onClearFilters,
}: ProductFiltersProps) {
  const resultText = resultCount === 0
    ? 'NO PRODUCTS'
    : `${resultCount} ${resultCount === 1 ? 'PRODUCT' : 'PRODUCTS'}`;

  return (
    <div className={styles.toolbar}>
      {/* Left: Filter Trigger Button */}
      <div className={styles.leftGroup}>
        <button
          type="button"
          onClick={onOpenFilter}
          className={`${styles.filterBtn} ${activeFilterCount > 0 ? styles.filterBtnActive : ''}`}
          aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Open filters'}
          aria-haspopup="dialog"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span className={styles.filterBtnText}>FILTER</span>
          {activeFilterCount > 0 && (
            <span className={styles.filterBadge}>{activeFilterCount}</span>
          )}
        </button>

        {activeFilterCount > 0 && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className={styles.quickClearBtn}
            aria-label="Clear active filters"
          >
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Center: Dynamic Result Counter */}
      <div className={styles.countBadge}>
        <span className={styles.pulseDot} aria-hidden />
        <span className={styles.countText}>{resultText}</span>
      </div>

      {/* Right: Sort Control */}
      <div className={styles.sortGroup}>
        <label htmlFor="collection-sort-select" className={styles.sortLabel}>
          SORT:
        </label>
        <div className={styles.selectWrap}>
          <select
            id="collection-sort-select"
            value={activeSort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className={styles.sortSelect}
            aria-label="Sort products by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  );
}
