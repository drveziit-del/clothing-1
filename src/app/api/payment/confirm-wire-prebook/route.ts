import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { appendOrderHistory } from '@/lib/orchestrator/orderProcessor';
import z from 'zod';

const confirmWireSchema = z.object({
  orderId: z.string().min(1),
  senderReference: z.string().min(2, 'Transfer reference or transaction ID is required').max(100),
  senderName: z.string().max(100).optional().nullable(),
  senderBank: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'confirm_wire_prebook', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // 1. Auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid   = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = confirmWireSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { orderId, senderReference, senderName, senderBank, notes } = result.data;

  // 3. Update Order in Firestore
  try {
    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order allocation not found' }, { status: 404 });
    }

    const orderData = orderDoc.data()!;
    if (orderData.userId && orderData.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const wireData = {
      senderReference: senderReference.trim(),
      senderName: senderName?.trim() || orderData.prebookName || 'Anonymous',
      senderBank: senderBank?.trim() || 'Wise / Wire Transfer',
      notes: notes?.trim() || '',
      submittedAt: new Date().toISOString(),
    };

    await orderRef.update({
      status: 'awaiting_wire_confirmation',
      paymentGateway: 'wise_bank_transfer',
      wireDetails: wireData,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await appendOrderHistory(orderId, 'wire_transfer_submitted_by_client', 'customer', {
      uid,
      senderReference,
      senderBank,
      submittedAt: wireData.submittedAt,
    });

    return NextResponse.json({
      success: true,
      orderId,
      status: 'awaiting_wire_confirmation',
      wireDetails: wireData,
    });
  } catch (err) {
    console.error('Error confirming wire transfer:', err);
    return NextResponse.json({ error: 'Failed to record wire transfer' }, { status: 500 });
  }
}
