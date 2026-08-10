/**
 * Calculates estimated destination tax based on country code and subtotal.
 * Extensible for future tax service integrations (e.g. TaxJar / Printify tax API).
 */
export function calculateTax(countryCode: string | undefined, subtotal: number): number {
  if (!subtotal || subtotal <= 0) return 0;

  // Placeholder flat tax rate (8%) as documented in architecture plan
  const FLAT_TAX_RATE = 0.08;
  return Number((subtotal * FLAT_TAX_RATE).toFixed(2));
}
