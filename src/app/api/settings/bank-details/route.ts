import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/utils/encryption';
import { cookies } from 'next/headers';

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
const ENCRYPTED_FIELDS = [
  'accountHolder',
  'accountNumber',
  'routingNumber',
  'swiftBic',
  'wiseEmail',
  'wiseTag',
] as const;

function isEncryptedFormat(str: string): boolean {
  const parts = str.split(':');
  if (parts.length !== 3) return false;
  // iv: 24 hex chars (12 bytes), authTag: 32 hex chars (16 bytes), ciphertext: non-empty hex
  return (
    /^[0-9a-f]{24}$/i.test(parts[0]) &&
    /^[0-9a-f]{32}$/i.test(parts[1]) &&
    /^[0-9a-f]+$/i.test(parts[2])
  );
}

function decryptFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    const value = out[field];
    if (typeof value === 'string') {
      if (isEncryptedFormat(value)) {
        try {
          out[field] = decrypt(value);
        } catch (err: any) {
          console.error(`[bank-details] Failed to decrypt field "${field}":`, err?.message || err);
          out[field] = null;
        }
      } else {
        // Legitimate legacy plaintext containing colons or other characters is preserved
        out[field] = value;
      }
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  // 1. Authenticated session required — anonymous requests are strictly rejected
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let uid: string;
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Authorization & Order Validation
  const orderId = request.nextUrl.searchParams.get('orderId');

  if (orderId) {
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data()!;

    // Ownership check: must be order owner or an administrator
    if (orderData.userId && orderData.userId !== uid && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Must be a pre-booking allocation order
    if (!orderData.isPrebooking && !isAdmin) {
      return NextResponse.json({ error: 'Order is not an allocation pre-booking' }, { status: 400 });
    }

    // Status guard: only pending or awaiting wire confirmation orders can request payment details
    const eligibleStatuses = ['pending', 'awaiting_wire_confirmation'];
    if (!eligibleStatuses.includes(orderData.status) && !isAdmin) {
      return NextResponse.json({ error: 'Order status does not permit wire payment' }, { status: 400 });
    }
  } else if (!isAdmin) {
    // Non-admins must supply an orderId to access payment coordinates
    return NextResponse.json({ error: 'orderId parameter is required' }, { status: 400 });
  }

  // 3. Fetch, Decrypt, and Minimize Treasury Data
  try {
    const docSnap = await adminDb.collection('settings').doc('bank_details').get();
    const rawData = docSnap.exists ? docSnap.data()! : {};
    const decrypted = decryptFields(rawData);

    // Return ONLY minimum fields required for customer transfer (never internal notes/secrets)
    return NextResponse.json({
      bankName: (decrypted.bankName as string) || DEFAULT_BANK_DETAILS.bankName,
      accountHolder: (decrypted.accountHolder as string) || DEFAULT_BANK_DETAILS.accountHolder,
      accountNumber: (decrypted.accountNumber as string) || '',
      routingNumber: (decrypted.routingNumber as string) || null,
      swiftBic: (decrypted.swiftBic as string) || null,
      wiseEmail: (decrypted.wiseEmail as string) || null,
      currency: (decrypted.currency as string) || 'USD',
      referenceInstructions: (decrypted.referenceInstructions as string) || DEFAULT_BANK_DETAILS.referenceInstructions,
      supportNotice: (decrypted.supportNotice as string) || DEFAULT_BANK_DETAILS.supportNotice,
    });
  } catch (err) {
    console.error('Error fetching bank details:', err);
    return NextResponse.json(DEFAULT_BANK_DETAILS);
  }
}

