import 'server-only';
import crypto from 'crypto';

/**
 * Generates an 8-character cryptographically secure alphanumeric referral code.
 * Excludes easily confusable characters (0, O, 1, I).
 */
export function generateSecureReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = 'GERK-';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
