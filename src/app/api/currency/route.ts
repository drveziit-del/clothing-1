import { NextRequest, NextResponse } from 'next/server';
import { getExchangeRates, COUNTRY_CURRENCY_MAP, CURRENCY_MAP } from '@/lib/currency/rates';

export async function GET(request: NextRequest) {
  const countryHeader =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-country-code') ||
    'US';

  const country = countryHeader.toUpperCase();
  const detectedCurrency = COUNTRY_CURRENCY_MAP[country] ?? 'USD';

  const rates = await getExchangeRates();

  return NextResponse.json({
    detectedCountry: country,
    detectedCurrency,
    symbol: CURRENCY_MAP[detectedCurrency]?.symbol ?? '$',
    rates,
    currencies: CURRENCY_MAP,
  });
}
