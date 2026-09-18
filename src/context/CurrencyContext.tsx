'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'USD ($)' },
  INR: { code: 'INR', symbol: '₹', name: 'INR (₹)' },
  EUR: { code: 'EUR', symbol: '€', name: 'EUR (€)' },
  GBP: { code: 'GBP', symbol: '£', name: 'GBP (£)' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'CAD (CA$)' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'AUD (A$)' },
};

interface CurrencyContextType {
  currency: string;
  symbol: string;
  rate: number;
  rates: Record<string, number>;
  setCurrency: (code: string, persist?: boolean) => void;
  formatPrice: (amountInUSD: number) => string;
  convertPrice: (amountInUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  symbol: '$',
  rate: 1,
  rates: { USD: 1 },
  setCurrency: () => {},
  formatPrice: (amt) => `$${amt.toFixed(2)}`,
  convertPrice: (amt) => amt,
});

const LOCAL_STORAGE_KEY = 'gkink_user_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>('USD');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, INR: 83.5 });
  const [_isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function initCurrency() {
      try {
        const res = await fetch('/api/currency');
        if (!res.ok) throw new Error('Failed to fetch currency info');
        const data = await res.json();

        setRates(data.rates ?? { USD: 1 });

        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved && SUPPORTED_CURRENCIES[saved]) {
          setCurrencyState(saved);
        } else {
          setCurrencyState('USD');
        }
      } catch (err) {
        console.warn('Currency initialization fallback used:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    initCurrency();
  }, []);

  const setCurrency = useCallback((code: string, persist = true) => {
    if (SUPPORTED_CURRENCIES[code]) {
      setCurrencyState(code);
      if (persist) {
        localStorage.setItem(LOCAL_STORAGE_KEY, code);
      }
    }
  }, []);

  const currentRate = rates[currency] ?? 1;
  const currentSymbol = SUPPORTED_CURRENCIES[currency]?.symbol ?? '$';

  const convertPrice = useCallback(
    (amountUSD: number): number => {
      const rate = rates[currency] ?? 1;
      return amountUSD * rate;
    },
    [rates, currency]
  );

  const formatPrice = useCallback(
    (amountUSD: number): string => {
      const rate = rates[currency] ?? 1;
      const symbol = SUPPORTED_CURRENCIES[currency]?.symbol ?? '$';
      const converted = amountUSD * rate;
      if (currency === 'INR') {
        return `${symbol}${Math.round(converted).toLocaleString('en-IN')}`;
      }
      return `${symbol}${converted.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [rates, currency]
  );

  const value = useMemo(
    () => ({
      currency,
      symbol: currentSymbol,
      rate: currentRate,
      rates,
      setCurrency,
      formatPrice,
      convertPrice,
    }),
    [currency, currentSymbol, currentRate, rates, setCurrency, formatPrice, convertPrice]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
