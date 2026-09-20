export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  sanitizedBuffer?: Buffer;
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB per file
export const MAX_FILES_PER_REQUEST = 5;

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'svg', 'heic', 'heif'];

/**
 * Checks if a buffer matches known magic bytes for image/document types.
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  declaredFileName: string,
  declaredMimeType: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File exceeds maximum allowed size of 25MB (${(buffer.length / 1024 / 1024).toFixed(1)}MB)` };
  }

  const extMatch = declaredFileName.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Extension .${ext} is not supported. Allowed: PNG, JPG, JPEG, WEBP, PDF, SVG, HEIC, HEIF` };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (ext !== 'png') {
      return { valid: false, error: 'File content (PNG) does not match extension' };
    }
    return { valid: true, detectedMime: 'image/png' };
  }

  // 2. JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    if (ext !== 'jpg' && ext !== 'jpeg') {
      return { valid: false, error: 'File content (JPEG) does not match extension' };
    }
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 3. WEBP: RIFF (52 49 46 46) at offset 0, WEBP (57 45 42 50) at offset 8
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    if (ext !== 'webp') {
      return { valid: false, error: 'File content (WEBP) does not match extension' };
    }
    return { valid: true, detectedMime: 'image/webp' };
  }

  // 4. PDF: %PDF (25 50 44 46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    if (ext !== 'pdf') {
      return { valid: false, error: 'File content (PDF) does not match extension' };
    }
    return { valid: true, detectedMime: 'application/pdf' };
  }

  // 5. SVG: Text file starting with <svg or <?xml ... <svg
  if (ext === 'svg') {
    const textSnippet = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf-8').trim().toLowerCase();
    const isSvg = textSnippet.includes('<svg') || (textSnippet.includes('<?xml') && textSnippet.includes('<svg'));

    if (!isSvg) {
      return { valid: false, error: 'Invalid SVG structure: missing <svg> element' };
    }

    // SVG Security: Block any active scripting or event attributes
    const fullText = buffer.toString('utf-8');
    const dangerousPatterns = [
      /<script[\s>]/i,
      /<\/script>/i,
      /javascript:/i,
      /vbscript:/i,
      /\son[a-z]+\s*=/i, // e.g. onload=, onerror=, onclick=
      /<iframe[\s>]/i,
      /<object[\s>]/i,
      /<embed[\s>]/i,
      /xlink:href=["']data:text\/html/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(fullText)) {
        return { valid: false, error: 'Malicious SVG content detected: executable scripts or event handlers are prohibited' };
      }
    }

    return { valid: true, detectedMime: 'image/svg+xml', sanitizedBuffer: buffer };
  }

  // 6. HEIC / HEIF: 'ftyp' at offset 4 with compatible brand 'heic', 'heix', 'mif1', 'msf1', etc.
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70    // p
  ) {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      if (ext !== 'heic' && ext !== 'heif') {
        return { valid: false, error: 'File content (HEIC/HEIF) does not match extension' };
      }
      return { valid: true, detectedMime: 'image/heic' };
    }
  }

  return {
    valid: false,
    error: `File signature does not match any allowed format (PNG, JPG, WEBP, PDF, SVG, HEIC). Declared: ${declaredMimeType}`,
  };
}
