/**
 * Server-side Currency Exchange Rate service using Open Exchange Rates API.
 * Caches rates in-memory for 1 hour to optimize performance and prevent rate limiting.
 */

interface ExchangeRatesResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_unix: number;
}

let cachedRates: Record<string, number> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const CURRENCY_MAP: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
};

export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  IN: 'INR',
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  PT: 'EUR',
  GR: 'EUR',
  CA: 'CAD',
  AU: 'AUD',
};

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch exchange rates: ${res.statusText}`);
    }

    const data: ExchangeRatesResponse = await res.json();
    if (data.result === 'success' && data.rates) {
      cachedRates = data.rates;
      lastFetchTime = now;
      return cachedRates;
    }
  } catch (err) {
    console.error('Error fetching live exchange rates:', err);
  }

  // Fallback default rates if API is unreachable
  return cachedRates ?? {
    USD: 1,
    INR: 83.5,
    EUR: 0.92,
    GBP: 0.78,
    CAD: 1.36,
    AUD: 1.52,
  };
}

export async function getRateForCurrency(currencyCode: string): Promise<number> {
  const rates = await getExchangeRates();
  return rates[currencyCode] ?? 1;
}
