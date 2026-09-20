import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { sendCustomDesignNotification } from '@/lib/email/sender';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  if (isRateLimited(request, 'custom_design_approve', { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
  }

  // 1. Authenticate user
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Fetch request document
  const docRef = adminDb.collection('customDesignRequests').doc(requestId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: 'Custom design request not found' }, { status: 404 });
  }

  const data = doc.data()!;

  // IDOR Guard: User must own the request
  if (data.userId !== uid) {
    return NextResponse.json({ error: 'Forbidden: You do not own this custom request' }, { status: 403 });
  }

  // State Machine Guard: Request must be in CUSTOMER_APPROVAL_REQUIRED or DESIGN_READY
  if (data.status !== 'CUSTOMER_APPROVAL_REQUIRED' && data.status !== 'DESIGN_READY') {
    return NextResponse.json(
      { error: `Cannot approve design in current status (${data.status}). Studio must submit design for approval first.` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const nextStatus = typeof data.finalPrice === 'number' && data.finalPrice > (data.prepaymentAmount || 0) && data.finalPaymentStatus !== 'paid'
    ? 'FINAL_PAYMENT_PENDING'
    : 'APPROVED';

  await docRef.update({
    status: nextStatus,
    updatedAt: now,
    statusHistory: [
      ...(data.statusHistory || []),
      {
        from: data.status,
        to: nextStatus,
        actor: 'customer',
        actorId: uid,
        timestamp: now,
        reason: 'Customer officially approved design and specifications',
      },
    ],
  });

  sendCustomDesignNotification({
    type: 'approval_received',
    requestId,
    requestNumber: data.requestId,
    customerEmail: data.customerEmail,
    customerName: data.customerName || 'Customer',
    productType: data.productType,
    newStatus: nextStatus,
  }).catch((err) => console.warn('[custom-design/approve] Notification failed non-fatally:', err));

  return NextResponse.json({
    success: true,
    requestId,
    newStatus: nextStatus,
  });
}
