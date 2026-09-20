import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/utils/rateLimit';
import { cookies } from 'next/headers';
import { adminAuth, adminStorage } from '@/lib/firebase/admin';
import { randomUUID } from 'crypto';
import { verifyReviewToken } from '@/lib/reviews/token';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 35 * 1024 * 1024; // 35MB

/**
 * Parse a multipart/form-data body manually to avoid Node.js undici body size limits.
 * Extracts the first file field from the multipart body.
 */
function parseMultipartFormData(
  body: Buffer,
  contentType: string
): { buffer: Buffer; fileName: string; mimeType: string } | null {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const delimiter = Buffer.from(`--${boundary}`);

  // Find first part after delimiter
  let start = body.indexOf(delimiter);
  if (start === -1) return null;
  start += delimiter.length;

  // Skip \r\n after delimiter
  if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

  // Find end of headers (blank line: \r\n\r\n)
  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start);
  if (headerEnd === -1) return null;

  const headerBlock = body.subarray(start, headerEnd).toString('utf-8');
  const dataStart = headerEnd + 4;

  // Find end delimiter
  const endDelimiter = Buffer.from(`\r\n--${boundary}`);
  let dataEnd = body.indexOf(endDelimiter, dataStart);
  if (dataEnd === -1) dataEnd = body.length;

  const fileBuffer = body.subarray(dataStart, dataEnd);

  // Parse headers for filename and content-type
  let fileName = 'upload';
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
  if (isRateLimited(request, 'reviews_upload', { limit: 20, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Too many upload attempts. Please wait a few minutes.' }, { status: 429 });
  }

  // 1. Authentication check: Session cookie or verified review token
  const reviewToken = request.headers.get('x-review-token') || request.nextUrl.searchParams.get('token');
  let isAuthorized = false;
  let _uploaderId = 'anonymous';

  if (reviewToken) {
    const tokenPayload = verifyReviewToken(reviewToken);
    if (tokenPayload && tokenPayload.orderId && tokenPayload.productId) {
      isAuthorized = true;
      _uploaderId = `token_${tokenPayload.orderId}`;
    }
  }

  if (!isAuthorized) {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (session) {
      try {
        const decoded = await adminAuth.verifySessionCookie(session, true);
        _uploaderId = decoded.uid;
        isAuthorized = true;
      } catch {
        // invalid session
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in or provide a valid review token to upload media.' },
      { status: 401 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    if (contentType.includes('multipart/form-data')) {
      // Read raw body as ArrayBuffer to bypass undici formData() body size limits
      const rawBody = Buffer.from(await request.arrayBuffer());
      const parsed = parseMultipartFormData(rawBody, contentType);

      if (!parsed || parsed.buffer.length === 0) {
        return NextResponse.json({ error: 'No file found in upload' }, { status: 400 });
      }

      fileBuffer = parsed.buffer;
      fileName = parsed.fileName;
      mimeType = parsed.mimeType.toLowerCase();
    } else {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const size = fileBuffer.length;
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType) || fileName.match(/\.(jpe?g|png|webp|avif|heic|heif)$/i) !== null;
    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType) || fileName.match(/\.(mp4|webm|mov)$/i) !== null;

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Invalid file format "${mimeType}". Please upload JPG, PNG, WEBP, HEIC, or MP4 video.` },
        { status: 400 }
      );
    }

    if (isImage && size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image size exceeds 10MB limit.' }, { status: 400 });
    }

    if (isVideo && size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: 'Video size exceeds 35MB limit.' }, { status: 400 });
    }

    // Normalize MIME type for MOV files
    if (isVideo && (!mimeType || mimeType === 'video/quicktime')) {
      mimeType = 'video/mp4';
    } else if (isImage && !mimeType) {
      mimeType = 'image/jpeg';
    }

    const rawExt = fileName.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4');
    const fileExt = rawExt === 'quicktime' ? 'mov' : rawExt;
    const uniqueFileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${fileExt}`;

    // 1. Upload to Firebase Admin Storage
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const destination = `reviews/${uniqueFileName}`;
        const fileRef = bucket.file(destination);
        const downloadToken = randomUUID();

        await fileRef.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000',
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });

        // Firebase Storage download URL with token
        const publicDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media&token=${downloadToken}`;

        // Internal streaming proxy endpoint
        const streamingUrl = `/api/reviews/media?path=${encodeURIComponent(destination)}`;

        try {
          await fileRef.makePublic();
        } catch {
          // non-fatal
        }

        console.log(`[api/reviews/upload] Uploaded ${destination} (${(size / 1024 / 1024).toFixed(2)}MB, ${mimeType})`);

        return NextResponse.json({
          success: true,
          url: streamingUrl,
          downloadUrl: publicDownloadUrl,
          type: isVideo ? 'video' : 'image',
          mimeType,
          size,
        });
      } catch (storageErr: any) {
        console.error('[api/reviews/upload] Firebase Storage error:', storageErr?.message || storageErr);
        return NextResponse.json(
          { error: `Storage upload failed: ${storageErr?.message || 'unknown error'}` },
          { status: 500 }
        );
      }
    }

    // 2. Fallback: data URI for local dev (small files only)
    if (size < 12 * 1024 * 1024) {
      const base64 = fileBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUri,
        type: isVideo ? 'video' : 'image',
        mimeType,
        size,
      });
    }

    return NextResponse.json(
      { error: 'Storage bucket not configured. Cannot process large file uploads.' },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('[api/reviews/upload] Unhandled error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to process media upload' }, { status: 500 });
  }
}
