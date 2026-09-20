'use client';

import { useState } from 'react';
import styles from './RatingStars.module.css';

interface RatingStarsProps {
  rating: number; // 0 to 5
  maxStars?: number;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (newRating: number) => void;
  showScore?: boolean;
}

export default function RatingStars({
  rating,
  maxStars = 5,
  interactive = false,
  size = 'md',
  onChange,
  showScore = false,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const currentVal = hoverRating !== null ? hoverRating : rating;

  const handleKeyDown = (e: React.KeyboardEvent, star: number) => {
    if (!interactive || !onChange) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(star);
    }
  };

  return (
    <div
      className={`${styles.starContainer} ${styles[size]} ${interactive ? styles.interactive : ''}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`${rating} out of ${maxStars} stars`}
    >
      <div className={styles.starsRow}>
        {Array.from({ length: maxStars }, (_, i) => {
          const starVal = i + 1;
          const isFilled = currentVal >= starVal;
          const isHalf = !isFilled && currentVal >= starVal - 0.5;

          if (interactive) {
            return (
              <button
                key={starVal}
                type="button"
                className={`${styles.starBtn} ${isFilled ? styles.filled : ''}`}
                onClick={() => onChange?.(starVal)}
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(null)}
                onFocus={() => setHoverRating(starVal)}
                onBlur={() => setHoverRating(null)}
                onKeyDown={(e) => handleKeyDown(e, starVal)}
                role="radio"
                aria-checked={rating === starVal}
                aria-label={`${starVal} star${starVal > 1 ? 's' : ''}`}
              >
                ★
              </button>
            );
          }

          return (
            <span
              key={starVal}
              className={`${styles.starDisplay} ${isFilled ? styles.filled : isHalf ? styles.half : styles.empty}`}
            >
              ★
            </span>
          );
        })}
      </div>

      {showScore && (
        <span className={styles.scoreText}>
          {rating > 0 ? rating.toFixed(1) : '0.0'}
        </span>
      )}
    </div>
  );
}
