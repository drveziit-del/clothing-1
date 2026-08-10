import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * Verify Printify webhook authenticity.
 * First checks for the official Printify signature (x-pfy-signature) using HMAC-SHA256.
 * Falls back to token verification (x-printify-webhook-token) for manual testing.
 */
function verifyPrintifyWebhook(rawBody: string, request: NextRequest): boolean {
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('PRINTIFY_WEBHOOK_SECRET is not configured — rejecting webhook');
    return false;
  }

  // 1. Official Signature Check (HMAC-SHA256)
  const signature = request.headers.get('x-pfy-signature');
  if (signature) {
    const cleanSignature = signature.replace('sha256=', '');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(cleanSignature, 'hex'))) {
        return true;
      }
    } catch (err) {
      console.warn('Printify signature comparison failed, falling back to token check.');
    }
  }

  // 2. Token Fallback Check (for testing or direct header auth)
  const token = request.headers.get('x-printify-webhook-token')
    || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return false;

  const expectedBuf = Buffer.from(secret);
  const tokenBuf = Buffer.from(token);
  if (expectedBuf.length !== tokenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, tokenBuf);
}

/**
 * Status hierarchy for idempotency — prevents status downgrades.
 * Higher number = further along in the fulfillment pipeline.
 */
const STATUS_RANK: Record<string, number> = {
  pending:        0,
  paid:           1,
  in_production:  2,
  shipped:        3,
  delivered:      4,
  cancelled:      5,
};

export async function POST(request: NextRequest) {
  // 1. Read raw body as text for signature validation
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 2. Authenticate webhook
  if (!verifyPrintifyWebhook(rawBody, request)) {
    console.warn('Printify webhook rejected: invalid or missing authentication signature/token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Parse JSON body
  let body: Record<string, any>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type: string = (body.type as string) ?? '';
  const data = body.data as Record<string, unknown> ?? {};

  // Match by external_id (our Firestore order ID)
  const externalId = data.external_id as string | undefined;
  if (!externalId) return NextResponse.json({ status: 'ok' });

  const orderRef = adminDb.collection('orders').doc(externalId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) return NextResponse.json({ status: 'not_found' });

  const currentStatus = (orderDoc.data()?.status as string) ?? '';
  const currentRank = STATUS_RANK[currentStatus] ?? -1;

  switch (type) {
    case 'order:created': {
      // Idempotency: don't downgrade if already past in_production
      if (currentRank >= STATUS_RANK.in_production) {
        console.log(`Order ${externalId} already at '${currentStatus}' — skipping 'order:created' event.`);
        break;
      }

      await orderRef.update({
        printifyOrderId: data.id,
        status:          'in_production',
        updatedAt:       FieldValue.serverTimestamp(),
      });
      break;
    }

    case 'order:shipment:created': {
      // Idempotency: don't downgrade if already delivered
      if (currentRank >= STATUS_RANK.shipped) {
        console.log(`Order ${externalId} already at '${currentStatus}' — skipping 'shipment:created' event.`);
        break;
      }

      const shipments = data.shipments as Array<{ url?: string }> ?? [];
      const trackingUrl = shipments[0]?.url ?? null;
      await orderRef.update({
        status:      'shipped',
        trackingUrl,
        updatedAt:   FieldValue.serverTimestamp(),
      });
      break;
    }

    case 'order:shipment:delivered': {
      // Idempotency: don't re-process if already delivered
      if (currentRank >= STATUS_RANK.delivered) {
        console.log(`Order ${externalId} already '${currentStatus}' — skipping 'delivered' event.`);
        break;
      }

      await orderRef.update({
        status:    'delivered',
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
    }
  }

  return NextResponse.json({ status: 'ok' });
}
