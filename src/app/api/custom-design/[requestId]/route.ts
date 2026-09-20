import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { toCustomerSafeCustomDesignDto } from '@/lib/custom-design/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
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
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
    isAdmin = Boolean(decoded.admin);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // 2. Fetch document
  const docRef = adminDb.collection('customDesignRequests').doc(requestId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: 'Custom design request not found' }, { status: 404 });
  }

  const data = doc.data()!;

  // 3. IDOR Guard: User must be owner or admin
  if (data.userId !== uid && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view this request' }, { status: 403 });
  }

  // Whitelist safe fields for customers; admins receive complete administrative record
  const payload = isAdmin
    ? { id: doc.id, ...data }
    : toCustomerSafeCustomDesignDto(data, doc.id);

  return NextResponse.json({
    success: true,
    request: payload,
  });
}
