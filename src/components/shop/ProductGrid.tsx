import ProductCard from '@/components/ui/ProductCard';
import type { Product } from '@/types';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({
  products,
  emptyMessage = 'Nothing here yet. Check back when you\'re ready to commit.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
