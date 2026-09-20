import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminStorage, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const storagePath = searchParams.get('path');

  if (!storagePath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  // 1. Path Traversal & Prefix Guard
  if (storagePath.includes('..') || !storagePath.startsWith('custom-design/')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  // 2. Authentication Check
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

  // 3. Authorization / IDOR Guard:
  // If not admin, the user MUST be the owner of the file.
  if (!isAdmin) {
    const pathParts = storagePath.split('/');
    const pathOwnerUid = pathParts[1]; // custom-design/{uid}/...

    if (pathOwnerUid && pathOwnerUid !== uid) {
      // Check if user owns a request containing this file
      const snapshot = await adminDb
        .collection('customDesignRequests')
        .where('userId', '==', uid)
        .limit(20)
        .get();

      let hasFile = false;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.uploads) && data.uploads.some((u: any) => u.storagePath === storagePath)) {
          hasFile = true;
          break;
        }
      }

      if (!hasFile) {
        return NextResponse.json({ error: 'Forbidden: You do not own this artwork file' }, { status: 403 });
      }
    }
  }

  // 4. Stream file from Firebase Admin Storage
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    return NextResponse.json({ error: 'Storage bucket not configured' }, { status: 500 });
  }

  try {
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [fileContent] = await file.download();

    const contentType = metadata.contentType || 'application/octet-stream';
    const fileName = metadata.metadata?.originalFileName
      ? decodeURIComponent(String(metadata.metadata.originalFileName))
      : 'artwork';

    return new NextResponse(new Uint8Array(fileContent), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('[custom-design/media] Download error:', err);
    return NextResponse.json({ error: 'Failed to retrieve media file' }, { status: 500 });
  }
}
