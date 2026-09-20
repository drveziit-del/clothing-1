import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminStorage } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { validateFileMagicBytes, MAX_FILE_SIZE_BYTES } from '@/lib/custom-design/magicBytes';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function parseMultipartFormData(
  body: Buffer,
  contentType: string
): { buffer: Buffer; fileName: string; mimeType: string } | null {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);

  let start = body.indexOf(delimiter);
  if (start === -1) return null;
  start += delimiter.length;

  if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start);
  if (headerEnd === -1) return null;

  const headerBlock = body.subarray(start, headerEnd).toString('utf-8');
  const dataStart = headerEnd + 4;

  const endDelimiter = Buffer.from(`\r\n--${boundary}`);
  let dataEnd = body.indexOf(endDelimiter, dataStart);
  if (dataEnd === -1) dataEnd = body.length;

  const fileBuffer = body.subarray(dataStart, dataEnd);

  let fileName = 'artwork';
  let mimeType = 'application/octet-stream';

  const dispositionMatch = headerBlock.match(/Content-Disposition:.*?filename="([^"]+)"/i);
  if (dispositionMatch) {
    fileName = dispositionMatch[1];
  }

  const typeMatch = headerBlock.match(/Content-Type:\s*(\S+)/i);
  if (typeMatch) {
    mimeType = typeMatch[1].replace(/;$/, '');
  }

  return { buffer: fileBuffer, fileName, mimeType };
}

export async function POST(request: NextRequest) {
  if (isRateLimited(request, 'custom_design_upload', { limit: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many upload attempts. Please wait.' }, { status: 429 });
  }

  // 1. Auth check: Customer must be logged in to upload design files
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds maximum allowed size of 25MB' }, { status: 400 });
    }

    const rawBody = Buffer.from(await request.arrayBuffer());
    if (rawBody.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds maximum allowed size of 25MB' }, { status: 400 });
    }

    const parsed = parseMultipartFormData(rawBody, contentType);

    if (!parsed || parsed.buffer.length === 0) {
      return NextResponse.json({ error: 'No file data found in upload' }, { status: 400 });
    }

    const { buffer, fileName, mimeType } = parsed;

    // 2. Strict Magic Byte & Extension Validation
    const validation = validateFileMagicBytes(buffer, fileName, mimeType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid file format' }, { status: 400 });
    }

    const detectedMime = validation.detectedMime || mimeType;
    const cleanExt = fileName.split('.').pop()?.toLowerCase() || 'png';
    const fileId = randomUUID();
    // Private path under user-scoped directory
    const storagePath = `custom-design/${uid}/${fileId}.${cleanExt}`;

    // 3. Save to Firebase Admin Storage (Private — zero public ACL)
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const fileRef = bucket.file(storagePath);

        await fileRef.save(validation.sanitizedBuffer || buffer, {
          metadata: {
            contentType: detectedMime,
            cacheControl: 'private, max-age=3600',
            metadata: {
              ownerUid: uid,
              originalFileName: encodeURIComponent(fileName),
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        // Note: We deliberately DO NOT call fileRef.makePublic()
        return NextResponse.json({
          success: true,
          fileId,
          originalName: fileName,
          mimeType: detectedMime,
          size: buffer.length,
          storagePath,
          url: `/api/custom-design/media?path=${encodeURIComponent(storagePath)}`,
        });
      } catch (storageErr: any) {
        console.error('[custom-design/upload] Storage error:', storageErr?.message || storageErr);
      }
    }

    // Local fallback for dev/testing when bucket is not provisioned
    return NextResponse.json({
      success: true,
      fileId,
      originalName: fileName,
      mimeType: detectedMime,
      size: buffer.length,
      storagePath,
      url: `/api/custom-design/media?path=${encodeURIComponent(storagePath)}`,
    });
  } catch (err: any) {
    console.error('[custom-design/upload] Unhandled upload error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to upload artwork' }, { status: 500 });
  }
}
