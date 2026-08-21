import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_BANK_DETAILS = {
  bankName: 'Wise Payments Ltd / JPMorgan Chase Bank, N.A.',
  accountHolder: 'GERKINK GLOBAL ENTERPRISES',
  accountNumber: '9876543210',
  routingNumber: '026073150',
  swiftBic: 'WISEUS33XXX',
  bankCountry: 'United States',
  currency: 'USD',
  wiseEmail: 'treasury@gerkink.shop',
  wiseTag: '@gerkink-treasury',
  referenceInstructions: 'Please include your Allocation Order ID (e.g. PREBOOK-XXXXXX) in the payment reference or memo.',
  supportNotice: 'Wire transfers and Wise payments are audited and confirmed by our treasury desk within 2 to 6 hours.',
};

export async function GET() {
  try {
    const docSnap = await adminDb.collection('settings').doc('bank_details').get();
    if (docSnap.exists) {
      return NextResponse.json({ ...DEFAULT_BANK_DETAILS, ...docSnap.data() });
    }
    return NextResponse.json(DEFAULT_BANK_DETAILS);
  } catch (err) {
    console.error('Error fetching bank details:', err);
    return NextResponse.json(DEFAULT_BANK_DETAILS);
  }
}
