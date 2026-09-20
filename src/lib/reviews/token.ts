import 'server-only';
import crypto from 'crypto';

interface ReviewTokenPayload {
  orderId: string;
  productId: string;
  email: string;
  exp: number; // timestamp in ms
}

function getSecret(): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.FIREBASE_PRIVATE_KEY || 'gerkink-review-secret-salt-2026';
  return secret;
}

/**
 * Generates a signed, single-purpose review token with a 30-day expiration.
 */
export function generateReviewToken(orderId: string, productId: string, email: string): string {
  const payload: ReviewTokenPayload = {
    orderId: orderId.trim(),
    productId: productId.trim(),
    email: email.trim().toLowerCase(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and decodes a signed review token.
 * Returns the payload if valid and non-expired, or null otherwise.
 */
export function verifyReviewToken(token: string): ReviewTokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, providedSig] = parts;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(payloadBase64)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload: ReviewTokenPayload = JSON.parse(payloadJson);

    if (!payload.orderId || !payload.productId || !payload.exp) {
      return null;
    }

    if (Date.now() > payload.exp) {
      console.warn('[verifyReviewToken] Token has expired');
      return null;
    }

    return payload;
  } catch (err) {
    console.warn('[verifyReviewToken] Failed to parse token:', err);
    return null;
  }
}
