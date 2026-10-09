// simple fixed window, in memory. per instance only - would need redis to share it

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

// so the map can't grow forever
const MAX_KEYS = 10_000;

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [oldKey, window] of windows) {
        if (window.resetAt <= now) windows.delete(oldKey);
      }
    }

    windows.set(key, { count: 1, resetAt: now + windowMs });

    return { allowed: true };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;

  return { allowed: true };
}

export function resetRateLimit(key: string) {
  windows.delete(key);
}

// can be faked without a proxy, only use it for rate limiting
export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
