'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRoast } from '@/hooks/useRoast';
import { getHoverRoast, getCartRoast } from '@/lib/utils/roasts';
import type { Product } from '@/types';
import { useCurrency } from '@/context/CurrencyContext';
import { getSmallVariant } from '@/lib/utils/sizes';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { toast } = useRoast();
  const { formatPrice } = useCurrency();
  const [hoverRoast, setHoverRoast] = useState('');
  const [roastVisible, setRoastVisible] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const smallVariant = getSmallVariant(product.variants) || product.variants[0];
  const smallPrice = smallVariant ? smallVariant.price : product.price;
  const defaultVariant = smallVariant || product.variants[0];

  const handleMouseEnter = () => {
    setHoverRoast(getHoverRoast());
    setRoastVisible(true);
  };
  const handleMouseLeave = () => setRoastVisible(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!defaultVariant) return;
    addItem(product, defaultVariant, 1);
    toast(getCartRoast(), 'success');
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const categoryLabel = product.category
    ? product.category.toUpperCase()
    : product.section === 'society_fuckers'
    ? 'LUXURY'
    : 'T-SHIRTS';

  return (
    <Link
      href={`/shop/${product.id}`}
      className={styles.card}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.imageWrap}>
        {/* Heart Wishlist Button */}
        <button
          type="button"
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.activeWishlist : ''}`}
          onClick={toggleWishlist}
          aria-label="Add to wishlist"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isWishlisted ? '#ff4d4d' : 'none'} stroke={isWishlisted ? '#ff4d4d' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.title}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            className={styles.image}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>GERKINK</span>
          </div>
        )}

        {/* Hover roast overlay */}
        <div className={`${styles.roastOverlay} ${roastVisible ? styles.visible : ''}`}>
          <p className={styles.roastText}>{hoverRoast}</p>
        </div>
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{product.title}</h3>
        <span className={styles.category}>{categoryLabel}</span>
        <span className={styles.price}>Starting {formatPrice(smallPrice)}</span>

        <button
          type="button"
          className={styles.addBtn}
          onClick={handleAddToCart}
          aria-label={`Add ${product.title} to cart`}
        >
          <span>ADD TO CART</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.arrowIcon}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </Link>
  );
}
