import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/utils/encryption';

export const dynamic = 'force-dynamic';

// Generic fallbacks only — real treasury credentials must live in env vars
// (WIRE_*) or the Firestore settings/bank_details doc, never in source.
const DEFAULT_BANK_DETAILS = {
  bankName: process.env.WIRE_BANK_NAME || 'Contact support for wire transfer details',
  accountHolder: process.env.WIRE_ACCOUNT_HOLDER || '',
  referenceInstructions: 'Please include your Allocation Order ID (e.g. PREBOOK-XXXXXX) in the payment reference or memo.',
  supportNotice: 'Wire transfers and Wise payments are audited and confirmed by our treasury desk within 2 to 6 hours.',
};

// Fields stored AES-256-GCM encrypted at rest by the admin API; decrypt for display.
const ENCRYPTED_FIELDS = ['accountNumber', 'routingNumber', 'swiftBic'] as const;

function decryptFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.includes(':')) {
      // Encrypted payloads are iv:authTag:ciphertext hex triples
      try {
        out[field] = decrypt(value);
      } catch {
        delete out[field];
      }
    }
  }
  return out;
}

export async function GET() {
  try {
    const docSnap = await adminDb.collection('settings').doc('bank_details').get();
    if (docSnap.exists) {
      return NextResponse.json({ ...DEFAULT_BANK_DETAILS, ...decryptFields(docSnap.data()!) });
    }
    return NextResponse.json(DEFAULT_BANK_DETAILS);
  } catch (err) {
    console.error('Error fetching bank details:', err);
    return NextResponse.json(DEFAULT_BANK_DETAILS);
  }
}
