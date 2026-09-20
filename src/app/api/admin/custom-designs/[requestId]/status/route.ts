import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { adminStatusUpdateSchema, type CustomDesignStatus } from '@/lib/custom-design/types';
import { isValidStatusTransition } from '@/lib/custom-design/stateMachine';
import { sendCustomDesignNotification } from '@/lib/email/sender';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
  }

  // 1. Admin Authentication Check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let adminUid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    adminUid = decoded.uid;
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

  const parseResult = adminStatusUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { status: targetStatus, reason, adminNotes, finalPrice } = parseResult.data;

  // 3. Transactional Read, State Machine Validation, and Atomic Update
  const docRef = adminDb.collection('customDesignRequests').doc(requestId);
  let previousStatus: CustomDesignStatus | '' = '';
  let notificationPayload: {
    docId: string;
    currentData: Record<string, any>;
    targetStatus: CustomDesignStatus;
    reason?: string;
    adminNotes?: string;
  } | null = null;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        throw new Error('NOT_FOUND');
      }

      const currentData = doc.data()!;
      previousStatus = currentData.status as CustomDesignStatus;

      // 4. State Machine Validation
      if (!isValidStatusTransition(previousStatus, targetStatus as CustomDesignStatus)) {
        throw new Error(`INVALID_TRANSITION: Invalid status transition from ${previousStatus} to ${targetStatus}`);
      }

      const now = new Date().toISOString();
      const updates: any = {
        status: targetStatus,
        updatedAt: now,
        statusHistory: [
          ...(currentData.statusHistory || []),
          {
            from: previousStatus,
            to: targetStatus,
            actor: 'admin',
            actorId: adminUid,
            timestamp: now,
            reason: reason || `Status transitioned by studio administrator to ${targetStatus}`,
          },
        ],
      };

      if (typeof adminNotes === 'string') {
        updates.adminNotes = adminNotes;
      }

      if (typeof finalPrice === 'number') {
        updates.finalPrice = finalPrice;
      }

      transaction.update(docRef, updates);

      notificationPayload = {
        docId: doc.id,
        currentData,
        targetStatus: targetStatus as CustomDesignStatus,
        reason,
        adminNotes,
      };
    });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Custom design request not found' }, { status: 404 });
    }
    if (err.message?.startsWith('INVALID_TRANSITION:')) {
      return NextResponse.json({ error: err.message.replace('INVALID_TRANSITION: ', '') }, { status: 400 });
    }
    console.error('[admin/custom-designs/status] Transaction error:', err);
    return NextResponse.json({ error: 'Failed to update custom design status' }, { status: 500 });
  }

  // 5. Trigger Contextual Notifications (outside transaction)
  if (notificationPayload !== null) {
    const payload = notificationPayload as {
      docId: string;
      currentData: Record<string, any>;
      targetStatus: CustomDesignStatus;
      reason?: string;
      adminNotes?: string;
    };
    const { docId, currentData, targetStatus: newStatus, reason: notifReason, adminNotes: notifAdminNotes } = payload;
    try {
      if (newStatus === 'NEEDS_INFORMATION') {
        await sendCustomDesignNotification({
          type: 'needs_information',
          requestId: docId,
          requestNumber: currentData.requestId,
          customerEmail: currentData.customerEmail,
          customerName: currentData.customerName,
          message: notifReason || notifAdminNotes || 'Please check your custom design dashboard for details.',
        });
      } else if (newStatus === 'DESIGN_READY' || newStatus === 'CUSTOMER_APPROVAL_REQUIRED') {
        await sendCustomDesignNotification({
          type: 'design_ready',
          requestId: docId,
          requestNumber: currentData.requestId,
          customerEmail: currentData.customerEmail,
          customerName: currentData.customerName,
        });
      } else {
        await sendCustomDesignNotification({
          type: 'status_updated',
          requestId: docId,
          requestNumber: currentData.requestId,
          customerEmail: currentData.customerEmail,
          customerName: currentData.customerName,
          newStatus: newStatus as any,
        });
      }
    } catch (emailErr) {
      console.warn('[admin/custom-designs/status] Email notification failed non-fatally:', emailErr);
    }
  }

  return NextResponse.json({
    success: true,
    requestId,
    previousStatus,
    newStatus: targetStatus,
  });
}
