/**
 * Utility to generate a high-quality JPEG snapshot/poster from a video File or URL
 */
export async function generateVideoThumbnail(source: File | string, seekTime = 0.1): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let objectUrl = '';
    if (typeof source === 'string') {
      video.src = normalizeMediaUrl(source);
    } else {
      objectUrl = URL.createObjectURL(source);
      video.src = objectUrl;
    }

    let isResolved = false;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }
      video.removeAttribute('src');
      video.load();
    };

    const takeSnapshot = () => {
      if (isResolved) return;
      try {
        const width = video.videoWidth || 480;
        const height = video.videoHeight || 360;

        if (width > 0 && height > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(width, 720);
          canvas.height = Math.round((canvas.width / width) * height);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            isResolved = true;
            cleanup();
            resolve(dataUrl);
            return;
          }
        }
      } catch (err) {
        console.warn('[generateVideoThumbnail] Canvas capture failed:', err);
      }

      isResolved = true;
      cleanup();
      resolve('');
    };

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      const targetTime = Math.min(seekTime, duration > 1 ? 0.5 : 0.05);
      try {
        video.currentTime = targetTime;
      } catch {
        takeSnapshot();
      }
    };

    video.onseeked = () => {
      takeSnapshot();
    };

    video.onloadeddata = () => {
      if (video.currentTime === 0) {
        try {
          video.currentTime = 0.05;
        } catch {
          takeSnapshot();
        }
      }
    };

    video.onerror = () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve('');
      }
    };

    // Safety fallback timeout after 3.5s
    setTimeout(() => {
      if (!isResolved) {
        takeSnapshot();
      }
    }, 3500);
  });
}

/**
 * Normalizes a media URL (especially Google Cloud Storage or Firebase Storage)
 * to ensure 100% CORS-safe streaming with byte-range support across all browsers.
 */
export function normalizeMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/api/reviews/media')) {
    return url;
  }

  // If it's a direct Google Cloud Storage or Firebase Storage bucket URL,
  // route it through our internal authenticated byte-range streaming proxy
  if (url.includes('storage.googleapis.com') || url.includes('firebasestorage.googleapis.com')) {
    const match = url.match(/reviews%2F([^?&]+)|reviews\/([^?&]+)/i);
    if (match) {
      let rawFilename = match[1] || match[2];
      try {
        rawFilename = decodeURIComponent(rawFilename);
      } catch {}
      return `/api/reviews/media?path=${encodeURIComponent(`reviews/${rawFilename}`)}`;
    }
    return url;
  }

  return url;
}
