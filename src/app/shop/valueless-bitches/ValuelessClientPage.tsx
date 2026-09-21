'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import ProductGrid from '@/components/shop/ProductGrid';
import ProductFilters, { SortKey } from '@/components/shop/ProductFilters';
import FilterDrawer, { ColorOption } from '@/components/shop/FilterDrawer';
import type { Product } from '@/types';
import styles from './ValuelessClientPage.module.css';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'One Size'];

interface ValuelessClientPageProps {
  products: Product[];
}

export function ValuelessClientPage({ products }: ValuelessClientPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ─── 1. DYNAMIC CATALOG DISCOVERY ──────────────────────────────
  const {
    availableCategories,
    availableSizes,
    availableColors,
    catalogMinPrice,
    catalogMaxPrice,
    hasAvailabilityFilter,
  } = useMemo(() => {
    const cats = new Set<string>();
    const sizes = new Set<string>();
    const colorMap = new Map<string, string | undefined>();
    const prices: number[] = [];
    let hasUnavailable = false;

    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
      if (Array.isArray(p.tags)) {
        p.tags.forEach((t) => {
          if (t && t.trim()) cats.add(t.trim());
        });
      }
      if (typeof p.price === 'number') prices.push(p.price);

      if (Array.isArray(p.variants)) {
        p.variants.forEach((v) => {
          if (v.size && v.size.trim()) sizes.add(v.size.trim());
          if (v.color && v.color.trim()) {
            const trimmedColor = v.color.trim();
            if (!colorMap.has(trimmedColor)) {
              colorMap.set(trimmedColor, v.colorHex);
            }
          }
          if (typeof v.price === 'number') prices.push(v.price);
          if (v.available === false) hasUnavailable = true;
        });
      }
    });

    // Sort sizes naturally
    const sortedSizes = [...sizes].sort((a, b) => {
      const idxA = SIZE_ORDER.indexOf(a);
      const idxB = SIZE_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const colorsList: ColorOption[] = Array.from(colorMap.entries()).map(([name, hex]) => ({
      name,
      hex,
    }));

    const minP = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
    const maxP = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 100;

    return {
      availableCategories: [...cats],
      availableSizes: sortedSizes,
      availableColors: colorsList,
      catalogMinPrice: minP,
      catalogMaxPrice: maxP === minP ? minP + 50 : maxP,
      hasAvailabilityFilter: hasUnavailable,
    };
  }, [products]);

  // ─── 2. PARSE INITIAL FILTER STATE FROM URL ───────────────────
  const parseUrlState = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        category: '',
        sizes: [] as string[],
        colors: [] as string[],
        minPrice: catalogMinPrice,
        maxPrice: catalogMaxPrice,
        inStock: false,
        sort: 'newest' as SortKey,
      };
    }

    const sp = new URLSearchParams(window.location.search);

    // Category
    const category = sp.get('category') || '';

    // Sizes (comma-separated or multiple)
    const sizeParam = sp.get('size') || '';
    const sizes = sizeParam
      ? sizeParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Colors (comma-separated or multiple)
    const colorParam = sp.get('color') || '';
    const colors = colorParam
      ? colorParam.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    // Price
    const minPVal = Number(sp.get('minPrice'));
    const maxPVal = Number(sp.get('maxPrice'));
    const minPrice = !isNaN(minPVal) && minPVal >= catalogMinPrice ? minPVal : catalogMinPrice;
    const maxPrice = !isNaN(maxPVal) && maxPVal <= catalogMaxPrice && maxPVal >= minPrice ? maxPVal : catalogMaxPrice;

    // Availability
    const inStock = sp.get('inStock') === 'true' || sp.get('availability') === 'in-stock';

    // Sort
    const sortParam = sp.get('sort');
    let sort: SortKey = 'newest';
    if (sortParam === 'price_asc' || sortParam === 'price-asc') sort = 'price_asc';
    else if (sortParam === 'price_desc' || sortParam === 'price-desc') sort = 'price_desc';

    return {
      category,
      sizes,
      colors,
      minPrice,
      maxPrice,
      inStock,
      sort,
    };
  }, [catalogMinPrice, catalogMaxPrice]);

  const initialParsed = useMemo(() => parseUrlState(), [parseUrlState]);

  // ─── 3. REACT FILTER STATE ────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string>(initialParsed.category);
  const [activeSizes, setActiveSizes] = useState<string[]>(initialParsed.sizes);
  const [activeColors, setActiveColors] = useState<string[]>(initialParsed.colors);
  const [activeMinPrice, setActiveMinPrice] = useState<number>(initialParsed.minPrice);
  const [activeMaxPrice, setActiveMaxPrice] = useState<number>(initialParsed.maxPrice);
  const [activeInStockOnly, setActiveInStockOnly] = useState<boolean>(initialParsed.inStock);
  const [activeSort, setActiveSort] = useState<SortKey>(initialParsed.sort);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Track whether initial mount has completed to prevent writing default URL on fresh load
  const isMounted = useRef(false);

  // ─── 4. SYNC FILTER STATE TO URL ──────────────────────────────
  const syncToUrl = useCallback(
    (
      cat: string,
      szs: string[],
      cls: string[],
      minP: number,
      maxP: number,
      inStk: boolean,
      srt: SortKey
    ) => {
      if (typeof window === 'undefined') return;

      const sp = new URLSearchParams();

      if (cat) sp.set('category', cat);
      if (szs.length > 0) sp.set('size', szs.join(','));
      if (cls.length > 0) sp.set('color', cls.join(','));
      if (minP > catalogMinPrice) sp.set('minPrice', String(minP));
      if (maxP < catalogMaxPrice) sp.set('maxPrice', String(maxP));
      if (inStk) sp.set('inStock', 'true');
      if (srt !== 'newest') sp.set('sort', srt);

      const qs = sp.toString();
      const targetUrl = qs ? `${pathname}?${qs}` : pathname;

      // Use window.history.replaceState to avoid full Next.js page re-fetch/scroll resets
      window.history.replaceState(null, '', targetUrl);
    },
    [pathname, catalogMinPrice, catalogMaxPrice]
  );

  // Listen for browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlState();
      setActiveCategory(parsed.category);
      setActiveSizes(parsed.sizes);
      setActiveColors(parsed.colors);
      setActiveMinPrice(parsed.minPrice);
      setActiveMaxPrice(parsed.maxPrice);
      setActiveInStockOnly(parsed.inStock);
      setActiveSort(parsed.sort);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseUrlState]);

  // Sync to URL when active filters change
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    syncToUrl(
      activeCategory,
      activeSizes,
      activeColors,
      activeMinPrice,
      activeMaxPrice,
      activeInStockOnly,
      activeSort
    );
  }, [
    activeCategory,
    activeSizes,
    activeColors,
    activeMinPrice,
    activeMaxPrice,
    activeInStockOnly,
    activeSort,
    syncToUrl,
  ]);

  // ─── 5. HANDLERS ──────────────────────────────────────────────
  const handleToggleSize = useCallback((size: string) => {
    setActiveSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }, []);

  const handleToggleColor = useCallback((color: string) => {
    setActiveColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  }, []);

  const handleChangePriceRange = useCallback((min: number, max: number) => {
    setActiveMinPrice(min);
    setActiveMaxPrice(max);
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveCategory('');
    setActiveSizes([]);
    setActiveColors([]);
    setActiveMinPrice(catalogMinPrice);
    setActiveMaxPrice(catalogMaxPrice);
    setActiveInStockOnly(false);
    setActiveSort('newest');
    syncToUrl('', [], [], catalogMinPrice, catalogMaxPrice, false, 'newest');
  }, [catalogMinPrice, catalogMaxPrice, syncToUrl]);

  // ─── 6. FILTER & SORT EVALUATION ──────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Category check
      if (activeCategory) {
        const matchesCategory =
          (p.category && p.category.toLowerCase() === activeCategory.toLowerCase()) ||
          (Array.isArray(p.tags) &&
            p.tags.some((t) => t.toLowerCase() === activeCategory.toLowerCase()));
        if (!matchesCategory) return false;
      }

      // 2. Size check (OR within size)
      if (activeSizes.length > 0) {
        const hasSize = Array.isArray(p.variants) &&
          p.variants.some((v) => v.size && activeSizes.includes(v.size));
        if (!hasSize) return false;
      }

      // 3. Color check (OR within color)
      if (activeColors.length > 0) {
        const hasColor = Array.isArray(p.variants) &&
          p.variants.some((v) => v.color && activeColors.includes(v.color));
        if (!hasColor) return false;
      }

      // 4. Price check (product price falls in range)
      const prodPrice = typeof p.price === 'number' ? p.price : (p.variants?.[0]?.price || 0);
      const hasPriceMatch = prodPrice >= activeMinPrice && prodPrice <= activeMaxPrice;
      if (!hasPriceMatch) return false;

      // 5. Availability check
      if (activeInStockOnly) {
        const hasInStock = Array.isArray(p.variants) &&
          p.variants.some((v) => v.available !== false);
        if (!hasInStock) return false;
      }

      return true;
    });
  }, [
    products,
    activeCategory,
    activeSizes,
    activeColors,
    activeMinPrice,
    activeMaxPrice,
    activeInStockOnly,
  ]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (activeSort) {
      case 'price_asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return list.sort((a, b) => b.price - a.price);
      case 'newest':
      default:
        return list.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
    }
  }, [filteredProducts, activeSort]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeCategory) count += 1;
    count += activeSizes.length;
    count += activeColors.length;
    if (activeMinPrice > catalogMinPrice || activeMaxPrice < catalogMaxPrice) count += 1;
    if (activeInStockOnly) count += 1;
    return count;
  }, [
    activeCategory,
    activeSizes,
    activeColors,
    activeMinPrice,
    activeMaxPrice,
    activeInStockOnly,
    catalogMinPrice,
    catalogMaxPrice,
  ]);

  return (
    <div className={styles.clientContainer}>
      {/* ── Collection Toolbar ──────────────────────────────── */}
      <ProductFilters
        onOpenFilter={() => setIsDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        resultCount={sortedProducts.length}
        activeSort={activeSort}
        onSort={setActiveSort}
        onClearFilters={activeFilterCount > 0 ? handleClearAll : undefined}
      />

      {/* ── Accessible Filter Drawer ────────────────────────── */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        availableCategories={availableCategories}
        availableSizes={availableSizes}
        availableColors={availableColors}
        catalogMinPrice={catalogMinPrice}
        catalogMaxPrice={catalogMaxPrice}
        hasAvailabilityFilter={hasAvailabilityFilter}
        activeCategory={activeCategory}
        activeSizes={activeSizes}
        activeColors={activeColors}
        activeMinPrice={activeMinPrice}
        activeMaxPrice={activeMaxPrice}
        activeInStockOnly={activeInStockOnly}
        onSelectCategory={setActiveCategory}
        onToggleSize={handleToggleSize}
        onToggleColor={handleToggleColor}
        onChangePriceRange={handleChangePriceRange}
        onToggleInStock={setActiveInStockOnly}
        onClearAll={handleClearAll}
        filteredCount={filteredProducts.length}
        totalCount={products.length}
      />

      {/* ── Product Grid or Empty State ─────────────────────── */}
      {sortedProducts.length > 0 ? (
        <ProductGrid products={sortedProducts} />
      ) : (
        <div className={styles.emptyContainer}>
          <div className={styles.emptyIconWrap}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>NO PRODUCTS FOUND</h3>
          <p className={styles.emptySubtitle}>
            No garments match your active filters. Adjust your criteria or clear your filters to explore the collection.
          </p>
          <button
            type="button"
            onClick={handleClearAll}
            className={styles.emptyClearBtn}
          >
            CLEAR ALL FILTERS
          </button>
        </div>
      )}
    </div>
  );
}
