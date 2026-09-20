'use client';

import { useState, useMemo } from 'react';
import ProductGrid from '@/components/shop/ProductGrid';
import ProductFilters from '@/components/shop/ProductFilters';
import type { Product } from '@/types';
import type { SortKey } from '@/components/shop/ProductFilters';

// Client component for filtering/sorting
export function ValuelessClientPage({ products }: { products: Product[] }) {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const categories = useMemo(
    () => [...new Set(products.flatMap((p) => p.tags ?? []))],
    [products]
  );

  const filtered = useMemo(() => {
    let out = category
      ? products.filter((p) => p.tags?.includes(category))
      : products;

    switch (sort) {
      case 'price_asc':  out = [...out].sort((a, b) => a.price - b.price); break;
      case 'price_desc': out = [...out].sort((a, b) => b.price - a.price); break;
      default:           out = [...out].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }
    return out;
  }, [products, category, sort]);

  return (
    <>
      <ProductFilters
        categories={categories}
        activeCategory={category}
        activeSort={sort}
        onCategory={setCategory}
        onSort={setSort}
        resultCount={filtered.length}
      />
      <ProductGrid products={filtered} emptyMessage="Nothing yet. Good things take time, unlike your sense of style." />
    </>
  );
}
