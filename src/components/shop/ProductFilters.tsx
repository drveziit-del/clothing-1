'use client';

import styles from './ProductFilters.module.css';

export type SortKey = 'newest' | 'price_asc' | 'price_desc';

interface ProductFiltersProps {
  categories: string[];
  activeCategory: string;
  activeSort: SortKey;
  onCategory: (cat: string) => void;
  onSort: (sort: SortKey) => void;
  resultCount: number;
}

const SORT_OPTIONS: { value: SortKey; label: string; mobileLabel: string }[] = [
  { value: 'newest',     label: 'Newest',            mobileLabel: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low → High', mobileLabel: 'Low → High' },
  { value: 'price_desc', label: 'Price: High → Low', mobileLabel: 'High → Low' },
];

export default function ProductFilters({
  categories,
  activeCategory,
  activeSort,
  onCategory,
  onSort,
  resultCount,
}: ProductFiltersProps) {
  const allCategories = ['All Pieces', ...categories];

  return (
    <div className={styles.filterToolbar}>
      {/* Category Pills */}
      <div className={styles.categoryScroll}>
        {allCategories.map((cat) => {
          const isSelected = cat === 'All Pieces' ? activeCategory === '' : activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategory(cat === 'All Pieces' ? '' : cat)}
              className={`${styles.catPill} ${isSelected ? styles.catPillActive : ''}`}
            >
              {isSelected && <span className={styles.activeDot} />}
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Counter & Sort */}
      <div className={styles.toolbarRight}>
        <div className={styles.itemCountBadge}>
          <span className={styles.pulseDot} />
          <span>{resultCount} {resultCount === 1 ? 'Garment' : 'Garments'}</span>
        </div>

        <div className={styles.sortSegmented}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSort(opt.value)}
              className={`${styles.sortTab} ${activeSort === opt.value ? styles.sortTabActive : ''}`}
            >
              <span className={styles.desktopLabel}>{opt.label}</span>
              <span className={styles.mobileLabel}>{opt.mobileLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
