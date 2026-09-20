import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { customerMessageSchema, type CustomDesignMessage } from '@/lib/custom-design/types';
import { randomUUID } from 'crypto';
import { sendCustomDesignNotification } from '@/lib/email/sender';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  if (isRateLimited(request, 'custom_design_msg', { limit: 20, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many messages. Please wait.' }, { status: 429 });
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
  let userName = 'Customer';
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
    isAdmin = Boolean(decoded.admin);
    if (decoded.name) userName = decoded.name;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // 2. Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = customerMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid message' }, { status: 400 });
  }

  const { message } = parseResult.data;

  // 3. Fetch request document & verify ownership
  const docRef = adminDb.collection('customDesignRequests').doc(requestId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: 'Custom design request not found' }, { status: 404 });
  }

  const data = doc.data()!;

  // IDOR Guard: User must be owner (or admin acting on behalf)
  if (data.userId !== uid && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You do not own this request' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const newMessage: CustomDesignMessage = {
    id: randomUUID(),
    sender: isAdmin ? 'admin' : 'customer',
    senderName: isAdmin ? 'GERKINK Studio' : (data.customerName || userName),
    senderUid: uid,
    message: message.trim(),
    timestamp: now,
  };

  const updates: any = {
    customerMessages: [...(data.customerMessages || []), newMessage],
    updatedAt: now,
  };

  // If customer replied to NEEDS_INFORMATION, transition state back to UNDER_REVIEW!
  if (!isAdmin && data.status === 'NEEDS_INFORMATION') {
    updates.status = 'UNDER_REVIEW';
    updates.statusHistory = [
      ...(data.statusHistory || []),
      {
        from: 'NEEDS_INFORMATION',
        to: 'UNDER_REVIEW',
        actor: 'customer',
        actorId: uid,
        timestamp: now,
        reason: 'Customer provided requested information',
      },
    ];
  }

  await docRef.update(updates);

  // If customer sent a message, notify the studio at custom@gerkink.shop
  if (!isAdmin) {
    sendCustomDesignNotification({
      type: 'customer_message',
      requestId,
      requestNumber: data.requestId,
      customerEmail: data.customerEmail,
      customerName: data.customerName || userName,
      productType: data.productType,
      message: message.trim(),
    }).catch((err) => console.warn('[custom-design/message] Notification failed non-fatally:', err));
  }

  return NextResponse.json({
    success: true,
    message: newMessage,
    newStatus: updates.status || data.status,
  });
}
