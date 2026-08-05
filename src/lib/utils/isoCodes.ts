/**
 * Utility to map full country names, variations, and common region names to 2-letter ISO 3166-1 alpha-2 codes required by Printify.
 */

const COUNTRY_ISO_MAP: Record<string, string> = {
  // Major markets
  'INDIA': 'IN',
  'IND': 'IN',
  'IN': 'IN',

  'UNITED STATES': 'US',
  'USA': 'US',
  'US': 'US',
  'UNITED STATES OF AMERICA': 'US',

  'CANADA': 'CA',
  'CAN': 'CA',
  'CA': 'CA',

  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'UK': 'GB',
  'GB': 'GB',
  'ENGLAND': 'GB',
  'SCOTLAND': 'GB',
  'WALES': 'GB',

  'AUSTRALIA': 'AU',
  'AUS': 'AU',
  'AU': 'AU',

  'GERMANY': 'DE',
  'DEUTSCHLAND': 'DE',
  'DE': 'DE',

  'FRANCE': 'FR',
  'FR': 'FR',

  'ITALY': 'IT',
  'IT': 'IT',

  'SPAIN': 'ES',
  'ES': 'ES',

  'NETHERLANDS': 'NL',
  'NL': 'NL',

  'MEXICO': 'MX',
  'MX': 'MX',

  'BRAZIL': 'BR',
  'BR': 'BR',

  'JAPAN': 'JP',
  'JP': 'JP',

  'CHINA': 'CN',
  'CN': 'CN',

  'SINGAPORE': 'SG',
  'SG': 'SG',

  'UNITED ARAB EMIRATES': 'AE',
  'UAE': 'AE',
  'AE': 'AE',
};

/**
 * Normalizes any country input to a 2-letter uppercase ISO country code.
 */
export function normalizeCountryCode(input?: string | null): string {
  if (!input) return 'US';
  const clean = input.trim().toUpperCase();
  if (COUNTRY_ISO_MAP[clean]) {
    return COUNTRY_ISO_MAP[clean];
  }
  if (clean.length === 2) {
    return clean;
  }
  return 'US';
}

/**
 * Normalizes state/region input (e.g. "West Bengal" -> "WB", "California" -> "CA").
 */
export function normalizeRegionCode(region?: string | null, countryCode?: string): string {
  if (!region) return 'NY';
  const clean = region.trim();
  const upper = clean.toUpperCase();

  if (clean.length <= 3) {
    return upper;
  }

  if (countryCode === 'IN') {
    const indianStates: Record<string, string> = {
      'WEST BENGAL': 'WB',
      'MAHARASHTRA': 'MH',
      'DELHI': 'DL',
      'KARNATAKA': 'KA',
      'TAMIL NADU': 'TN',
      'TELANGANA': 'TS',
      'GUJARAT': 'GJ',
      'KERALA': 'KL',
      'UTTAR PRADESH': 'UP',
      'RAJASTHAN': 'RJ',
      'PUNJAB': 'PB',
      'HARYANA': 'HR',
      'BIHAR': 'BR',
      'ODISHA': 'OR',
      'ASSAM': 'AS',
      'ANDHRA PRADESH': 'AP',
    };
    if (indianStates[upper]) return indianStates[upper];
  }

  const usStates: Record<string, string> = {
    'CALIFORNIA': 'CA',
    'NEW YORK': 'NY',
    'TEXAS': 'TX',
    'FLORIDA': 'FL',
    'ILLINOIS': 'IL',
    'WASHINGTON': 'WA',
  };
  if (usStates[upper]) return usStates[upper];

  return upper.slice(0, 3);
}
