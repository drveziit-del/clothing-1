/**
 * Destination-based estimated tax.
 *
 * Server-side this is the amount the customer is actually charged
 * (Razorpay + PayPal create-order routes); client-side it powers previews.
 *
 * Rates are standard VAT/GST/sales-tax estimates per destination and are NOT
 * a substitute for registered tax filing. Unlisted destinations fall back to
 * the historical flat 8% so existing markets keep their current behavior.
 * Extensible for future tax service integrations (e.g. TaxJar / Printify tax API).
 */

// Standard-rate estimates keyed by ISO-3166 alpha-2 code.
const TAX_RATES_BY_CODE: Record<string, number> = {
  US: 0.08, // Legacy flat rate retained (state-level sales tax varies by origin).
  IN: 0.12, // GST — apparel above the concessional threshold.
  GB: 0.20,
  CA: 0.05, // Federal GST only; provincial HST collected at import.
  AU: 0.10,
  DE: 0.19,
  FR: 0.20,
  ES: 0.21,
  NL: 0.21,
  IT: 0.22,
  SG: 0.09,
  AE: 0.05,
  JP: 0.10,
  BR: 0.17,
  MX: 0.16,
  NZ: 0.15,
  SE: 0.25,
  NO: 0.25,
  DK: 0.25,
  FI: 0.255,
  IE: 0.23,
  CH: 0.081,
  AT: 0.20,
  BE: 0.21,
};

const DEFAULT_RATE = 0.08;

export function getTaxRate(country?: string | null): number {
  if (!country) return DEFAULT_RATE;
  const raw = String(country).trim();

  // Direct ISO-2 hit
  const byCode = TAX_RATES_BY_CODE[raw.toUpperCase()];
  if (byCode !== undefined) return byCode;

  // Fallback: match against full country names (e.g. "United Kingdom")
  const NAME_TO_CODE: Record<string, string> = {
    'united states': 'US',
    india: 'IN',
    'united kingdom': 'GB',
    canada: 'CA',
    australia: 'AU',
    germany: 'DE',
    france: 'FR',
    spain: 'ES',
    netherlands: 'NL',
    italy: 'IT',
    singapore: 'SG',
    'united arab emirates': 'AE',
    japan: 'JP',
    brazil: 'BR',
    mexico: 'MX',
    'new zealand': 'NZ',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    finland: 'FI',
    ireland: 'IE',
    switzerland: 'CH',
    austria: 'AT',
    belgium: 'BE',
  };
  const mapped = NAME_TO_CODE[raw.toLowerCase()];
  if (mapped) return TAX_RATES_BY_CODE[mapped];

  return DEFAULT_RATE;
}

export function calculateTax(countryCode: string | undefined, subtotal: number): number {
  if (!subtotal || subtotal <= 0) return 0;
  return Number((subtotal * getTaxRate(countryCode)).toFixed(2));
}
