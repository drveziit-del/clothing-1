'use client';

import { useState, useEffect } from 'react';
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
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const { addItem } = useCart();
  const { toast } = useRoast();
  const { formatPrice } = useCurrency();
  const [hoverRoast, setHoverRoast] = useState('');
  const [roastVisible, setRoastVisible] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const safeVariants = Array.isArray(product.variants) ? product.variants : [];
  const safeImages = Array.isArray(product.images) ? product.images : [];
  const [imgSrc, setImgSrc] = useState(safeImages[0] || '/logo.png');

  useEffect(() => {
    setImgSrc(safeImages[0] || '/logo.png');
  }, [safeImages]);

  const smallVariant = getSmallVariant(safeVariants) || safeVariants[0];
  const smallPrice = smallVariant ? smallVariant.price : (product.price || 0);
  const defaultVariant = smallVariant || safeVariants[0];

  const handleMouseEnter = () => {
    setHoverRoast(getHoverRoast());
    setRoastVisible(true);
  };
  const handleMouseLeave = () => setRoastVisible(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;
    addItem(product, defaultVariant, 1);
    toast(getCartRoast(), 'success');
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
  };

  const categoryLabel = product.section === 'society_fuckers' ? 'Society Fu*kers' : 'Valueless Bi*ches';

  return (
    <div
      className={styles.card}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={`/shop/${product.slug || product.id}`} className={styles.cardLink}>
        <div className={styles.imageWrap}>
          {/* Top Badges */}
          <div className={styles.topBadges}>
            <span className={styles.tagPill}>240 GSM</span>
            {(product.tags?.includes('featured') || product.tags?.includes('hot')) && (
              <span className={styles.featuredPill}>HOT</span>
            )}
          </div>

          {/* Heart Wishlist Button */}
          <button
            type="button"
            className={`${styles.wishlistBtn} ${isWishlisted ? styles.activeWishlist : ''}`}
            onClick={toggleWishlist}
            aria-label="Add to wishlist"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={isWishlisted ? '#ff4757' : 'none'}
              stroke={isWishlisted ? '#ff4757' : 'currentColor'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Product Image */}
          {imgSrc ? (
            <div className={styles.imageContainer}>
              <Image
                src={imgSrc}
                alt={product.title}
                fill
                sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                className={styles.image}
                priority={priority}
                onError={() => setImgSrc('/logo.png')}
              />
            </div>
          ) : (
            <div className={styles.imagePlaceholder}>
              <span>GERKINK</span>
            </div>
          )}

          {/* Hover Roast Overlay */}
          <div className={`${styles.roastOverlay} ${roastVisible ? styles.visible : ''}`}>
            <p className={styles.roastText}>{hoverRoast}</p>
          </div>
        </div>

        {/* Product Information */}
        <div className={styles.info}>
          <div className={styles.headerInfo}>
            <span className={styles.category}>{categoryLabel}</span>
            <span className={styles.price}>{formatPrice(smallPrice)}</span>
          </div>

          <h3 className={styles.title}>{product.title}</h3>

          <div className={styles.bottomRow}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to cart`}
            >
              <span>ADD TO CART</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}
