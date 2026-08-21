import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import z from 'zod';

const bankDetailsSchema = z.object({
  bankName: z.string().min(2).max(150),
  accountHolder: z.string().min(2).max(150),
  accountNumber: z.string().min(2).max(100),
  routingNumber: z.string().max(50).optional().nullable(),
  swiftBic: z.string().max(50).optional().nullable(),
  bankCountry: z.string().min(2).max(100),
  currency: z.string().min(2).max(10),
  wiseEmail: z.string().email().optional().nullable().or(z.literal('')),
  wiseTag: z.string().max(50).optional().nullable().or(z.literal('')),
  referenceInstructions: z.string().max(1000).optional().nullable(),
  supportNotice: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'admin_save_bank_details', { limit: 20, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // 1. Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = bankDetailsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid bank details' }, { status: 400 });
  }

  // 3. Save to Firestore
  try {
    await adminDb.collection('settings').doc('bank_details').set({
      ...result.data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: 'Bank & Wise details updated successfully' });
  } catch (err) {
    console.error('Error saving bank details:', err);
    return NextResponse.json({ error: 'Database error saving bank details' }, { status: 500 });
  }
}
