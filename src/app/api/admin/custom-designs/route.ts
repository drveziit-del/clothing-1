import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Admin Auth Check
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const searchQuery = searchParams.get('search')?.toLowerCase().trim();

  try {
    let query: FirebaseFirestore.Query = adminDb.collection('customDesignRequests');

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.where('status', '==', statusFilter);
    }

    // Limit to recent 100
    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();

    let requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as any[];

    if (searchQuery) {
      requests = requests.filter((r) => {
        return (
          (r.requestId && r.requestId.toLowerCase().includes(searchQuery)) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(searchQuery)) ||
          (r.customerName && r.customerName.toLowerCase().includes(searchQuery)) ||
          (r.productType && r.productType.toLowerCase().includes(searchQuery))
        );
      });
    }

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err: any) {
    console.error('[admin/custom-designs] Query error:', err);
    return NextResponse.json({ error: 'Failed to query custom designs' }, { status: 500 });
  }
}
