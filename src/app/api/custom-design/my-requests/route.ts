import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

import { toCustomerSafeCustomDesignDto } from '@/lib/custom-design/types';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
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
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  try {
    const snapshot = await adminDb
      .collection('customDesignRequests')
      .where('userId', '==', uid)
      .limit(50)
      .get();

    const requests = snapshot.docs
      .map((doc) => toCustomerSafeCustomDesignDto(doc.data(), doc.id))
      .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err: any) {
    console.error('[custom-design/my-requests] Query error:', err);
    return NextResponse.json({ error: 'Failed to retrieve custom design requests' }, { status: 500 });
  }
}
