import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// Generic fallbacks only — real treasury credentials must live in env vars
// (WIRE_*) or the Firestore settings/bank_details doc, never in source.
const DEFAULT_BANK_DETAILS = {
  bankName: process.env.WIRE_BANK_NAME || 'Contact support for wire transfer details',
  accountHolder: process.env.WIRE_ACCOUNT_HOLDER || '',
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
