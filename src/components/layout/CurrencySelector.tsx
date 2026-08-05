'use client';

import { useCurrency, SUPPORTED_CURRENCIES } from '@/context/CurrencyContext';
import styles from './CurrencySelector.module.css';

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className={styles.wrapper}>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className={styles.select}
        aria-label="Select currency"
      >
        {Object.values(SUPPORTED_CURRENCIES).map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
