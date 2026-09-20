import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|avif|heic|heif|mp4|webm|mov)$/i;

function resolveStoragePath(input?: string | null): string | null {
  if (!input) return null;
  let str = input.trim();

  // If input is formatted as ?path=...
  if (str.includes('path=')) {
    const qMatch = str.match(/[?&]path=([^&]+)/);
    if (qMatch) str = qMatch[1];
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(str);
  } catch {
    return null;
  }

  // Security: Reject path traversal or null bytes
  if (decoded.includes('..') || decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }

  // Extract reviews path or filename
  const match = decoded.match(/(?:^|\/|reviews\/|reviews%2F)([^/\\?&#]+)$/i);
  if (!match) return null;

  const fname = match[1];
  if (!ALLOWED_EXTENSIONS.test(fname)) {
    return null;
  }

  return `reviews/${fname}`;
}

/**
 * Dedicated Byte-Range Streaming Media Route for Review Videos & Photos
 * Ensures 100% CORS-safe streaming, 206 Partial Content, Accept-Ranges, and correct MIME headers.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pathParam = searchParams.get('path');

    // Security: Ignore client-supplied url parameters to eliminate SSRF risks.
    // Media must be addressed strictly via safe storage paths.
    const storagePath = resolveStoragePath(pathParam);
    if (!storagePath) {
      return new NextResponse('Invalid or unauthorized media path', { status: 400 });
    }

    const rangeHeader = request.headers.get('range');
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (bucketName) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const file = bucket.file(storagePath);

        const [exists] = await file.exists();
        if (exists) {
          const [metadata] = await file.getMetadata();
          const fileSize = Number(metadata.size) || 0;
          const contentType = metadata.contentType || (storagePath.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');

          // Handle Range requests (Crucial for MP4 seeking and moov atom discovery)
          if (rangeHeader && fileSize > 0) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10) || 0;
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize || end >= fileSize || start > end) {
              return new NextResponse(null, {
                status: 416,
                headers: {
                  'Content-Range': `bytes */${fileSize}`,
                },
              });
            }

            const chunkSize = end - start + 1;
            const nodeStream = file.createReadStream({ start, end });

            const stream = new ReadableStream({
              start(controller) {
                nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
                nodeStream.on('end', () => controller.close());
                nodeStream.on('error', (err: any) => controller.error(err));
              },
              cancel() {
                nodeStream.destroy();
              },
            });

            return new NextResponse(stream, {
              status: 206,
              headers: {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(chunkSize),
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range, Accept-Ranges',
              },
            });
          }

          // Full content stream
          const nodeStream = file.createReadStream();
          const stream = new ReadableStream({
            start(controller) {
              nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
              nodeStream.on('end', () => controller.close());
              nodeStream.on('error', (err: any) => controller.error(err));
            },
            cancel() {
              nodeStream.destroy();
            },
          });

          return new NextResponse(stream, {
            status: 200,
            headers: {
              'Content-Length': String(fileSize),
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch (bucketErr: any) {
        console.error('[api/reviews/media] Bucket stream error:', bucketErr?.message || bucketErr);
      }
    }

    // 2. Fallback: Proxy directly from the authoritative Google Cloud Storage bucket with timeout
    if (!bucketName) {
      return new NextResponse('Storage bucket not configured', { status: 500 });
    }

    const authoritativeUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(authoritativeUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(8000), // 8 second upstream timeout
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new NextResponse('Upstream media not found', { status: upstreamRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Accept-Ranges');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

    const contentType = upstreamRes.headers.get('content-type') || (storagePath.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');
    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[api/reviews/media] Streaming error:', err);
    return new NextResponse('Internal server error streaming media', { status: 500 });
  }
}
