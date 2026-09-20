/**
 * Ensures a redirect URL is strictly a same-origin relative path.
 * Rejects absolute URLs (https://evil.com), protocol-relative paths (//evil.com),
 * backslash evasions (/\\evil.com), and non-HTTP schemes (javascript:, data:).
 */
export function getSafeRedirectUrl(target?: string | null, fallback = '/'): string {
  if (!target || typeof target !== 'string') return fallback;
  const trimmed = target.trim();

  // Must start with a single leading slash and cannot start with // or /\
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('\\')
  ) {
    return trimmed;
  }

  return fallback;
}
