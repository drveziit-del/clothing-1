'use client';

import React, { useMemo } from 'react';
import { useFocusTrap } from '@/lib/utils/useFocusTrap';
import styles from './FilterDrawer.module.css';

export interface ColorOption {
  name: string;
  hex?: string;
}

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Available dynamic attributes
  availableCategories: string[];
  availableSizes: string[];
  availableColors: ColorOption[];
  catalogMinPrice: number;
  catalogMaxPrice: number;
  hasAvailabilityFilter: boolean;
  // Active filter state
  activeCategories: string[];
  activeSizes: string[];
  activeColors: string[];
  activeMinPrice: number;
  activeMaxPrice: number;
  activeInStockOnly: boolean;
  // Change handlers
  onToggleCategory: (category: string) => void;
  onToggleSize: (size: string) => void;
  onToggleColor: (color: string) => void;
  onChangePriceRange: (min: number, max: number) => void;
  onToggleInStock: (inStock: boolean) => void;
  onClearAll: () => void;
  // Result count
  filteredCount: number;
  totalCount: number;
}

export default function FilterDrawer({
  isOpen,
  onClose,
  availableCategories,
  availableSizes,
  availableColors,
  catalogMinPrice,
  catalogMaxPrice,
  hasAvailabilityFilter,
  activeCategories,
  activeSizes,
  activeColors,
  activeMinPrice,
  activeMaxPrice,
  activeInStockOnly,
  onToggleCategory,
  onToggleSize,
  onToggleColor,
  onChangePriceRange,
  onToggleInStock,
  onClearAll,
  filteredCount,
  totalCount,
}: FilterDrawerProps) {
  const drawerRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += activeCategories.length;
    count += activeSizes.length;
    count += activeColors.length;
    if (activeMinPrice > catalogMinPrice || activeMaxPrice < catalogMaxPrice) count += 1;
    if (activeInStockOnly) count += 1;
    return count;
  }, [activeCategories, activeSizes, activeColors, activeMinPrice, activeMaxPrice, activeInStockOnly, catalogMinPrice, catalogMaxPrice]);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === drawerRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-drawer-title"
    >
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <h2 id="filter-drawer-title" className={styles.title}>
              FILTER BY
            </h2>
            {activeFiltersCount > 0 && (
              <span className={styles.activeBadge}>{activeFiltersCount} ACTIVE</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close filter drawer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className={styles.body}>
          {/* 1. Category Filter (Dynamically rendered if available) */}
          {availableCategories.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>CATEGORY</h3>
                {activeCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => activeCategories.forEach((c) => onToggleCategory(c))}
                    className={styles.resetSectionBtn}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={styles.categoryList}>
                {availableCategories.map((cat) => {
                  const isSelected = activeCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => onToggleCategory(cat)}
                      className={`${styles.categoryOption} ${isSelected ? styles.categoryOptionActive : ''}`}
                      role="checkbox"
                      aria-checked={isSelected}
                    >
                      <span className={`${styles.checkbox} ${isSelected ? styles.checkboxActive : ''}`} aria-hidden>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className={styles.categoryName}>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Size Filter */}
          {availableSizes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>SIZE</h3>
                {activeSizes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => activeSizes.forEach((s) => onToggleSize(s))}
                    className={styles.resetSectionBtn}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={styles.sizeGrid}>
                {availableSizes.map((size) => {
                  const isSelected = activeSizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onToggleSize(size)}
                      className={`${styles.sizeBtn} ${isSelected ? styles.sizeBtnActive : ''}`}
                      aria-pressed={isSelected}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Color Filter */}
          {availableColors.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>COLOR</h3>
                {activeColors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => activeColors.forEach((c) => onToggleColor(c))}
                    className={styles.resetSectionBtn}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={styles.colorList}>
                {availableColors.map((color) => {
                  const isSelected = activeColors.includes(color.name);
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => onToggleColor(color.name)}
                      className={`${styles.colorChip} ${isSelected ? styles.colorChipActive : ''}`}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={styles.colorSwatch}
                        style={{
                          backgroundColor: color.hex || (color.name.toLowerCase() === 'white' ? '#ffffff' : color.name.toLowerCase() === 'black' ? '#000000' : '#888888'),
                          border: color.name.toLowerCase() === 'white' ? '1px solid #ccc' : undefined,
                        }}
                        aria-hidden
                      />
                      <span className={styles.colorName}>{color.name}</span>
                      {isSelected && (
                        <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Price Filter */}
          {catalogMaxPrice > catalogMinPrice && (
            <div className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>PRICE</h3>
                {(activeMinPrice > catalogMinPrice || activeMaxPrice < catalogMaxPrice) && (
                  <button
                    type="button"
                    onClick={() => onChangePriceRange(catalogMinPrice, catalogMaxPrice)}
                    className={styles.resetSectionBtn}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={styles.priceInputsRow}>
                <div className={styles.priceField}>
                  <label htmlFor="filter-min-price" className={styles.priceLabel}>MIN</label>
                  <div className={styles.inputPrefixWrap}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      id="filter-min-price"
                      type="number"
                      min={catalogMinPrice}
                      max={activeMaxPrice}
                      step="1"
                      value={activeMinPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onChangePriceRange(Math.min(val, activeMaxPrice), activeMaxPrice);
                        }
                      }}
                      className={styles.priceInput}
                    />
                  </div>
                </div>
                <span className={styles.priceDivider}>—</span>
                <div className={styles.priceField}>
                  <label htmlFor="filter-max-price" className={styles.priceLabel}>MAX</label>
                  <div className={styles.inputPrefixWrap}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      id="filter-max-price"
                      type="number"
                      min={activeMinPrice}
                      max={catalogMaxPrice}
                      step="1"
                      value={activeMaxPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onChangePriceRange(activeMinPrice, Math.max(val, activeMinPrice));
                        }
                      }}
                      className={styles.priceInput}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.sliderWrap}>
                <input
                  type="range"
                  min={catalogMinPrice}
                  max={catalogMaxPrice}
                  step="0.5"
                  value={activeMaxPrice}
                  onChange={(e) => onChangePriceRange(activeMinPrice, Number(e.target.value))}
                  className={styles.rangeSlider}
                  aria-label="Maximum price filter slider"
                />
              </div>
            </div>
          )}

          {/* 5. Availability Filter */}
          {hasAvailabilityFilter && (
            <div className={styles.section}>
              <div className={styles.availabilityRow}>
                <label htmlFor="filter-instock-toggle" className={styles.availabilityLabel}>
                  <span className={styles.availabilityTitle}>IN STOCK ONLY</span>
                  <span className={styles.availabilitySub}>Show pieces with available inventory</span>
                </label>
                <button
                  id="filter-instock-toggle"
                  type="button"
                  role="switch"
                  aria-checked={activeInStockOnly}
                  onClick={() => onToggleInStock(!activeInStockOnly)}
                  className={`${styles.toggleSwitch} ${activeInStockOnly ? styles.toggleSwitchActive : ''}`}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className={styles.footer}>
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeFiltersCount === 0}
            className={styles.clearBtn}
          >
            CLEAR ALL
          </button>
          <button
            type="button"
            onClick={onClose}
            className={styles.applyBtn}
          >
            SHOW {filteredCount} {filteredCount === 1 ? 'PRODUCT' : 'PRODUCTS'}
          </button>
        </div>
      </div>
    </div>
  );
}
