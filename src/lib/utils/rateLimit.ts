import { NextRequest } from 'next/server';

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const trackers = new Map<string, RateLimitTracker>();

// Cleanup stale entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of trackers.entries()) {
      if (now > value.resetTime) {
        trackers.delete(key);
      }
    }
  }, 1000 * 60 * 5);
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Checks if the request client IP has exceeded the specified rate limit.
 * 
 * @param request NextRequest incoming request object to extract IP.
 * @param keyPrefix Unique string identifier for the endpoint (e.g. 'contact').
 * @param options limit (max requests) and windowMs (timeframe in milliseconds).
 * @returns boolean true if rate limited (exceeded limit), false otherwise.
 */
export function isRateLimited(
  request: NextRequest,
  keyPrefix: string,
  options: RateLimitOptions
): boolean {
  // Extract client IP from request headers or default
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const key = `${keyPrefix}_${ip}`;
  const now = Date.now();

  let tracker = trackers.get(key);

  if (!tracker) {
    trackers.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return false;
  }

  // Window expired — reset counter
  if (now > tracker.resetTime) {
    tracker.count = 1;
    tracker.resetTime = now + options.windowMs;
    return false;
  }

  tracker.count++;
  if (tracker.count > options.limit) {
    return true;
  }

  return false;
}
