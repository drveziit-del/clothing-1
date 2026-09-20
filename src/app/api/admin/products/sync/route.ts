import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { syncProductsFromPrintify } from '@/lib/printify/sync';
import { cookies } from 'next/headers';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return { error: 'Unauthorized', status: 401 };

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    if (!decoded.admin) return { error: 'Forbidden', status: 403 };
    return { uid: decoded.uid };
  } catch {
    return { error: 'Invalid session', status: 401 };
  }
}

export async function POST() {
  const authResult = await checkAdminAuth();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!shopId) {
    return NextResponse.json({ error: 'PRINTIFY_SHOP_ID is not configured in .env.local' }, { status: 500 });
  }

  try {
    const result = await syncProductsFromPrintify(shopId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error syncing products from Printify:', err);
    return NextResponse.json({ error: 'Failed to sync products' }, { status: 500 });
  }
}
